// SPDX-License-Identifier: UNLICENSED
// !! THIS FILE WAS AUTOGENERATED BY abi-to-sol v0.6.6. SEE SOURCE BELOW. !!
pragma solidity ^0.8.4;

interface ISpokePoolNew {
    error NotCrossChainCall();
    event AdminChanged(address previousAdmin, address newAdmin);
    event BeaconUpgraded(address indexed beacon);
    event EmergencyDeleteRootBundle(uint256 indexed rootBundleId);
    event EnabledDepositRoute(
        address indexed originToken,
        uint256 indexed destinationChainId,
        bool enabled
    );
    event ExecutedRelayerRefundRoot(
        uint256 amountToReturn,
        uint256 indexed chainId,
        uint256[] refundAmounts,
        uint32 indexed rootBundleId,
        uint32 indexed leafId,
        address l2TokenAddress,
        address[] refundAddresses,
        address caller
    );
    event FilledRelay(
        uint256 amount,
        uint256 totalFilledAmount,
        uint256 fillAmount,
        uint256 repaymentChainId,
        uint256 indexed originChainId,
        uint256 destinationChainId,
        int64 relayerFeePct,
        int64 realizedLpFeePct,
        uint32 indexed depositId,
        address destinationToken,
        address relayer,
        address indexed depositor,
        address recipient,
        bytes message,
        SpokePool.RelayExecutionInfo updatableRelayData
    );
    event FundsDeposited(
        uint256 amount,
        uint256 originChainId,
        uint256 indexed destinationChainId,
        int64 relayerFeePct,
        uint32 indexed depositId,
        uint32 quoteTimestamp,
        address originToken,
        address recipient,
        address indexed depositor,
        bytes message
    );
    event Initialized(uint8 version);
    event OptimismTokensBridged(
        address indexed l2Token,
        address target,
        uint256 numberOfTokensBridged,
        uint256 l1Gas
    );
    event PausedDeposits(bool isPaused);
    event PausedFills(bool isPaused);
    event RefundRequested(
        address indexed relayer,
        address refundToken,
        uint256 amount,
        uint256 indexed originChainId,
        uint256 destinationChainId,
        int64 realizedLpFeePct,
        uint32 indexed depositId,
        uint256 fillBlock,
        uint256 previousIdenticalRequests
    );
    event RelayedRootBundle(
        uint32 indexed rootBundleId,
        bytes32 indexed relayerRefundRoot,
        bytes32 indexed slowRelayRoot
    );
    event RequestedSpeedUpDeposit(
        int64 newRelayerFeePct,
        uint32 indexed depositId,
        address indexed depositor,
        address updatedRecipient,
        bytes updatedMessage,
        bytes depositorSignature
    );
    event SetDepositQuoteTimeBuffer(uint32 newBuffer);
    event SetHubPool(address indexed newHubPool);
    event SetL1Gas(uint32 indexed newL1Gas);
    event SetL2TokenBridge(
        address indexed l2Token,
        address indexed tokenBridge
    );
    event SetXDomainAdmin(address indexed newAdmin);
    event TokensBridged(
        uint256 amountToReturn,
        uint256 indexed chainId,
        uint32 indexed leafId,
        address indexed l2TokenAddress,
        address caller
    );
    event Upgraded(address indexed implementation);

    function MAX_TRANSFER_SIZE() external view returns (uint256);

    function SLOW_FILL_MAX_TOKENS_TO_SEND() external view returns (uint256);

    function UPDATE_DEPOSIT_DETAILS_HASH() external view returns (bytes32);

    function __OvmSpokePool_init(
        uint32 _initialDepositId,
        address _crossDomainAdmin,
        address _hubPool,
        address _l2Eth,
        address _wrappedNativeToken
    ) external;

    function __SpokePool_init(
        uint32 _initialDepositId,
        address _crossDomainAdmin,
        address _hubPool,
        address _wrappedNativeTokenAddress
    ) external;

    function chainId() external view returns (uint256);

    function crossDomainAdmin() external view returns (address);

