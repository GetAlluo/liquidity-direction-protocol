//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./ISuperToken.sol";

interface IAlluoSuperToken is ISuperToken {
    function alluoDeposit(address account, uint256 amount) external;
    function alluoWithdraw(address account, uint256 amount) external;

}