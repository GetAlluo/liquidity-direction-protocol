// SPDX-License-Identifier: UNLICENSED
// !! THIS FILE WAS AUTOGENERATED BY abi-to-sol v0.6.6. SEE SOURCE BELOW. !!
pragma solidity ^0.8.17;

interface IAlluoVoteExecutorUtils {
    event AdminChanged(address previousAdmin, address newAdmin);
    event BeaconUpgraded(address indexed beacon);
    event Initialized(uint8 version);
    event RoleAdminChanged(
        bytes32 indexed role,
        bytes32 indexed previousAdminRole,
        bytes32 indexed newAdminRole
    );
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event RoleRevoked(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );
    event Upgraded(address indexed implementation);

    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);

    function GELATO_ROLE() external view returns (bytes32);

    function UPGRADER_ROLE() external view returns (bytes32);

    function checkSignedHashes(
        bytes[] memory _signs,
        bytes32 _hashed,
        address gnosis,
        uint256 minSigns
    ) external view returns (bool);

    function confirmDataIntegrity(
        bytes calldata _data,
        address gnosis,
        uint256 minSigns
    ) external view returns (bytes memory);

    function checkUniqueSignature(
        address[] memory _uniqueSigners,
        address _signer
    ) external pure returns (bool);

    function getSignerAddress(
        bytes32 data,
        bytes memory signature
    ) external pure returns (address);

    function verify(
        bytes32 data,
        bytes memory signature,
        address account
    ) external pure returns (bool);

    function changeUpgradeStatus(bool _status) external;

    function encodeAllMessages(
        uint256[] memory _commandIndexes,
        bytes[] memory _messages
    )
        external
        view
        returns (
            bytes32 messagesHash,
            Message[] memory messages,
            bytes memory inputData
        );

    function encodeApyCommand(
        string memory _ibAlluoName,
        uint256 _newAnnualInterest,
        uint256 _newInterestPerSecond
    ) external pure returns (uint256, bytes memory);

    function encodeLiquidityCommand(
        string memory _codeName,
        uint256 _percent
    ) external view returns (uint256, bytes memory);

    function encodeMintCommand(
        uint256 _newMintAmount,
        uint256 _period
    ) external pure returns (uint256, bytes memory);

    function encodeTreasuryAllocationChangeCommand(
        int256 _delta
    ) external pure returns (uint256, bytes memory);

    function getDirectionIdByName(
        string memory _codeName
    ) external view returns (uint256);

    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    function getSubmittedData(
        uint256 _dataId
    ) external view returns (bytes memory, uint256, bytes[] memory);

    function grantRole(bytes32 role, address account) external;

    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);

    function initialize(
        address _strategyHandler,
        address _voteExecutor
    ) external;

    function isWithinSlippageTolerance(
        uint256 _amount,
        uint256 _amountToCompare,
        uint256 _slippageTolerance
    ) external pure returns (bool);

    function proxiableUUID() external view returns (bytes32);

    function renounceRole(bytes32 role, address account) external;

    function revokeRole(bytes32 role, address account) external;

    function setStorageAddresses(
        address _strategyHandler,
        address _voteExecutor
    ) external;

    function strategyHandler() external view returns (address);

    function submitData(bytes memory inputData) external;

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function upgradeStatus() external view returns (bool);

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(
        address newImplementation,
        bytes memory data
    ) external payable;

    function voteExecutor() external view returns (address);

    struct Message {
        uint256 commandIndex;
        bytes commandData;
    }
}

// THIS FILE WAS AUTOGENERATED FROM THE FOLLOWING ABI JSON:
/*
[{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"previousAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"}],"name":"AdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"beacon","type":"address"}],"name":"BeaconUpgraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"implementation","type":"address"}],"name":"Upgraded","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"GELATO_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"UPGRADER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"_uniqueSigners","type":"address[]"},{"internalType":"address","name":"_signer","type":"address"}],"name":"_checkUniqueSignature","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"data","type":"bytes32"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"_getSignerAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"data","type":"bytes32"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"address","name":"account","type":"address"}],"name":"_verify","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bool","name":"_status","type":"bool"}],"name":"changeUpgradeStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"_commandIndexes","type":"uint256[]"},{"internalType":"bytes[]","name":"_messages","type":"bytes[]"}],"name":"encodeAllMessages","outputs":[{"internalType":"bytes32","name":"messagesHash","type":"bytes32"},{"components":[{"internalType":"uint256","name":"commandIndex","type":"uint256"},{"internalType":"bytes","name":"commandData","type":"bytes"}],"internalType":"struct AlluoVoteExecutorUtils.Message[]","name":"messages","type":"tuple[]"},{"internalType":"bytes","name":"inputData","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_ibAlluoName","type":"string"},{"internalType":"uint256","name":"_newAnnualInterest","type":"uint256"},{"internalType":"uint256","name":"_newInterestPerSecond","type":"uint256"}],"name":"encodeApyCommand","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"string","name":"_codeName","type":"string"},{"internalType":"uint256","name":"_percent","type":"uint256"}],"name":"encodeLiquidityCommand","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_newMintAmount","type":"uint256"},{"internalType":"uint256","name":"_period","type":"uint256"}],"name":"encodeMintCommand","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"int256","name":"_delta","type":"int256"}],"name":"encodeTreasuryAllocationChangeCommand","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"string","name":"_codeName","type":"string"}],"name":"getDirectionIdByName","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_dataId","type":"uint256"}],"name":"getSubmittedData","outputs":[{"internalType":"bytes","name":"","type":"bytes"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes[]","name":"","type":"bytes[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_strategyHandler","type":"address"},{"internalType":"address","name":"_voteExecutor","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"},{"internalType":"uint256","name":"_amountToCompare","type":"uint256"},{"internalType":"uint256","name":"_slippageTolerance","type":"uint256"}],"name":"isWithinSlippageTolerance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"proxiableUUID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_strategyHandler","type":"address"},{"internalType":"address","name":"_voteExecutor","type":"address"}],"name":"setStorageAddresses","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"strategyHandler","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"inputData","type":"bytes"}],"name":"submitData","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"upgradeStatus","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newImplementation","type":"address"}],"name":"upgradeTo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newImplementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeToAndCall","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"voteExecutor","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]
*/
