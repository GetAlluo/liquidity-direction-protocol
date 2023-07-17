// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IAlluoStrategyV2} from "./interfaces/IAlluoStrategyV2.sol";
import {IExchange} from "./interfaces/IExchange.sol";
import {IPriceFeedRouterV2} from "./interfaces/IPriceFeedRouterV2.sol";

import {IERC20MetadataUpgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "hardhat/console.sol";

contract NullStrategy is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IAlluoStrategyV2
{
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    EnumerableSetUpgradeable.AddressSet private expectedRewards;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bool public upgradeStatus;
    IPriceFeedRouterV2 public priceFeed;
    IExchange public exchange;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _multiSigWallet,
        address _voteExecutor,
        address _strategyHandler,
        address _priceFeed,
        address _exchange
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        priceFeed = IPriceFeedRouterV2(_priceFeed);
        exchange = IExchange(_exchange);

        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(DEFAULT_ADMIN_ROLE, _voteExecutor);
        _grantRole(DEFAULT_ADMIN_ROLE, _strategyHandler);

        _grantRole(UPGRADER_ROLE, _multiSigWallet);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function getExpectedRewards() external view returns (address[] memory) {
        return expectedRewards.values();
    }

    function changeExpectedRewardStatus(
        address token,
        bool status
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            expectedRewards.add(token);
        } else {
            expectedRewards.remove(token);
        }
    }

    /// @notice Invest tokens transferred to this contract.
    /// @dev Amount of tokens specified in `amount` is guranteed to be
    /// transferred to strategy by vote executor.
    /// @param data whatever data you want to pass to strategy from vote extry.
    /// @param amount amount of your tokens that will be invested.
    function invest(
        bytes calldata data,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Do nothing in the null strategy. Just hold
    }

    /// @notice Uninvest value and tranfer exchanged value to receiver.
    /// @param data whatever data you want to pass to strategy from vote extry.
    /// @param unwindPercent percentage of available assets to be released with 2 decimal points.
    /// @param outputCoin address of token that strategy MUST return.
    /// @param receiver address where tokens should go.
    /// @param swapRewards true if rewards are needed to swap to `outputCoin`, false otherwise.
    function exitAll(
        bytes calldata data,
        uint256 unwindPercent,
        IERC20 outputCoin,
        address receiver,
        bool _withdrawRewards,
        bool swapRewards
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 tokensToWithdraw = (IERC20Upgradeable(address(outputCoin))
            .balanceOf(address(this)) * 10000) / unwindPercent;

        IERC20Upgradeable(address(outputCoin)).safeTransfer(
            receiver,
            tokensToWithdraw
        );
    }

    /// @notice Claim available rewards.
    /// @param data whatever data you want to pass to strategy from vote extry.
    /// @param outputCoin address of token that strategy MUST return (if swapRewards is true).
    /// @param receiver address where tokens should go.
    /// @param swapRewards true if rewards are needed to swap to `outputCoin`, false otherwise.
    function exitOnlyRewards(
        bytes calldata data,
        address outputCoin,
        address receiver,
        bool swapRewards
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revert("N/A");
    }

    function withdrawRewards(
        address _token
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _manageRewardsAndWithdraw(true, IERC20Upgradeable(_token), msg.sender);
    }

    function getDeployedAmount(
        bytes calldata data
    ) external view returns (uint256) {
        (uint256 assetId, address entryToken) = decodeData(data);

        uint256 currentBalance = IERC20Upgradeable(entryToken).balanceOf(
            address(this)
        );

        (uint256 fiatPrice, uint8 fiatDecimals) = IPriceFeedRouterV2(priceFeed)
            .getPriceOfAmount(entryToken, currentBalance, assetId);

        return
            IPriceFeedRouterV2(priceFeed).decimalsConverter(
                fiatPrice,
                fiatDecimals,
                18
            );
    }

    // Temp function
    function getDeployedAmountAndRewards(
        bytes calldata data
    ) external view returns (uint256) {
        (uint256 assetId, address entryToken) = decodeData(data);

        uint256 currentBalance = IERC20Upgradeable(entryToken).balanceOf(
            address(this)
        );

        (uint256 fiatPrice, uint8 fiatDecimals) = IPriceFeedRouterV2(priceFeed)
            .getPriceOfAmount(entryToken, currentBalance, assetId);

        return
            IPriceFeedRouterV2(priceFeed).decimalsConverter(
                fiatPrice,
                fiatDecimals,
                18
            );
    }

    function decodeData(
        bytes calldata data
    ) public pure returns (uint256 assetId, address entryToken) {
        (assetId, entryToken) = abi.decode(data, (uint256, address));
    }

    function encodeData(
        uint256 assetId,
        address entryToken
    ) public pure returns (bytes memory data) {
        data = abi.encode(assetId, entryToken);
    }

    /// @notice Execute any action on behalf of strategy.
    /// @dev Regular call is executed. If any of extcall fails, transaction should revert.
    /// @param destinations addresses to call
    /// @param calldatas calldatas to execute
    function multicall(
        address[] calldata destinations,
        bytes[] calldata calldatas
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 length = destinations.length;
        require(length == calldatas.length, "NullStrategy: lengths");
        for (uint256 i = 0; i < length; i++) {
            destinations[i].functionCall(calldatas[i]);
        }
    }

    function changeUpgradeStatus(
        bool _status
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        upgradeStatus = _status;
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(UPGRADER_ROLE) {
        require(upgradeStatus, "Null: Upgrade not allowed");
        upgradeStatus = false;
    }

    /// @notice Swaps all rewards if instructed to the output coin and sends the funds to the receiver
    /// @dev Explain to a developer any extra details
    /// @param swapRewards bool to swap or not
    /// @param outputCoin IERC20
    /// @param receiver receiver of the funds
    function _manageRewardsAndWithdraw(
        bool swapRewards,
        IERC20Upgradeable outputCoin,
        address receiver
    ) private {
        uint256 len = expectedRewards.length();
        if (swapRewards) {
            for (uint256 i = 0; i < len; i++) {
                IERC20Upgradeable token = IERC20Upgradeable(
                    expectedRewards.at(i)
                );
                _exchangeAll(token, outputCoin);
            }
        } else {
            for (uint256 i = 0; i < len; i++) {
                IERC20Upgradeable token = IERC20Upgradeable(
                    expectedRewards.at(i)
                );
                token.safeTransfer(receiver, token.balanceOf(address(this)));
            }
        }
        outputCoin.safeTransfer(receiver, outputCoin.balanceOf(address(this)));
    }

    /// @notice Exchanges the fromCoin to the toCoin
    /// @dev Explain to a developer any extra details
    /// @param fromCoin IERC20
    /// @param toCoin  IERC20
    function _exchangeAll(
        IERC20Upgradeable fromCoin,
        IERC20Upgradeable toCoin
    ) internal {
        if (fromCoin == toCoin) return;
        uint256 amount = fromCoin.balanceOf(address(this));
        if (amount == 0) return;
        console.log("FromCoin address", address(fromCoin));
        console.log("ToCoin address", address(toCoin));
        console.log("Amount", amount);
        fromCoin.safeApprove(address(exchange), amount);
        exchange.exchange(address(fromCoin), address(toCoin), amount, 0);
    }
}