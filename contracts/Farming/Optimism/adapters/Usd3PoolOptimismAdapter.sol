// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IERC20Upgradeable as IERC20, IERC20MetadataUpgradeable as IERC20Metadata} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../../interfaces/curve/optimism/ICurvePoolUSD.sol";
import "../../../interfaces/IPriceFeedRouter.sol";

import "hardhat/console.sol";

contract Usd3PoolOptimismAdapter is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // All address are Optimism addresses.
    address public constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address public constant USDC = 0x7F5c764cBc14f9669B88837ca1490cCa17c31607;
    address public constant USDT = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
    address public constant CURVE_POOL =
        0x1337BedC9D22ecbe766dF105c9623922A27963EC;
    address public buffer;
    bool public upgradeStatus;
    uint64 public slippage;
    address public priceFeedRouter;
    uint64 public primaryTokenIndex;
    uint256 public fiatIndex;

    mapping(address => uint128) public indexes;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _multiSigWallet,
        address _buffer,
        address _liquidityHandler,
        uint64 _slippage
    ) public initializer {
        require(_multiSigWallet.isContract(), "Adapter: Not contract");
        require(_liquidityHandler.isContract(), "Adapter: Not contract");
        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(DEFAULT_ADMIN_ROLE, _liquidityHandler);
        _grantRole(UPGRADER_ROLE, _multiSigWallet);
        _grantRole(DEFAULT_ADMIN_ROLE, _buffer);
        buffer = _buffer;
        slippage = _slippage;

        indexes[DAI] = 0;
        indexes[USDC] = 1;
        indexes[USDT] = 2;

        primaryTokenIndex = 1;
    }

    function adapterApproveAll() external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(DAI).safeApprove(CURVE_POOL, type(uint256).max);
        IERC20(USDC).safeApprove(CURVE_POOL, type(uint256).max);
        IERC20(USDT).safeApprove(CURVE_POOL, type(uint256).max);
    }

    /// @notice When called by liquidity handler, moves some funds to the Gnosis multisig and others into a LP to be kept as a 'buffer'
    /// @param _token Deposit token address (eg. USDC)
    /// @param _fullAmount Full amount deposited in 10**18 called by liquidity handler
    /// @param _leaveInPool  Amount to be left in the LP rather than be sent to the buffer (the "buffer" amount)
    function deposit(
        address _token,
        uint256 _fullAmount,
        uint256 _leaveInPool
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 toSend = _fullAmount - _leaveInPool;
        address primaryToken = ICurvePoolUSD(CURVE_POOL).coins(
            primaryTokenIndex
        );
        if (_token == primaryToken) {
            if (toSend != 0) {
                IERC20(primaryToken).safeTransfer(
                    buffer,
                    toSend /
                        10 ** (18 - IERC20Metadata(primaryToken).decimals())
                );
            }
            if (_leaveInPool != 0) {
                uint256[3] memory amounts;
                amounts[primaryTokenIndex] =
                    _leaveInPool /
                    10 ** (18 - IERC20Metadata(primaryToken).decimals());
                ICurvePoolUSD(CURVE_POOL).add_liquidity(amounts, 0);
            }
        } else {
            uint256[3] memory amounts;
            amounts[indexes[_token]] =
                _fullAmount /
                10 ** (18 - IERC20Metadata(_token).decimals());

            uint256 lpAmount = ICurvePoolUSD(CURVE_POOL).add_liquidity(
                amounts,
                0
            );
            delete amounts;
            if (toSend != 0) {
                toSend =
                    toSend /
                    10 ** (18 - IERC20Metadata(primaryToken).decimals());
                amounts[primaryTokenIndex] = toSend;
                ICurvePoolUSD(CURVE_POOL).remove_liquidity_imbalance(
                    amounts,
                    (lpAmount * (10000 + slippage)) / 10000
                );
                IERC20(primaryToken).safeTransfer(buffer, toSend);
            }
        }
    }

    /// @notice When called by liquidity handler, withdraws funds from liquidity pool
    /// @param _user Recipient address
    /// @param _token Deposit token address (eg. USDC)
    /// @param _amount  Amount to be withdrawn in 10**18
    function withdraw(
        address _user,
        address _token,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256[3] memory amounts;
        uint256 amount = _amount /
            10 ** (18 - IERC20Metadata(_token).decimals());
        amounts[indexes[_token]] = amount;
        ICurvePoolUSD(CURVE_POOL).remove_liquidity_imbalance(
            amounts,
            (_amount * (10000 + slippage)) / 10000
        );
        IERC20(_token).safeTransfer(_user, amount);
    }

    function getAdapterAmount() external view returns (uint256) {
        // get price feed for primary token in usd
        // return the usd value to amount
        // return in 10**18

        uint256 curveLpAmount = IERC20(CURVE_POOL).balanceOf((address(this)));
        if (curveLpAmount != 0) {
            address primaryToken = ICurvePoolUSD(CURVE_POOL).coins(
                primaryTokenIndex
            );
            uint256 amount = (
                ICurvePoolUSD(CURVE_POOL).calc_withdraw_one_coin(
                    curveLpAmount,
                    int128(uint128(primaryTokenIndex))
                )
            ) * 10 ** (18 - ERC20(primaryToken).decimals());

            if (priceFeedRouter != address(0)) {
                (uint256 price, uint8 priceDecimals) = IPriceFeedRouter(
                    priceFeedRouter
                ).getPrice(primaryToken, fiatIndex);
                amount = (amount * price) / 10 ** (uint256(priceDecimals));
            }

            return amount;
        } else {
            return 0;
        }
    }

    /**
     * @dev Returns an address of the primary token in a pool
     * @return primaryToken Address of the aforementioned token
     */
    function getCoreTokens() external view returns (address primaryToken) {
        return (ICurvePoolUSD(CURVE_POOL).coins(primaryTokenIndex));
    }

    /**
     * @dev Admin function to set the primaryTokenIndex
     */
    function changePrimaryTokenIndex(
        uint64 _newPrimaryTokenIndex
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        primaryTokenIndex = _newPrimaryTokenIndex;
    }

    /**
     * @dev Admin function to set the slippage
     */
    function setSlippage(
        uint64 _newSlippage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        slippage = _newSlippage;
    }

    function setBuffer(
        address _newBuffer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        buffer = _newBuffer;
    }

    function setPriceRouterInfo(
        address _priceFeedRouter,
        uint256 _fiatIndex
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        priceFeedRouter = _priceFeedRouter;
        fiatIndex = _fiatIndex;
    }

    /**
     * @dev admin function for removing funds from contract
     * @param _address address of the token being removed
     * @param _amount amount of the token being removed
     */
    function removeTokenByAddress(
        address _address,
        address _to,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(_address).safeTransfer(_to, _amount);
    }

    function changeUpgradeStatus(
        bool _status
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        upgradeStatus = _status;
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(UPGRADER_ROLE) {
        require(upgradeStatus, "Adapter: Upgrade not allowed");
        upgradeStatus = false;
    }
}
