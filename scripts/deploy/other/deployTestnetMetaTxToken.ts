import { defaultAbiCoder, parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat"
import { UChildAdministrableERC20 } from "../../typechain";

async function main() {
    const signers = await ethers.getSigners();
    const Token = await ethers.getContractFactory("UChildAdministrableERC20");

    const tokenName = "Testnet WBTC";
    const tokenSymbol = "tWBTC";
    const tokenDecimals = 8;

    console.log("Deploying", tokenName);
    let token = await upgrades.deployProxy(Token,
        [
            tokenName,
            tokenSymbol,
            tokenDecimals,
            signers[0].address
        ],
        { initializer: 'initialize', kind: 'uups' }
    ) as UChildAdministrableERC20;

    await token.deployTransaction.wait();
    console.log(tokenName, "upgradable deployed to:", token.address);

    const amount = defaultAbiCoder.encode(["uint256"], [parseUnits("100000.0", tokenDecimals)]);
    const mintTo = [signers[0].address];

    // mint tokens
    for (let i = 0; i < mintTo.length; i++) {
        const dst = mintTo[i];
        console.log("Minting", tokenSymbol, "to", dst);
        await token.deposit(dst, amount);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });