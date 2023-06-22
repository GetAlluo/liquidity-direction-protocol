import { ethers, upgrades } from "hardhat";
import { AlluoStrategyHandler, AlluoVoteExecutor, AlluoVoteExecutorUtils, BeefyStrategy, BeefyStrategyUniversal, Exchange, IBeefyBoost, IBeefyVaultV6, IERC20, IERC20Metadata, IExchange, IPriceFeedRouter, IPriceFeedRouterV2, IWrappedEther, LiquidityHandler, PseudoMultisigWallet } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LiquidityHandlerCurrent, SpokePoolMock } from "../../typechain";
import { reset } from "@nomicfoundation/hardhat-network-helpers";
import { run } from "hardhat";
async function main() {
    let alluoVoteExecutor: AlluoVoteExecutor;
    let alluoStrategyHandler: AlluoStrategyHandler;
    let alluoVoteExecutorUtils: AlluoVoteExecutorUtils;
    let signers: SignerWithAddress[];
    let admin: SignerWithAddress;
    let pseudoMultiSig: PseudoMultisigWallet
    let spokePool: string;
    let _recipient: string;
    let _recipientChainId: string;
    let _relayerFeePct: number;
    let _slippageTolerance: number;
    let _exchange: IExchange;
    let priceRouter: IPriceFeedRouterV2;
    let weth: IWrappedEther;
    let usdc: IERC20Metadata;
    let beefyStrategy: BeefyStrategyUniversal;
    let ldo: IERC20Metadata;
    let liquidityHandler: LiquidityHandlerCurrent;

    admin = await ethers.getSigner("0xABfE4d45c6381908F09EF7c501cc36E38D34c0d4");

    //For test
    signers = await ethers.getSigners();
    // admin = signers[0];

    _exchange = await ethers.getContractAt(
        "contracts/interfaces/IExchange.sol:IExchange",
        "0x66Ac11c106C3670988DEFDd24BC75dE786b91095"
    ) as IExchange;
    priceRouter = await ethers.getContractAt("contracts/interfaces/IPriceFeedRouterV2.sol:IPriceFeedRouterV2", "0x7E6FD319A856A210b9957Cd6490306995830aD25") as IPriceFeedRouterV2;

    weth = await ethers.getContractAt(
        "contracts/interfaces/IWrappedEther.sol:IWrappedEther",
        "0x4200000000000000000000000000000000000006"
    ) as IWrappedEther;

    usdc = await ethers.getContractAt(
        "IERC20Metadata",
        "0x7f5c764cbc14f9669b88837ca1490cca17c31607") as IERC20Metadata;

    spokePool = "0x6f26Bf09B1C792e3228e5467807a900A503c0281"
    _recipientChainId = "137";

    alluoStrategyHandler = await ethers.getContractAt("AlluoStrategyHandler", "0x4eaCDBFE57Bd641266Cab20D40174dc76802F955") as AlluoStrategyHandler;
    alluoVoteExecutor = await ethers.getContractAt("AlluoVoteExecutor", "0x546e8589E5eF88AA5cA19134FAb800a49D52eE66") as AlluoVoteExecutor;
    alluoVoteExecutorUtils = await ethers.getContractAt("AlluoVoteExecutorUtils", "0xA9081414C281De5d0B8c67a1b7a631332e259850") as AlluoVoteExecutorUtils
    beefyStrategy = await ethers.getContractAt("BeefyStrategyUniversal", "0x62cB09739920d071809dFD9B66D2b2cB27141410") as BeefyStrategyUniversal
    pseudoMultiSig = await ethers.getContractAt("PseudoMultisigWallet", "0xb26D2B27f75844E5ca8Bf605190a1D8796B38a25", signers[6]) as PseudoMultisigWallet

    // //  OK lets upgrade the executor on polygon first
    let executorFactory = await ethers.getContractFactory("AlluoVoteExecutor");

    // let stauts = await alluoVoteExecutor.changeUpgradeStatus(true)

    // stauts = await alluoVoteExecutor.grantRole(await alluoVoteExecutor.UPGRADER_ROLE(), admin.address)
    // await stauts.wait()
    // let exec = await upgrades.upgradeProxy(alluoVoteExecutor.address, executorFactory);
    // console.log("Executor upgraded")

    // await alluoVoteExecutor.grantRole(await alluoVoteExecutor.RELAYER_ROLE(), "0x7b112292a64a36850acca5f8e80aaf21782aa30b")
    // await alluoVoteExecutor.grantRole(await alluoVoteExecutor.DEFAULT_ADMIN_ROLE(), "0x16A50D9Eb03DFeD8de4fCa6aA69f42dd42e4d7A0")
    // await alluoVoteExecutor.setTimelock(60 * 60 * 24)

    // // // // Upgrade the handler
    let handlerFactory = await ethers.getContractFactory("AlluoStrategyHandler");
    let stauts1 = await alluoStrategyHandler.changeUpgradeStatus(true)
    await stauts1.wait()
    let handler = await upgrades.upgradeProxy(alluoStrategyHandler.address, handlerFactory);
    console.log("Handler upgraded")
    await alluoStrategyHandler.clearDepositQueue(0);

    // // // // Upgrade the utils
    // let utilsFactory = await ethers.getContractFactory("AlluoVoteExecutorUtils");
    // let stauts3 = await alluoVoteExecutorUtils.changeUpgradeStatus(true)
    // await stauts3.wait()
    // let utils = await upgrades.upgradeProxy(alluoVoteExecutorUtils.address, utilsFactory);
    // await alluoVoteExecutorUtils.setAssetIdToIbAlluoAddresses("0x6b55495947F3793597C0777562C37C14cb958097", 0)
    // await alluoVoteExecutorUtils.setAssetIdToIbAlluoAddresses("0x6b55495947F3793597C0777562C37C14cb958097", 1)
    // await alluoVoteExecutorUtils.setAssetIdToIbAlluoAddresses("0x8BF24fea0Cae18DAB02A5b23c409E8E1f04Ff0ba", 2)
    // await alluoVoteExecutorUtils.setAssetIdToIbAlluoAddresses("0x253eB6077db17a43Fd7b4f4E6e5a2D8b2F9A244d", 3)

    console.log("All complete")

    // // Now verify all the implementations
    console.log("verifying now")
    // await verify(alluoVoteExecutor.address)
    // console.log("verified executor")
    await verify(alluoStrategyHandler.address)
    console.log("verified handler")
    // await verify(alluoVoteExecutorUtils.address)
    // console.log("verified utils")

}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

const verify = async (contractAddress: any) => {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
        });
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
};

//npx hardhat run scripts/deploy/deployHandler.ts --network polygon
//npx hardhat verify 0xb647c6fe9d2a6e7013c7e0924b71fa7926b2a0a3 --network polygon