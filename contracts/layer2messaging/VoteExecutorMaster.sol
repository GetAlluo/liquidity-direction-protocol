// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "../interfaces/IAlluoToken.sol";
import "../interfaces/ILocker.sol";
import "../interfaces/IGnosis.sol";
import "../interfaces/IAlluoStrategyNew.sol";
import "../interfaces/IMultichain.sol";
import "../interfaces/IAlluoStrategy.sol";
import "../interfaces/IExchange.sol";

contract VoteExecutorMaster is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable {

    using ECDSAUpgradeable for bytes32;
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    address public constant ALLUO = 0x1E5193ccC53f25638Aa22a940af899B692e10B09;
    uint256 public minSigns;
    uint256 public timeLock;
    uint256 public slippage;

    address public gnosis;
    address public locker;
    address public exchangeAddress;

    bool public upgradeStatus;

    SubmittedData[] public submittedData;
    Bridging public bridgingInfo;
    EnumerableSetUpgradeable.AddressSet private primaryTokens;

    mapping(string => LiquidityDirection) public liquidityDirection;
    mapping(address => address) public tokenToAnyToken;
    mapping(address => DepositQueue) public tokenToDepositQueue;
    mapping(bytes32 => uint256) public hashExecutionTime;

    struct Deposit {
        address strategyAddress;
        uint256 amount;
        address strategyPrimaryToken;
        address entryToken;
        bytes data;
    }
    
    struct Bridging{
        address anyCallAddress;
        address multichainRouter;
        address nextChainExecutor;
        uint256 currentChain;
        uint256 nextChain;
    }

    
    struct Message {
        uint256 commandIndex;
        bytes commandData;
    }

    struct SubmittedData {
        bytes data;
        uint256 time;
        bytes[] signs;
    }

    struct DepositQueue {
        Deposit[] depositList;
        uint256 depositNumber;
    }

    struct LiquidityDirection {
        address strategyAddress;
        uint256 chainId;
        bytes entryData;
        bytes exitData;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _multiSigWallet, 
        address _locker
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        require(_multiSigWallet.isContract(), "Handler: Not contract");
        gnosis = _multiSigWallet;
        minSigns = 2;
        // timeLock = _timeLock;
        locker = _locker;
        // bridgingInfo.anyCallAddress = _anyCall;
        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(UPGRADER_ROLE, _multiSigWallet);

        // For tests only
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }


    /// @notice Allows anyone to submit data for execution of votes
    /// @dev Attempts to parse at high level and then confirm hash before submitting to queue
    /// @param data Payload fully encoded as required (see formatting using encoding functions below)

    function submitData(bytes memory data) external {

        (bytes32 hashed, Message[] memory _messages) = abi.decode(data, (bytes32, Message[]));

        require(hashed == keccak256(abi.encode(_messages)), "Hash doesn't match");

        SubmittedData memory newSubmittedData;
        newSubmittedData.data = data;
        newSubmittedData.time = block.timestamp;
        submittedData.push(newSubmittedData);
    }


    /// @notice Allow anyone to approve data for execution given off-chain signatures
    /// @dev Checks against existing sigs submitted and only allow non-duplicate multisig owner signatures to approve the payload
    /// @param _dataId Id of data payload to be approved
    /// @param _signs Array of off-chain EOA signatures to approve the payload.

    function approveSubmittedData(uint256 _dataId, bytes[] memory _signs) external {
        (bytes32 dataHash,) = abi.decode(submittedData[_dataId].data, (bytes32, Message[]));

        address[] memory owners = IGnosis(gnosis).getOwners();

        bytes[] memory submittedSigns = submittedData[_dataId].signs;
        address[] memory uniqueSigners = new address[](owners.length);
        uint256 numberOfSigns;

        for (uint256 i; i< submittedSigns.length; i++) {
            numberOfSigns++;
            uniqueSigners[i]= _getSignerAddress(dataHash, submittedSigns[i]);
        }

        for (uint256 i; i < _signs.length; i++) {
            for (uint256 j; j < owners.length; j++) {
                if(_verify(dataHash, _signs[i], owners[j]) && _checkUniqueSignature(uniqueSigners, owners[j])){
                    submittedData[_dataId].signs.push(_signs[i]);
                    uniqueSigners[numberOfSigns] = owners[j];
                    numberOfSigns++;
                    break;
                }
            }
        }
    }

    function executeSpecificData(uint256 index) external {
            (bytes32 hashed, Message[] memory messages) = abi.decode(submittedData[index].data, (bytes32, Message[]));
            require(submittedData[index].time + timeLock < block.timestamp, "Under timelock");
            require(hashExecutionTime[hashed] == 0 || block.timestamp >= hashExecutionTime[hashed] + 1 days, "Duplicate Hash");

            if(submittedData[index].signs.length >= minSigns){
                for (uint256 j; j < messages.length; j++) {
                    if(messages[j].commandIndex == 1){
                        (uint256 mintAmount, uint256 period) = abi.decode(messages[j].commandData, (uint256, uint256));
                        IAlluoToken(ALLUO).mint(locker, mintAmount);
                        ILocker(locker).setReward(mintAmount / (period * 1 days));
                    }
                    if(messages[j].commandIndex == 2) {
                        // Handle all withdrawals first and then add all deposit actions to an array to be executed afterwards
                        (address strategyAddress, uint256 delta, uint256 chainId, address strategyPrimaryToken, address exitToken, bytes memory data) = abi.decode(messages[j].commandData, (address, uint256, uint256, address,address, bytes));
                        if (chainId == bridgingInfo.currentChain) {
                            IAlluoStrategy(strategyAddress).exitAll(data, delta, strategyPrimaryToken, address(this), false);
                        }

                    }
                    if(messages[j].commandIndex == 3) {
                        // Add all deposits to the queue.
                        (address strategyAddress, uint256 delta, uint256 chainId, address strategyPrimaryToken, address entryToken, bytes memory data) = abi.decode(messages[j].commandData, (address, uint256, uint256, address,address, bytes));
                        if (chainId == bridgingInfo.currentChain) {
                            tokenToDepositQueue[strategyPrimaryToken].depositList.push(Deposit(strategyAddress, delta, strategyPrimaryToken, entryToken, data));
                        }
                    }
                }
                // Execute deposits. Only executes if we have sufficient balances.
                hashExecutionTime[hashed] = block.timestamp;
                bytes memory finalData = abi.encode(submittedData[index].data, submittedData[index].signs);
                IAnyCall(bridgingInfo.anyCallAddress).anyCall(bridgingInfo.nextChainExecutor, finalData, address(0), bridgingInfo.nextChain, 0);
            }     
    }

    function _executeDeposits(bool forward) internal {
        for (uint256 i; i < primaryTokens.length(); i++) {
            DepositQueue memory depositQueue = tokenToDepositQueue[primaryTokens.at(i)];
            Deposit[] memory depositList = depositQueue.depositList;
            uint256 depositNumber = depositQueue.depositNumber;    
            uint256 iters = depositList.length - depositNumber;
            for (uint256 j; j < iters; j++) {
                Deposit memory depositInfo = depositList[depositNumber + j];
                address strategyPrimaryToken = depositInfo.strategyPrimaryToken;
                uint256 tokenAmount = depositInfo.amount / 10**(18 - IERC20MetadataUpgradeable(strategyPrimaryToken).decimals());
                if (depositInfo.entryToken != strategyPrimaryToken) {
                    IERC20MetadataUpgradeable(strategyPrimaryToken).approve(exchangeAddress, tokenAmount);
                    tokenAmount = IExchange(exchangeAddress).exchange(strategyPrimaryToken, depositInfo.entryToken, tokenAmount, tokenAmount * slippage/100000);
                }
                IERC20MetadataUpgradeable(strategyPrimaryToken).safeTransfer(depositInfo.strategyAddress, tokenAmount);
                IAlluoStrategy(depositInfo.strategyAddress).invest(depositInfo.data, tokenAmount);
                tokenToDepositQueue[depositInfo.strategyPrimaryToken].depositNumber++;
            }
        }
    }
    function incrementDepositNumber(address primaryToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenToDepositQueue[primaryToken].depositNumber++;
    }
    
    // Public can only executeDeposits by bridging funds backwards.
    function executeDeposits() public {
        _executeDeposits(false);
    }

    function _bridgeFunds() internal {
        // primaryTokens = eth, usd, eur
        for (uint256 i; i < primaryTokens.length(); i++) {
            uint256 tokenBalance = IERC20MetadataUpgradeable(primaryTokens.at(i)).balanceOf(address(this));
            if ( tokenToDepositQueue[primaryTokens.at(i)].depositList.length ==  tokenToDepositQueue[primaryTokens.at(i)].depositNumber) {
                // Need to approvehere!!!
                IERC20MetadataUpgradeable(primaryTokens.at(i)).approve(bridgingInfo.multichainRouter, tokenBalance);
                IMultichain(bridgingInfo.multichainRouter).anySwapOutUnderlying(tokenToAnyToken[primaryTokens.at(i)], bridgingInfo.nextChainExecutor, tokenBalance, bridgingInfo.nextChain);
                // Mapping  USDC --> anySwapoutUnderlying,  multichianRouter
                //          EURS --> anySwapout  multichainRouterv2
                // mapping(address -> struct)
                // struct = {functionSIgnature, multichainRouter address}
                // 
                // Certain tokens --> different Router address
                //  --> .anySwapOut
                // usdc anyUSDC ---> eurs (anySwapOut)
                // https://bridgeapi.anyswap.exchange/v4/tokenlistv4/250 Fantom
                // https://bridgeapi.anyswap.exchange/v4/tokenlistv4/137 Polygon
                // USDC, EURT, WETH, WBTC
            }
        }
    }

    function bridgeFunds() external {
        _bridgeFunds();
    }

    function getSubmittedData(uint256 _dataId) external view returns(bytes memory, uint256, bytes[] memory){
        SubmittedData memory submittedDataExact = submittedData[_dataId];
        return(submittedDataExact.data, submittedDataExact.time, submittedDataExact.signs);
    }

    function decodeData(bytes memory _data) public pure returns(bytes32, Message[] memory){
        (bytes32 dataHash, Message[] memory messages) = abi.decode(_data, (bytes32, Message[]));
        return (dataHash, messages);
    } 

    function encodeApyCommand(
        string memory _ibAlluoName, 
        uint256 _newAnnualInterest, 
        uint256 _newInterestPerSecond
    ) public pure  returns (uint256, bytes memory) {
        bytes memory encodedCommand = abi.encode(_ibAlluoName, _newAnnualInterest, _newInterestPerSecond);
        return (0, encodedCommand);
    }

    function decodeApyCommand(
        bytes memory _data
    ) public pure returns (string memory, uint256, uint256) {
        return abi.decode(_data, (string, uint256, uint256));
    }

    function encodeMintCommand(
        uint256 _newMintAmount,
        uint256 _period
    ) public pure  returns (uint256, bytes memory) {
        bytes memory encodedCommand = abi.encode(_newMintAmount, _period);
        return (1, encodedCommand);
    }

    function decodeMintCommand(
        bytes memory _data
    ) public pure returns (uint256, uint256) {
        return abi.decode(_data, (uint256, uint256));
    }


   function encodeLiquidityCommand(
        string memory _codeName,
        address _strategyPrimaryToken,
        address _entryToken,
        uint256 _delta,
        bool _isDeposit
    ) public view  returns (uint256, bytes memory) {
        LiquidityDirection memory direction = liquidityDirection[_codeName];
        if(!_isDeposit){
            return (2, abi.encode(direction.strategyAddress, _delta, direction.chainId, _strategyPrimaryToken, _entryToken, direction.exitData));
        }
        else{
            return (3, abi.encode(direction.strategyAddress, _delta, direction.chainId, _strategyPrimaryToken, _entryToken, direction.entryData));
        }
    }
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

    function decodeLiquidityCommand(
        bytes memory _data
    ) public pure returns (address, uint256, uint256, address, bytes memory) {

        return abi.decode(_data, (address, uint256, uint256, address, bytes));
    }


    function _verify(bytes32 data, bytes memory signature, address account) internal pure returns (bool) {
        return data
            .toEthSignedMessageHash()
            .recover(signature) == account;
    }
    function _getSignerAddress(bytes32 data, bytes memory signature) internal pure returns (address) {
        return data
            .toEthSignedMessageHash()
            .recover(signature);
    }
    
    function _checkUniqueSignature(address[] memory _uniqueSigners, address _signer) internal pure returns (bool) {
        for (uint256 k; k< _uniqueSigners.length; k++) {
            if (_uniqueSigners[k] ==_signer) {
                return false;
            }
        }
        return true;
    }
    /// Admin functions 

    /**
    * @notice Set the address of the multisig.
    * @param _gnosisAddress  
    **/
    function setGnosis(address _gnosisAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        gnosis = _gnosisAddress;
    }

    function setLocker(address _lockerAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        locker = _lockerAddress;
    }

    /// @notice Sets the minimum required signatures before data is accepted on L2.
    /// @param _minSigns New value
    function setMinSigns(uint256 _minSigns) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minSigns = _minSigns;
    }

    function setBridgingInfo(address _anyCallAddress, address _multichainRouter,address _nextChainExecutor,uint256 _currentChain, uint256 _nextChain) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bridgingInfo = Bridging(_anyCallAddress, _multichainRouter, _nextChainExecutor, _currentChain, _nextChain);
    }

    function setTokenToAnyToken(address _token, address _anyToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenToAnyToken[_token] = _anyToken;
    }

    function setLiquidityDirection(string memory _codeName, address _strategyAddress, uint256 _chainId, bytes memory _entryData, bytes memory _exitData) external onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidityDirection[_codeName] = LiquidityDirection(_strategyAddress, _chainId, _entryData, _exitData);
    }

    function addPrimaryToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        primaryTokens.add(_token);
    }
    function removePrimaryToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        primaryTokens.remove(_token);
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

    function changeTimeLock(uint256 _newTimeLock)
    external
    onlyRole(DEFAULT_ADMIN_ROLE) {
        timeLock = _newTimeLock;
    }
    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override {
        require(upgradeStatus, "Handler: Upgrade not allowed");
        upgradeStatus = false;
    }

    function multicall(
        address[] calldata destinations,
        bytes[] calldata calldatas
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 length = destinations.length;
        for (uint256 i = 0; i < length; i++) {
            destinations[i].functionCall(calldatas[i]);
        }
    }
}


interface IAnyCall {
    function anyCall(address _to, bytes calldata _data, address _fallback, uint256 _toChainID, uint256 _flags) external;

}