// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IGnosis.sol";
import "../interfaces/ILiquidityHandler.sol";
import "../interfaces/IIbAlluo.sol";
import "../interfaces/IMultichain.sol";
import "../interfaces/IAlluoStrategy.sol";

import "hardhat/console.sol";

interface IAnyCallExecutor {
    struct Context {
        address from;
        uint256 fromChainID;
        uint256 nonce;
    }
  function context() external returns (Context memory);
}
interface IAnyCall {
    function anyCall(address _to, bytes calldata _data, address _fallback, uint256 _toChainID, uint256 _flags) external;

}

contract VoteExecutorSlave is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable {

    using ECDSA for bytes32;
    using Address for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bool public upgradeStatus;
    string public lastMessage;
    address public lastCaller;
    address public voteExecutorMaster;
    bytes[] public executionHistory;


    // Anycall V6 Fantom Address
    address public anyCallAddress;
    address public anyCallExecutorAddress;

    ILiquidityHandler public handler;
    address public gnosis;
    uint256 public  minSigns;

    uint256 public currentChain;
    bytes[] public reallocationArray;
    mapping(address => address) public tokenToAnyToken;
    mapping(address => address) public strategyToToken;
    mapping(address => DepositQueue) public tokenToDepositQueue;
    address[] public primaryTokens;
    address public multichainRouter;
    uint256 public nextChain;
    address public nextChainExecutor;
    uint256 public previousChain;
    address public previousChainExecutor;

    mapping(string => IIbAlluo) public ibAlluoSymbolToAddress;

    mapping(bytes32 => uint256) public hashExecutionTime;

    mapping(address => bool) public activeStrategies;
    uint256 public slippage;
    // USD => strategy addresses => prev funds
    // USD => list of active strategies

    struct Message {
        uint256 commandIndex;
        bytes commandData;
    }

    struct APYData {
        uint256 newAnnualInterest;
        uint256 newInterestPerSecond;
        string ibAlluo;
    }
    struct Deposit {
        address strategyAddress;
        uint256 amount;
        bytes data;
    }
    struct DepositQueue {
        Deposit[] depositList;
        uint256 depositNumber;
    }

    struct LiquidityDirection {
        address strategyAddress;
        uint256 chainId;
        bytes data;
    }

    mapping(string => LiquidityDirection) public liquidityDirection;

    event MessageReceived(bytes32 indexed messagesHash);


    function initialize(address _multiSigWallet, address _handlerAddress) public initializer {
            __Pausable_init();
            __AccessControl_init();
            __UUPSUpgradeable_init();

            anyCallAddress = 0xD7c295E399CA928A3a14b01D760E794f1AdF8990;
            anyCallExecutorAddress = 0xe3aee52608Db94F2691a7F9Aba30235B14B7Bb70;
            handler = ILiquidityHandler(_handlerAddress);
            gnosis  = _multiSigWallet;
            minSigns = 3;
            slippage = 97000;
            require(_multiSigWallet.isContract(), "Handler: Not contract");

            _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
            // Only enable for tests!
            _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
            _grantRole(UPGRADER_ROLE, _multiSigWallet);
        }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}


    /// @notice Receives SMPC call from Multichain and executes command after security checks
    /// @dev Format of function name and return params are necessary (see docs: https://docs.multichain.org/developer-guide/anycall/anycall-v6/how-to-integrate-anycall-v6)
    // Carry out two security checks:
    // 1.) Confirm that the hash has been signed by the multisig 
    // 2.) Confirm that anyCall has been triggered by our VoteExecutorMaster contract
    /// @param _data Data sent through by SMPC
    /// @return success Required by Multichain
    /// @return result Required by Multichain
    function anyExecute(bytes memory _data) external returns (bool success, bytes memory result) {
        (bytes memory message, bytes[] memory signs) = abi.decode(_data, (bytes, bytes[]));
        (bytes32 hashed, Message[] memory _messages) = abi.decode(message, (bytes32, Message[]));
        require(hashed == keccak256(abi.encode(_messages)), "Hash doesn't match");
        require(_checkSignedHashes(signs, hashed), "Hash has not been approved");
        // Comment this line for local tests
        // require(IAnyCallExecutor(anyCallExecutorAddress).context().from == voteExecutorMaster, "Origin of message invalid");
        require(hashExecutionTime[hashed] ==0 || block.timestamp >= hashExecutionTime[hashed] + 2 days, "Duplicate hash" );
        
        execute(_messages);
        executionHistory.push(_data);
        hashExecutionTime[hashed] = block.timestamp;
        if (nextChain != 0) {
            IAnyCall(anyCallAddress).anyCall(nextChainExecutor, _data, address(0), nextChain, 0);
        }
        success=true;
        result="";
        emit MessageReceived(hashed);
        // Gelato should listen out for messageReceived and start calling checkExecuteDeposits()
        // If it returns true, it can trigger it. Then stop listening.
        
    }


    /// @notice Executes all messages received after authentication
    /// @dev Loops through each command in the array and executes it.
    /// @param _messages Array of messages
    function execute(Message[] memory _messages) internal {
        for (uint256 i; i < _messages.length; i++) {
            Message memory currentMessage =  _messages[i];
            if (currentMessage.commandIndex == 0) {
                (string memory ibAlluoSymbol, uint256 newAnnualInterest, uint256 newInterestPerSecond) = abi.decode(currentMessage.commandData, (string, uint256, uint256));
                _changeAPY(newAnnualInterest, newInterestPerSecond, ibAlluoSymbol);
            }

            if(currentMessage.commandIndex == 2) {
                // Handle all withdrawals first and then add all deposit actions to an array to be executed afterwards
                (address strategyAddress, uint256 delta, uint256 chainId, bytes memory data) = abi.decode(currentMessage.commandData, (address, uint256, uint256, bytes));
                if (chainId == currentChain) {
                    console.log("Withdraw strategy", strategyAddress, delta);
                    _withdrawStrategy(strategyAddress, delta, data);
                }
            }
            if(currentMessage.commandIndex == 3) {
                // Add all deposits to the queue.
                (address strategyAddress, uint256 delta, uint256 chainId, bytes memory data) = abi.decode(currentMessage.commandData, (address, uint256, uint256, bytes));
                if (chainId == currentChain) {
                    address token = strategyToToken[strategyAddress];
                    console.log("Deposit added", strategyAddress, delta);
                    tokenToDepositQueue[token].depositList.push(Deposit(strategyAddress, delta, data));
                }
            }
        }
        _executeDeposits(true);

    }
    function _executeDeposits(bool forward) internal {
        for (uint256 i; i < primaryTokens.length; i++) {
            DepositQueue memory depositQueue = tokenToDepositQueue[primaryTokens[i]];
            Deposit[] memory depositList = depositQueue.depositList;
            uint256 depositNumber = depositQueue.depositNumber;
            uint256 iters = depositList.length - depositNumber;
            for (uint256 j; j < iters; j++) {
                Deposit memory depositInfo = depositList[depositNumber + j];
                console.log("Inside executeDeposits", depositInfo.strategyAddress, depositInfo.amount);
                _depositStrategy(depositInfo.strategyAddress, depositInfo.amount, depositInfo.data);
            }
        }
        _bridgeFunds(forward);
    }

    // Public can only executeDeposits by bridging funds backwards.
    function executeDeposits() public {
        _executeDeposits(false);
    }

    // This function checks if executeDeposits() can be called without being reverted.
    // We can put a flag to set as true for gelato to start listening , such as when we receive 
    function checkExecuteDeposits() public view returns (bool) {
        for (uint256 i; i < primaryTokens.length; i++) {
            DepositQueue memory depositQueue = tokenToDepositQueue[primaryTokens[i]];
            Deposit[] memory depositList = depositQueue.depositList;
            uint256 depositNumber = depositQueue.depositNumber;
            uint256 iters = depositList.length - depositNumber;
            for (uint256 j; j < iters; j++) {
                Deposit memory depositInfo = depositList[depositNumber + i];
                if (IERC20MetadataUpgradeable(strategyToToken[depositInfo.strategyAddress]).balanceOf(address(this)) < depositInfo.amount) {
                    return false;
                }
            }
        }
        return true;
    }

    function _changeAPY(uint256 _newAnnualInterest, uint256 _newInterestPerSecond, string memory _ibAlluoSymbol) internal {
        ibAlluoSymbolToAddress[_ibAlluoSymbol].setInterest(_newAnnualInterest, _newInterestPerSecond);
    }


    function _depositStrategy(address _strategy, uint256 _amount, bytes memory _data) internal {
        // Below, try deposit into strategy, otherwise add to deposit queue
        // No partial deposits for a single strategy to optimise gas. Do deposits in bulk.
        // Amount in 10**18
        address token = strategyToToken[_strategy];
        uint256 tokenBalance = IERC20MetadataUpgradeable(token).balanceOf(address(this));
        uint256 tokenBalance18 = tokenBalance * 10**(18- IERC20MetadataUpgradeable(token).decimals());
        if (tokenBalance18 > _amount * slippage/100000) {
            // Add investing logic here
            IAlluoStrategy(_strategy).invest(_data, _amount * slippage/100000);
            tokenToDepositQueue[token].depositNumber++;
        }
    }

    function _withdrawStrategy(address _strategy, uint256 _amount, bytes memory _data) internal {
        // Add withdrawing logic here
        // USD in 10**18
        // Issue 1: unwindPercent, but we need to use absolute amounts
        // Issue 2: Need output token (strategyToToken[_strategy],) in the primaryToken (usdc for usd etc)
        // Need to exchange it to the primaryToken
        IAlluoStrategy(_strategy).exitAll(_data, _amount, strategyToToken[_strategy], address(this), true);
    }

    function _bridgeFunds(bool forward) internal {
        // primaryTokens = eth, usd, eur
        for (uint256 i; i < primaryTokens.length; i++) {
            uint256 tokenBalance = IERC20MetadataUpgradeable(primaryTokens[i]).balanceOf(address(this));
            if ( tokenToDepositQueue[primaryTokens[i]].depositList.length ==  tokenToDepositQueue[primaryTokens[i]].depositNumber && tokenBalance >= 1000 && forward) {
                IMultichain(multichainRouter).anySwapOutUnderlying(tokenToAnyToken[primaryTokens[i]], nextChainExecutor, tokenBalance, nextChain);
            }
            if ( tokenToDepositQueue[primaryTokens[i]].depositList.length ==  tokenToDepositQueue[primaryTokens[i]].depositNumber && tokenBalance >= 1000 && !forward) {
                IMultichain(multichainRouter).anySwapOutUnderlying(tokenToAnyToken[primaryTokens[i]], previousChainExecutor, tokenBalance, previousChain);
            }
        }
    }


    /// @notice Checks the array of signatures from L1 for authentication
    /// @dev Grabs list of approved multisig signers and loops through eth_sign recovery and returns true if it exceeds minimum signs.
    /// @param _signs Array of signatures sent from L1
    /// @param _hashed The hash of the data from L1
    /// @return bool
    function _checkSignedHashes(bytes[] memory _signs, bytes32 _hashed) internal view returns (bool) {
        address[] memory owners = IGnosis(gnosis).getOwners();
        address[] memory uniqueSigners = new address[](owners.length);
        uint256 numberOfSigns;
        for (uint256 i; i < _signs.length; i++) {
            for (uint256 j; j < owners.length; j++) {
                if(_verify(_hashed, _signs[i], owners[j]) && _checkUniqueSignature(uniqueSigners, owners[j])){
                    uniqueSigners[numberOfSigns] = owners[j];
                    numberOfSigns++;
                    break;
                }
            }
        }
        return numberOfSigns >= minSigns ? true : false;
    }


    function _checkUniqueSignature(address[] memory _uniqueSigners, address _signer) public pure returns (bool) {
        for (uint256 k; k< _uniqueSigners.length; k++) {
            if (_uniqueSigners[k] ==_signer) {
                return false;
            }
        }
        return true;
    }
    /// Helper functions

    /**
    * @notice Set the address of the multisig.
    * @param _gnosisAddress  
    **/
    function setGnosis(address _gnosisAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        gnosis = _gnosisAddress;
    }

    /// @notice Sets the minimum required signatures before data is accepted on L2.
    /// @param _minSigns New value
    function setMinSigns(uint256 _minSigns) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minSigns = _minSigns;
    }
    
    /// @notice Updates all the ibAlluo addresses used when setting APY
    function updateAllIbAlluoAddresses() public {
        address[] memory ibAlluoAddressList = handler.getListOfIbAlluos();
        for (uint256 i; i< ibAlluoAddressList.length; i++) {
            IIbAlluo ibAlluo = IIbAlluo(ibAlluoAddressList[i]);
            ibAlluoSymbolToAddress[ibAlluo.symbol()] = IIbAlluo(ibAlluoAddressList[i]);
        }
    }


    /// @notice Updates specific ibAlluo addresses for symbols when setting APY
    /// @param _ibAlluoAddress Address of the ibAlluo you want to add to the mapping
    function updateSpecificIbAlluoAddress(address _ibAlluoAddress) public {
        IIbAlluo ibAlluo = IIbAlluo(_ibAlluoAddress);
        ibAlluoSymbolToAddress[ibAlluo.symbol()] = ibAlluo;
    }

    function updateStrategyToToken(address _strategy, address _token) public {
        strategyToToken[_strategy] = _token;
    }

    function updatePrimaryToken(address _token) public {
        primaryTokens.push(_token);
    }

    // Helper to simulate L1 Encoding
    /// @notice Simulates what gnosis is doing when calling VoteExecutorMaster
    /// @dev Loops through and just forms the bytes encoded data that VoteExecutorSlave takes as inputs.
    /// @param _hashed Keccak256 Hash of the array of messages we are sending as payload
    /// @param _messages Array of messages encoded with encodemessages()
    /// @return data Bytes encoded data that is used as the payload through anyCall
    function encodeData(bytes32 _hashed, Message[] memory _messages) public pure  returns (bytes memory data) {
        data = abi.encode(
                _hashed,
                _messages
            );
    }


    // Helper to simulate L1 Encoding
    /// @notice Simulates what gnosis is doing when calling VoteExecutorMaster to encode messages
    /// @dev Loops through and just forms the bytes encoded data that VoteExecutorSlave takes as inputs.
    /// @param _commandIndexes Array of action names ("changeAPY");
    /// @param _messages "actions" that are abi.encoded.
    /// @return messagesHash Keccak256 hashed messages used to sign.
    /// @return messages Struct form to input into encodeData

    function encodeAllMessages(uint256[] memory _commandIndexes, bytes[] memory _messages) public pure  returns (bytes32 messagesHash, Message[] memory messages, bytes memory inputData) {
        require(_commandIndexes.length == _messages.length, "Array length mismatch");
        messages = new Message[](_commandIndexes.length);
        for (uint256 i; i < _commandIndexes.length; i++) {
            messages[i] = Message(_commandIndexes[i], _messages[i]);
        }
        messagesHash = keccak256(abi.encode(messages));
        inputData = abi.encode(
                messagesHash,
                messages
            );
    }

    function encodeApyCommand(
        string memory _ibAlluoName, 
        uint256 _newAnnualInterest, 
        uint256 _newInterestPerSecond
    ) public pure  returns (uint256, bytes memory) {
        bytes memory encodedComand = abi.encode(_ibAlluoName, _newAnnualInterest, _newInterestPerSecond);
        return (0, encodedComand);
    }

    function encodeWithdrawCommand(
        string memory _codeName,
        uint256 _delta
    ) public view  returns (uint256, bytes memory) {
        LiquidityDirection memory direction = liquidityDirection[_codeName];
        bytes memory encodedCommand = abi.encode(direction.strategyAddress, _delta, direction.chainId, direction.data);
        return (2, encodedCommand);
    }

    function encodeDepositCommand(
        string memory _codeName,
        uint256 _delta
    ) public view  returns (uint256, bytes memory) {
        LiquidityDirection memory direction = liquidityDirection[_codeName];
        bytes memory encodedCommand = abi.encode(direction.strategyAddress, _delta, direction.chainId, direction.data);
        return (3, encodedCommand);
    }

    function setLiquidityDirection(
        address _strategyAddress,
        uint256 _chainId,
        bytes memory _data,
        string memory _codeName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidityDirection[_codeName] = LiquidityDirection(_strategyAddress, _chainId, _data);
    }

    function _verify(bytes32 data, bytes memory signature, address account) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == account;
    }
    
    /// Admin functions 
    function setAnyCallAddresses(address _newProxyAddress, address _newExecutorAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        anyCallAddress = _newProxyAddress;
        anyCallExecutorAddress = _newExecutorAddress;
    }

    function setVoteExecutorMaster(address _newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        voteExecutorMaster = _newAddress;
    }


    function grantRole(bytes32 role, address account)
    public
    override
    onlyRole(getRoleAdmin(role)) {
        if (role == DEFAULT_ADMIN_ROLE) {
            require(account.isContract(), "Handler: Not contract");
        }
        _grantRole(role, account);
    }

    function changeUpgradeStatus(bool _status)
    external
    onlyRole(DEFAULT_ADMIN_ROLE) {
        upgradeStatus = _status;
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override {
        require(upgradeStatus, "Handler: Upgrade not allowed");
        upgradeStatus = false;
    }
}