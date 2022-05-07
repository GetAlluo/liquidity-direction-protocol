// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../interfaces/ICurvePoolEUR.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "hardhat/console.sol";

contract EURAdaptor is AccessControl {
    using Address for address;

    address public Wallet;
    address public curvePool = 0xAd326c253A84e9805559b73A08724e11E49ca651;
    address public jEUR = 0x4e3Decbb3645551B8A19f0eA1678079FCB33fB4c;
    address public EURS = 0xE111178A87A3BFf0c8d18DECBa5798827539Ae99;
    address public EURT = 0x7BDF330f423Ea880FF95fC41A280fD5eCFD3D09f;
    uint256 public slippage;
    // 0 = jEUR, 18dec, 1 = PAR 18dec , 2 = EURS 2dec,   3= EURT 6dec
    constructor (address _multiSigWallet, address _liquidityBuffer) {
        require(_multiSigWallet.isContract(), "Buffer: Not contract");
        _grantRole(DEFAULT_ADMIN_ROLE, _multiSigWallet);
        _grantRole(DEFAULT_ADMIN_ROLE, _liquidityBuffer);
        Wallet = _multiSigWallet;
    }
    function setSlippage ( uint32 _newSlippage ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        slippage = _newSlippage;
    }
    function setWallet ( address newWallet ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Wallet = newWallet;
    }
    /// @notice When called by liquidity buffer, moves some funds to the Gnosis multisig and others into a LP to be kept as a 'buffer'
    /// @param _token Deposit token address (eg. USDC)
    /// @param _fullAmount Full amount deposited in 10**18 called by liquidity buffer
    /// @param _leaveInPool  Amount to be left in the LP rather than be sent to the Gnosis wallet (the "buffer" amount)
    function deposit(address _token, uint256 _fullAmount, uint256 _leaveInPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 toSend = _fullAmount - _leaveInPool;
        if (_token == jEUR) {
            uint256 lpAmount = ICurvePoolEUR(curvePool).add_liquidity([_fullAmount, 0, 0, 0 ], 0);
            if (toSend != 0) {
                uint256 lpTokensBurned = ICurvePoolEUR(curvePool).remove_liquidity_imbalance(
                            [0, 0,0,toSend / 10**12], 
                            lpAmount);
                IERC20Upgradeable(EURT).transfer(Wallet, toSend / 10**12 );
            }
        }

        else if (_token == EURT) {
            if (toSend != 0) {
                IERC20Upgradeable(EURT).transfer(Wallet, toSend / 10**12);
            }
            if (_leaveInPool != 0) {
                ICurvePoolEUR(curvePool).add_liquidity([0, 0, 0, _leaveInPool / 10**12], 0);
            }
        }

        else if (_token == EURS) {
            uint256 lpAmount = ICurvePoolEUR(curvePool).add_liquidity([0, 0, _fullAmount / 10**16, 0], 0);
            if (toSend != 0) {
                uint256 lpTokensBurned = ICurvePoolEUR(curvePool).remove_liquidity_imbalance(
                            [0,0,0,toSend / 10**12], 
                            lpAmount);
                IERC20Upgradeable(EURT).transfer(Wallet, toSend / 10**12 );
            }
        }
    } 
      // 0 = jEUR, 18dec, 1 = PAR 18dec , 2 = EURS 2dec,   3= EURT 6dec
    /// @notice When called by liquidity buffer, withdraws funds from liquidity pool
    /// @dev It checks against arbitragers attempting to exploit spreads in stablecoins. EURS is chosen as it has the most liquidity.
    /// @param _user Recipient address
    /// @param _token Deposit token address (eg. USDC)
    /// @param _amount  Amount to be withdrawn in 10*18
    function withdraw (address _user, address _token, uint256 _amount ) external onlyRole(DEFAULT_ADMIN_ROLE) {
          if (_token == jEUR) {
            // To be safe against arbitragers, when withdrawing jEUR or EURT, burn token in EURS first and then
            // Claim appropriate token afterwards. 
            uint256 toBurn = ICurvePoolEUR(curvePool).calc_token_amount([0, 0, _amount/10**16, 0], false);
            uint256 toUser = ICurvePoolEUR(curvePool).remove_liquidity_one_coin(
                    toBurn, 
                    0, 
                    _amount * (10000 - slippage) / 10000
                );
            // toUser already in 10**18
            IERC20Upgradeable(jEUR).transfer(_user, toUser);
        }

        else if (_token == EURT) {
            // To be safe against arbitragers, when withdrawing jEUR or EURT, burn token in EURS first and then
            // Claim appropriate token afterwards. 
            uint256 toBurn = ICurvePoolEUR(curvePool).calc_token_amount([0, 0, _amount/10**16, 0], false);
            uint256 toUser = ICurvePoolEUR(curvePool).remove_liquidity_one_coin(
                    toBurn, 
                    3, 
                    _amount/10**12 * (10000 - slippage) / 10000
                );
            // toUser is already in 10**6
            IERC20Upgradeable(EURT).transfer(_user, toUser);
        }

        else if (_token == EURS) {
            ICurvePoolEUR(curvePool).remove_liquidity_imbalance(
                    [0, 0, _amount / 10**16, 0], 
                    _amount * (10000 + slippage) / 10000
                );
            IERC20Upgradeable(EURS).transfer(_user, _amount/10**16);
        }
    }
    function AdaptorApproveAll() external {
        IERC20Upgradeable(jEUR).approve(curvePool, type(uint256).max);
        IERC20Upgradeable(EURS).approve(curvePool, type(uint256).max);
        IERC20Upgradeable(EURT).approve(curvePool, type(uint256).max);
        IERC20Upgradeable(curvePool).approve(curvePool, type(uint256).max);

    }

    function getAdapterAmount () external view returns ( uint256 ) {
        uint256 curveLp = IERC20Upgradeable(0xAd326c253A84e9805559b73A08724e11E49ca651).balanceOf((address(this)));
        if(curveLp != 0){
            // Returns in 10**18
            uint256 value = ICurvePoolEUR(curvePool).calc_withdraw_one_coin(curveLp, 0);
            return value;
        } else {
            return 0;
        }
    }
}