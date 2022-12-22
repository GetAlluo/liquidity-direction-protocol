//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../../../interfaces/ILiquidityHandler.sol";
import "../../../interfaces/IHandlerAdapter.sol";


contract BufferManager is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable 
    { 
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    bool public upgradeStatus;
   
    // address of the anycall contract on polygon
    address public anycall;
    // adress of the Across bridge contract to initiate the swap
    address public spokepool;
    uint256 public epochDuration;
    address public gnosis;
    // address of the DepositDistributor on mainnet
    address public distributor;
    
    // bridge settings
    uint256 public minBridgeAmount;
    uint256 public lastExecuted;
    uint256 public bridgeInterval;
    uint256 public relayerFeePct;

    bytes32 constant public UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 constant public GELATO = keccak256("GELATO");
    bytes32 constant public SWAPPER = keccak256("SWAPPER");
    
    // liquidity handler
    ILiquidityHandler public handler;

    mapping(address => Epoch[]) public ibAlluoToEpoch;
    mapping(address => address) public ibAlluoToAdapter;
    mapping(address => uint256) public ibAlluoToMaxRefillPerEpoch;
    mapping(address => address) public tokenToEth;

    EnumerableSetUpgradeable.AddressSet private activeIbAlluos;

    struct Epoch {
        uint256 startTime;
        uint256 refilledPerEpoch;
    }
     
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}
    
    /**
    * @dev 
    * param _epochDuration Value for refill function to work properly
    * param _bridgeGenesis Unix timestamp declaring a starting point for counter
    * param _bridgeInterval Min time to pass between bridging (UNIX timestamp)
    * param _minBridgeAmount Min amount of asset to allow bridging
    * param _gnosis Gnosis Multisig
    * param _gelato Gelato executor address
    * param _spokepool Address of the SpokePool Polygon contract of Accross Protocol Bridge
    * param _anycall Address of the Multichain Anycall contract
    * param _distributor Address of the DepositDistritor contract on mainnet, which receives the bridged funds
    */
    function initialize(
        uint256 _epochDuration,
        uint256 _brigeGenesis,
        uint256 _bridgeInterval,
        uint256 _minBridgeAmount,
        address _gnosis,
        address _gelato,
        address _spokepool,
        address _anycall,
        address _distributor
    ) public initializer {
       
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        epochDuration = _epochDuration;
        distributor = _distributor;
        lastExecuted = _brigeGenesis;
        bridgeInterval = _bridgeInterval;
        minBridgeAmount = _minBridgeAmount;

        spokepool = _spokepool;
        anycall = _anycall;
        gnosis = _gnosis;

        _grantRole(DEFAULT_ADMIN_ROLE, _gnosis);
        _grantRole(UPGRADER_ROLE, _gnosis);
        _grantRole(GELATO, _gelato);
        _grantRole(SWAPPER, _gelato);
        _grantRole(SWAPPER, _gnosis);
    }

    /** 
    * @notice Initiates transfer only if adapter is filled, there are no queued withdrawals and 
    * balance of this contract exceeds the minimum required mark
    * @dev Function checker for gelato, after the balance crosses the threshold initates the swap function
    * @dev Checks minimumBridging amout, attempts to reffil the adapters
    * @return canExec Bool, if true - initiates the call by gelato
    * @return execPayload Data to be called by gelato
    */
    function checker() 
        external
        view
        returns(bool canExec, bytes memory execPayload) 
    {
        for(uint256 i; i < activeIbAlluos.length(); i++) {
            address iballuo = activeIbAlluos.at(i);
            (,address token) = IHandlerAdapter(ibAlluoToAdapter[iballuo]).getCoreTokens();
            uint256 amount = IERC20Upgradeable(token).balanceOf(address(this));
            if(adapterRequiredRefill(iballuo) == 0) {
                if(canBridge(token, amount)) {
                        canExec = true;
                        execPayload = abi.encodeWithSelector(
                        BufferManager.swap.selector,
                        amount,
                        token,
                        relayerFeePct,
                        iballuo
                        );

                    break; 
                }
            } else if (canRefill(iballuo, token)) {
                    canExec = true;
                    execPayload = abi.encodeWithSelector(
                    BufferManager.refillBuffer.selector,
                    iballuo
                    );

                break;
            }
        }
        return (canExec, execPayload);
    }

    /**
    * @notice Function is called by gelato resolver,when checker flags it. Can only be called by
    * either Gelato or Multisig, in order to prevent malicious actions
    * @dev Bridges assets using Across Bridge and info about the amounts using Multichain AnyCallV6
    * @param amount Amount of the funds to be transferred
    * @param relayerFeePct Fee percantage for relayers on Across bridge side
    */
    function swap(uint256 amount, address originToken, uint64 relayerFeePct) external onlyRole(SWAPPER) {
        require(amount >= 700 * 10 ** IERC20MetadataUpgradeable(originToken).decimals(), "Swap: <minAmount!");
        require(block.timestamp >= lastExecuted + bridgeInterval, "Swap: <minInterval!");
        
        IERC20Upgradeable(originToken).approve(spokepool, amount);
        lastExecuted = block.timestamp;   
        ISpokePool(spokepool).deposit(distributor, originToken, amount, 1, relayerFeePct, uint32(block.timestamp));
        address tokenEth = tokenToEth[originToken];
        CallProxy(anycall).anyCall(
            // address of the collector contract on mainnet
            distributor,
            abi.encode(
                tokenEth,
                amount
            ),
            address(0),
            1,
            // 0 flag to pay fee on destination chain
            0
            );   
    }
    
    /**
    * @dev Function serves as a leverage in case a swap gets stuck. Only called manually by multisig.
    * @param newRelayerFeePct Relayer fee Pct to be updated
    * @param depositId ID of the deposit to be sped up, needs to be accessed from the event emitted by
    * the swap call
    * @param depositorSignature Signed message containing the depositor address, this contract chain ID, the updated
    * relayer fee %, and the deposit ID. This signature is produced by signing a hash of data according to the
    * EIP-1271 standard.
    */
    function speedUp(uint64 newRelayerFeePct, uint32 depositId, bytes memory depositorSignature) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ISpokePool(spokepool).speedUpDeposit(
            address(this),
            newRelayerFeePct,
            depositId,
            depositorSignature
        );
    }
    
    /**
    * @dev Function checks if IBAlluos respective adapter has queued withdrawals
    * @param _ibAlluo Address of the IBAlluo pool 
    * @return True if there is a pending withdrawal on correspoding to an IBAlluo pool adapter
    */
    function isAdapterPendingWithdrawal(address _ibAlluo) public view returns (bool) {
        (,,uint256 totalWithdrawalAmount,) = handler.ibAlluoToWithdrawalSystems(_ibAlluo);
        if (totalWithdrawalAmount > 0) {
            return true;
        } 
        return false;
    }
    
    /**
    * @notice Function checks the amount of asset that needs to be transferred for an adapter to be filled
    * @param _ibAlluo Address of an IBAlluo contract, which corresponding adapter is to be filled
    */
    function adapterRequiredRefill(address _ibAlluo) public view returns (uint256) {
        uint256 expectedAmount = handler.getExpectedAdapterAmount(_ibAlluo, 0);
        uint256 actualAmount = handler.getAdapterAmount(_ibAlluo);
        if (actualAmount < expectedAmount) {
            // Think of case if someone tries to break it by sending extra tokens to the buffer directly
            uint256 difference = expectedAmount - actualAmount;
            if (difference * 10000 / expectedAmount > 500) {
                return difference;
            }
        } else {
            return 0; 
        }
    }
    
    /**
    * @dev Function returns relevant refill settings by IBAlluo address
    * @param _ibAlluo address of the IBAlluo
    * @return Epoch struct with settings
    */
    function _confirmEpoch(address _ibAlluo) internal returns (Epoch storage) {
        Epoch[] storage relevantEpochs = ibAlluoToEpoch[_ibAlluo];
        Epoch storage lastEpoch = relevantEpochs[relevantEpochs.length - 1];
        uint256 deadline = lastEpoch.startTime + epochDuration;
        if (block.timestamp > deadline) {
            uint256 cycles = (block.timestamp - deadline) / epochDuration;
            uint256 newStartTime = lastEpoch.startTime + (cycles * epochDuration);
            Epoch memory newEpoch = Epoch(newStartTime, 0);
            ibAlluoToEpoch[_ibAlluo].push(newEpoch);
        } 
        // This should work because we are pointing at a specific memory slot.
        Epoch storage finalEpoch = relevantEpochs[relevantEpochs.length - 1];
        return finalEpoch;
    }


    /**
    * @dev Refills corresponding IBAlluo adapter with prior checks and triggers executing queued withdrawals on the adapter
    * @param _ibAlluo address of corresponding IBAlluo
    */
    function refillBuffer(address _ibAlluo) external onlyRole(GELATO) returns (bool) {
        address adapterAddress = ibAlluoToAdapter[_ibAlluo];
        (address bufferToken,) = IHandlerAdapter(adapterAddress).getCoreTokens();
        uint256 totalAmount = adapterRequiredRefill(_ibAlluo);

        require(totalAmount > 0, "No refill required");

        uint256 bufferBalance = IERC20Upgradeable(bufferToken).balanceOf(address(this));
        uint256 gnosisAmount = totalAmount - bufferBalance;
        uint256 bufferAmount = totalAmount;
        if(gnosisAmount >= totalAmount * 5 / 100) {
            // if(gnosisAmount < totalAmount) {
            //     require(gnosisAmount <= totalAmount * 5 / 100, "Refill: Buffer <5pct");
            // }
            require((IERC20Upgradeable(bufferToken)).balanceOf(gnosis) >= gnosisAmount, "Refill: Gnosis low on funds");
            bufferAmount = totalAmount - gnosisAmount;
            require(bufferAmount <= bufferBalance, "Refill: gnosisAmount below treshold");

            Epoch storage currentEpoch = _confirmEpoch(_ibAlluo);

            require(ibAlluoToMaxRefillPerEpoch[_ibAlluo] >= currentEpoch.refilledPerEpoch + gnosisAmount, "Cumulative refills exceeds limit");

            currentEpoch.refilledPerEpoch += totalAmount;
            IERC20Upgradeable(bufferToken).transferFrom(gnosis, adapterAddress, gnosisAmount);
            
        }
        if(bufferAmount > 0) {
            IERC20Upgradeable(bufferToken).transfer(adapterAddress, bufferAmount);
            if (isAdapterPendingWithdrawal(_ibAlluo)) {
                handler.satisfyAdapterWithdrawals(_ibAlluo);
                return true;
            }
        }
        return false;
    }

    function canBridge(address token, uint256 amount) public view returns(bool) {
        if(amount >= minBridgeAmount * 10 ** IERC20MetadataUpgradeable(token).decimals()) {
            if(block.timestamp >= lastExecuted + bridgeInterval) {
                return true;
            }    
        } 
        return false;
    }

    function canRefill(address _iballuo, address token) public view returns(bool) {
        uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));
        uint256 decDif = 18 - IERC20MetadataUpgradeable(token).decimals();
        uint256 gnosisBalance = IERC20Upgradeable(token).balanceOf(gnosis);
        if(decDif > 0){
            balance = balance * 10 ** decDif;
            gnosisBalance = gnosisBalance * 10 ** decDif;
        }
        uint256 refill = adapterRequiredRefill(_iballuo);
        if(refill > 0){
            if(refill < balance) {
                return true;
                }
                if(refill < gnosisBalance + balance) {
                return true;
            }
        }
        return false;
    }
    
    /**
    * @notice Initialize function faces stack too deep error, due to too many arguments
    * @param _activeIbAlluos Array of IBAlluo contract supported for bridging
    * @param _ibAlluoAdapters Array of corresponding Adapters
    * @param _ibAlluoTokens Tokens to be support for each of the adapters
    * @param _tokensEth Addresses of the same tokens on mainnet
    * @param _maxRefillPerEpoch Max value of asset for an adapter to be filled in span of a predefined interval
    */
    function initializeValues (
        address _handler,
        address[] memory _activeIbAlluos,
        address[] memory _ibAlluoAdapters,
        address[] memory _ibAlluoTokens,
        address[] memory _tokensEth,
        uint256[] memory _maxRefillPerEpoch,
        uint256 _epochDuration) public onlyRole(DEFAULT_ADMIN_ROLE) {
            handler = ILiquidityHandler(_handler);
            for (uint256 i; i < _activeIbAlluos.length; i++) {
                activeIbAlluos.add(_activeIbAlluos[i]);
                ibAlluoToAdapter[_activeIbAlluos[i]] = _ibAlluoAdapters[i];
                tokenToEth[_activeIbAlluos[i]] = _tokensEth[i];
                ibAlluoToMaxRefillPerEpoch[_activeIbAlluos[i]] = _maxRefillPerEpoch[i];
                epochDuration = _epochDuration;

                Epoch memory newEpoch = Epoch(_epochDuration, 0);
                ibAlluoToEpoch[_activeIbAlluos[i]].push(newEpoch);
        }
    }
    
    /* ========== ADMIN CONFIGURATION ========== */

    /**
    * @dev Admin function to change bridge settings
    * @param _minBridgeAmount minimum threshold in usd, crossing which should allow bridging funds
    * @param _bridgeInterval interval in seconds, to put limitations for an amount to be bridged 
    */
    function changeBridgeSettings(uint256 _minBridgeAmount, uint256 _bridgeInterval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minBridgeAmount = _minBridgeAmount;
        bridgeInterval = _bridgeInterval;
    }

    function setRelayerFeePct(uint256 _relayerFeePct) external onlyRole(DEFAULT_ADMIN_ROLE) {
        relayerFeePct = _relayerFeePct;
    }
    
    /**
    * @notice Needed for bridging
    * @dev Admin function to change the address of the respective token on Mainnet
    * @param _token address of the token on Polygon
    * @param _tokenEth address of the same token on Mainnet
    */
    function setEthToken(address _token, address _tokenEth) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenToEth[_token] = _tokenEth;
    }
    /**
    * @dev Admin function for setting max amount an adapter can be refilled per interval
    * @param _ibAlluo address of the IBAlluo of the respective adapter
    * @param _maxRefillPerEpoch max amount to be refilled
    */
    function setMaxRefillPerEpoch(address _ibAlluo, uint256 _maxRefillPerEpoch) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ibAlluoToMaxRefillPerEpoch[_ibAlluo] = _maxRefillPerEpoch;
    }

    /**
    * @dev Admin function for setting the aforementioned interval
    * @param _epochDuration time of the epoch in seconds
    */
    function setEpochDuration(uint256 _epochDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        epochDuration = _epochDuration;
    }

    /**
    * @notice Function is called by gnosis
    * @dev Adds IBAlluo pool to the list of active pools
    * @param ibAlluo Address of the IBAlluo pool to be added
    */
    function addIBAlluoPool(address ibAlluo, address adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!activeIbAlluos.contains(ibAlluo), "Already active");

        activeIbAlluos.add(ibAlluo);
        ibAlluoToAdapter[ibAlluo] = adapter;
    }
    
    /**
    * @notice Funtion is called by gnosis
    * @dev Removes IBAlluo pool from the list of active pools
    * @param ibAlluo Address of the IBAlluo pool to be removed
    */
    function removeIBAlluoPool(address ibAlluo) external onlyRole(DEFAULT_ADMIN_ROLE) returns(bool) {
        bool removed;
        for(uint256 i=0; i< activeIbAlluos.length(); i++) {
            if(activeIbAlluos.at(i) == ibAlluo) {
                activeIbAlluos.remove(activeIbAlluos.at(i));
                ibAlluoToAdapter[ibAlluo] = address(0);
                removed = true;
            } 
        }
        return removed;
    }
    
    function changeUpgradeStatus(bool _status)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        upgradeStatus = _status;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {
        require(upgradeStatus, "Manager: Upgrade not allowed");
        upgradeStatus = false;
    }
}

interface CallProxy {
    function anyCall(
        address _to,
        bytes calldata _data,
        address _fallback,
        uint256 _toChainID,
        uint256 _flags
    ) external;
}

interface ISpokePool {
    function deposit(
        address recipient,
        address originToken,
        uint256 amount,
        uint256 destinationChainId,
        uint64 relayerFeePct,
        uint32 quoteTimestamp
    ) external payable;

    function speedUpDeposit(
        address depositor,
        uint64 newRelayerFeePct,
        uint32 depositId,
        bytes memory depositorSignature
    ) external;
}