    function deposit(
        address recipient,
        address originToken,
        uint256 amount,
        uint256 destinationChainId,
        int64 relayerFeePct,
        uint32 quoteTimestamp,
        bytes memory message,
        uint256 maxCount
    ) external payable;

    function depositCounter(address) external view returns (uint256);

    function depositQuoteTimeBuffer() external view returns (uint32);

    function emergencyDeleteRootBundle(uint256 rootBundleId) external;

    function enabledDepositRoutes(
        address,
        uint256
    ) external view returns (bool);

    function executeRelayerRefundLeaf(
        uint32 rootBundleId,
        SpokePoolInterface.RelayerRefundLeaf memory relayerRefundLeaf,
        bytes32[] memory proof
    ) external;

    function executeSlowRelayLeaf(
        address depositor,
        address recipient,
        address destinationToken,
        uint256 totalRelayAmount,
        uint256 originChainId,
        int64 realizedLpFeePct,
        int64 relayerFeePct,
        uint32 depositId,
        uint32 rootBundleId,
        bytes memory message,
        int256 payoutAdjustment,
        bytes32[] memory proof
    ) external;

    function fillCounter(address) external view returns (uint256);

    function fillRelay(
        address depositor,
        address recipient,
        address destinationToken,
        uint256 amount,
        uint256 maxTokensToSend,
        uint256 repaymentChainId,
        uint256 originChainId,
        int64 realizedLpFeePct,
        int64 relayerFeePct,
        uint32 depositId,
        bytes memory message,
        uint256 maxCount
    ) external;

    function fillRelayWithUpdatedDeposit(
        address depositor,
        address recipient,
        address updatedRecipient,
        address destinationToken,
        uint256 amount,
        uint256 maxTokensToSend,
        uint256 repaymentChainId,
        uint256 originChainId,
        int64 realizedLpFeePct,
        int64 relayerFeePct,
        int64 updatedRelayerFeePct,
        uint32 depositId,
        bytes memory message,
        bytes memory updatedMessage,
        bytes memory depositorSignature,
        uint256 maxCount
    ) external;

    function getCurrentTime() external view returns (uint256);

    function hubPool() external view returns (address);

    function initialize(
        uint32 _initialDepositId,
        address _crossDomainAdmin,
        address _hubPool
    ) external;

    function l1Gas() external view returns (uint32);

    function l2Eth() external view returns (address);

    function messenger() external view returns (address);

    function multicall(
        bytes[] memory data
    ) external returns (bytes[] memory results);

    function numberOfDeposits() external view returns (uint32);

    function pauseDeposits(bool pause) external;

    function pauseFills(bool pause) external;

    function pausedDeposits() external view returns (bool);

    function pausedFills() external view returns (bool);

    function proxiableUUID() external view returns (bytes32);

    function refundsRequested(bytes32) external view returns (uint256);

    function relayFills(bytes32) external view returns (uint256);

    function relayRootBundle(
        bytes32 relayerRefundRoot,
        bytes32 slowRelayRoot
    ) external;

    function requestRefund(
        address refundToken,
        uint256 amount,
        uint256 originChainId,
        uint256 destinationChainId,
        int64 realizedLpFeePct,
        uint32 depositId,
        uint256 fillBlock,
        uint256 maxCount
    ) external;

    function rootBundles(
        uint256
    ) external view returns (bytes32 slowRelayRoot, bytes32 relayerRefundRoot);

    function setCrossDomainAdmin(address newCrossDomainAdmin) external;

    function setDepositQuoteTimeBuffer(
        uint32 newDepositQuoteTimeBuffer
    ) external;

    function setEnableRoute(
        address originToken,
        uint256 destinationChainId,
        bool enabled
    ) external;

    function setHubPool(address newHubPool) external;

    function setL1GasLimit(uint32 newl1Gas) external;

    function setTokenBridge(address l2Token, address tokenBridge) external;

    function speedUpDeposit(
        address depositor,
        int64 updatedRelayerFeePct,
        uint32 depositId,
        address updatedRecipient,
        bytes memory updatedMessage,
        bytes memory depositorSignature
    ) external;

    function tokenBridges(address) external view returns (address);

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(
        address newImplementation,
        bytes memory data
    ) external payable;

    function wrappedNativeToken() external view returns (address);

    receive() external payable;
}

interface SpokePool {
    struct RelayExecutionInfo {
        address recipient;
        bytes message;
        int64 relayerFeePct;
        bool isSlowRelay;
        int256 payoutAdjustmentPct;
    }
}

interface SpokePoolInterface {
    struct RelayerRefundLeaf {
        uint256 amountToReturn;
        uint256 chainId;
        uint256[] refundAmounts;
        uint32 leafId;
        address l2TokenAddress;
        address[] refundAddresses;
    }
}

// THIS FILE WAS AUTOGENERATED FROM THE FOLLOWING ABI JSON:
/*
[{"inputs":[],"name":"NotCrossChainCall","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"previousAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"}],"name":"AdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"beacon","type":"address"}],"name":"BeaconUpgraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"rootBundleId","type":"uint256"}],"name":"EmergencyDeleteRootBundle","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"originToken","type":"address"},{"indexed":true,"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"EnabledDepositRoute","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountToReturn","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"chainId","type":"uint256"},{"indexed":false,"internalType":"uint256[]","name":"refundAmounts","type":"uint256[]"},{"indexed":true,"internalType":"uint32","name":"rootBundleId","type":"uint32"},{"indexed":true,"internalType":"uint32","name":"leafId","type":"uint32"},{"indexed":false,"internalType":"address","name":"l2TokenAddress","type":"address"},{"indexed":false,"internalType":"address[]","name":"refundAddresses","type":"address[]"},{"indexed":false,"internalType":"address","name":"caller","type":"address"}],"name":"ExecutedRelayerRefundRoot","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalFilledAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"fillAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"repaymentChainId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"originChainId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"indexed":false,"internalType":"int64","name":"relayerFeePct","type":"int64"},{"indexed":false,"internalType":"int64","name":"realizedLpFeePct","type":"int64"},{"indexed":true,"internalType":"uint32","name":"depositId","type":"uint32"},{"indexed":false,"internalType":"address","name":"destinationToken","type":"address"},{"indexed":false,"internalType":"address","name":"relayer","type":"address"},{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"bytes","name":"message","type":"bytes"},{"components":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"bytes","name":"message","type":"bytes"},{"internalType":"int64","name":"relayerFeePct","type":"int64"},{"internalType":"bool","name":"isSlowRelay","type":"bool"},{"internalType":"int256","name":"payoutAdjustmentPct","type":"int256"}],"indexed":false,"internalType":"struct SpokePool.RelayExecutionInfo","name":"updatableRelayData","type":"tuple"}],"name":"FilledRelay","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"originChainId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"indexed":false,"internalType":"int64","name":"relayerFeePct","type":"int64"},{"indexed":true,"internalType":"uint32","name":"depositId","type":"uint32"},{"indexed":false,"internalType":"uint32","name":"quoteTimestamp","type":"uint32"},{"indexed":false,"internalType":"address","name":"originToken","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"bytes","name":"message","type":"bytes"}],"name":"FundsDeposited","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"l2Token","type":"address"},{"indexed":false,"internalType":"address","name":"target","type":"address"},{"indexed":false,"internalType":"uint256","name":"numberOfTokensBridged","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"l1Gas","type":"uint256"}],"name":"OptimismTokensBridged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"isPaused","type":"bool"}],"name":"PausedDeposits","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"isPaused","type":"bool"}],"name":"PausedFills","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"relayer","type":"address"},{"indexed":false,"internalType":"address","name":"refundToken","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"originChainId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"indexed":false,"internalType":"int64","name":"realizedLpFeePct","type":"int64"},{"indexed":true,"internalType":"uint32","name":"depositId","type":"uint32"},{"indexed":false,"internalType":"uint256","name":"fillBlock","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"previousIdenticalRequests","type":"uint256"}],"name":"RefundRequested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint32","name":"rootBundleId","type":"uint32"},{"indexed":true,"internalType":"bytes32","name":"relayerRefundRoot","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"slowRelayRoot","type":"bytes32"}],"name":"RelayedRootBundle","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"int64","name":"newRelayerFeePct","type":"int64"},{"indexed":true,"internalType":"uint32","name":"depositId","type":"uint32"},{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"address","name":"updatedRecipient","type":"address"},{"indexed":false,"internalType":"bytes","name":"updatedMessage","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"depositorSignature","type":"bytes"}],"name":"RequestedSpeedUpDeposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint32","name":"newBuffer","type":"uint32"}],"name":"SetDepositQuoteTimeBuffer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newHubPool","type":"address"}],"name":"SetHubPool","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint32","name":"newL1Gas","type":"uint32"}],"name":"SetL1Gas","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"l2Token","type":"address"},{"indexed":true,"internalType":"address","name":"tokenBridge","type":"address"}],"name":"SetL2TokenBridge","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newAdmin","type":"address"}],"name":"SetXDomainAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountToReturn","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"chainId","type":"uint256"},{"indexed":true,"internalType":"uint32","name":"leafId","type":"uint32"},{"indexed":true,"internalType":"address","name":"l2TokenAddress","type":"address"},{"indexed":false,"internalType":"address","name":"caller","type":"address"}],"name":"TokensBridged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"implementation","type":"address"}],"name":"Upgraded","type":"event"},{"inputs":[],"name":"MAX_TRANSFER_SIZE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SLOW_FILL_MAX_TOKENS_TO_SEND","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"UPDATE_DEPOSIT_DETAILS_HASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32","name":"_initialDepositId","type":"uint32"},{"internalType":"address","name":"_crossDomainAdmin","type":"address"},{"internalType":"address","name":"_hubPool","type":"address"},{"internalType":"address","name":"_l2Eth","type":"address"},{"internalType":"address","name":"_wrappedNativeToken","type":"address"}],"name":"__OvmSpokePool_init","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint32","name":"_initialDepositId","type":"uint32"},{"internalType":"address","name":"_crossDomainAdmin","type":"address"},{"internalType":"address","name":"_hubPool","type":"address"},{"internalType":"address","name":"_wrappedNativeTokenAddress","type":"address"}],"name":"__SpokePool_init","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"chainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"crossDomainAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"address","name":"originToken","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"internalType":"int64","name":"relayerFeePct","type":"int64"},{"internalType":"uint32","name":"quoteTimestamp","type":"uint32"},{"internalType":"bytes","name":"message","type":"bytes"},{"internalType":"uint256","name":"maxCount","type":"uint256"}],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"depositCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"depositQuoteTimeBuffer","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rootBundleId","type":"uint256"}],"name":"emergencyDeleteRootBundle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"enabledDepositRoutes","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32","name":"rootBundleId","type":"uint32"},{"components":[{"internalType":"uint256","name":"amountToReturn","type":"uint256"},{"internalType":"uint256","name":"chainId","type":"uint256"},{"internalType":"uint256[]","name":"refundAmounts","type":"uint256[]"},{"internalType":"uint32","name":"leafId","type":"uint32"},{"internalType":"address","name":"l2TokenAddress","type":"address"},{"internalType":"address[]","name":"refundAddresses","type":"address[]"}],"internalType":"struct SpokePoolInterface.RelayerRefundLeaf","name":"relayerRefundLeaf","type":"tuple"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}],"name":"executeRelayerRefundLeaf","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"depositor","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"address","name":"destinationToken","type":"address"},{"internalType":"uint256","name":"totalRelayAmount","type":"uint256"},{"internalType":"uint256","name":"originChainId","type":"uint256"},{"internalType":"int64","name":"realizedLpFeePct","type":"int64"},{"internalType":"int64","name":"relayerFeePct","type":"int64"},{"internalType":"uint32","name":"depositId","type":"uint32"},{"internalType":"uint32","name":"rootBundleId","type":"uint32"},{"internalType":"bytes","name":"message","type":"bytes"},{"internalType":"int256","name":"payoutAdjustment","type":"int256"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}],"name":"executeSlowRelayLeaf","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"fillCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"depositor","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"address","name":"destinationToken","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"maxTokensToSend","type":"uint256"},{"internalType":"uint256","name":"repaymentChainId","type":"uint256"},{"internalType":"uint256","name":"originChainId","type":"uint256"},{"internalType":"int64","name":"realizedLpFeePct","type":"int64"},{"internalType":"int64","name":"relayerFeePct","type":"int64"},{"internalType":"uint32","name":"depositId","type":"uint32"},{"internalType":"bytes","name":"message","type":"bytes"},{"internalType":"uint256","name":"maxCount","type":"uint256"}],"name":"fillRelay","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"depositor","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"address","name":"updatedRecipient","type":"address"},{"internalType":"address","name":"destinationToken","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"maxTokensToSend","type":"uint256"},{"internalType":"uint256","name":"repaymentChainId","type":"uint256"},{"internalType":"uint256","name":"originChainId","type":"uint256"},{"internalType":"int64","name":"realizedLpFeePct","type":"int64"},{"internalType":"int64","name":"relayerFeePct","type":"int64"},{"internalType":"int64","name":"updatedRelayerFeePct","type":"int64"},{"internalType":"uint32","name":"depositId","type":"uint32"},{"internalType":"bytes","name":"message","type":"bytes"},{"internalType":"bytes","name":"updatedMessage","type":"bytes"},{"internalType":"bytes","name":"depositorSignature","type":"bytes"},{"internalType":"uint256","name":"maxCount","type":"uint256"}],"name":"fillRelayWithUpdatedDeposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getCurrentTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"hubPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32","name":"_initialDepositId","type":"uint32"},{"internalType":"address","name":"_crossDomainAdmin","type":"address"},{"internalType":"address","name":"_hubPool","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"l1Gas","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"l2Eth","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"messenger","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"numberOfDeposits","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"pause","type":"bool"}],"name":"pauseDeposits","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"pause","type":"bool"}],"name":"pauseFills","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"pausedDeposits","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pausedFills","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxiableUUID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"refundsRequested","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"relayFills","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"relayerRefundRoot","type":"bytes32"},{"internalType":"bytes32","name":"slowRelayRoot","type":"bytes32"}],"name":"relayRootBundle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"refundToken","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"originChainId","type":"uint256"},{"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"internalType":"int64","name":"realizedLpFeePct","type":"int64"},{"internalType":"uint32","name":"depositId","type":"uint32"},{"internalType":"uint256","name":"fillBlock","type":"uint256"},{"internalType":"uint256","name":"maxCount","type":"uint256"}],"name":"requestRefund","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"rootBundles","outputs":[{"internalType":"bytes32","name":"slowRelayRoot","type":"bytes32"},{"internalType":"bytes32","name":"relayerRefundRoot","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newCrossDomainAdmin","type":"address"}],"name":"setCrossDomainAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint32","name":"newDepositQuoteTimeBuffer","type":"uint32"}],"name":"setDepositQuoteTimeBuffer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"originToken","type":"address"},{"internalType":"uint256","name":"destinationChainId","type":"uint256"},{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setEnableRoute","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newHubPool","type":"address"}],"name":"setHubPool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint32","name":"newl1Gas","type":"uint32"}],"name":"setL1GasLimit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"l2Token","type":"address"},{"internalType":"address","name":"tokenBridge","type":"address"}],"name":"setTokenBridge","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"depositor","type":"address"},{"internalType":"int64","name":"updatedRelayerFeePct","type":"int64"},{"internalType":"uint32","name":"depositId","type":"uint32"},{"internalType":"address","name":"updatedRecipient","type":"address"},{"internalType":"bytes","name":"updatedMessage","type":"bytes"},{"internalType":"bytes","name":"depositorSignature","type":"bytes"}],"name":"speedUpDeposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"tokenBridges","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newImplementation","type":"address"}],"name":"upgradeTo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newImplementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeToAndCall","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"wrappedNativeToken","outputs":[{"internalType":"contract WETH9Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}]
*/