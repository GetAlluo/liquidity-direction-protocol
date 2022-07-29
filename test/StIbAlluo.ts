import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Address } from "cluster";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { IERC20, PseudoMultisigWallet, PseudoMultisigWallet__factory, IbAlluo, IbAlluo__factory, LiquidityHandler, UsdCurveAdapter, LiquidityHandler__factory, UsdCurveAdapter__factory, EurCurveAdapter, EthNoPoolAdapter, EurCurveAdapter__factory, EthNoPoolAdapter__factory, BtcCurveAdapter, ISuperTokenFactory, StIbAlluo, StIbAlluo__factory } from "../typechain";

async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

function getRandomArbitrary(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}

async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
    await ethers.provider.send(
        'hardhat_impersonateAccount',
        [address]
    );

    return await ethers.getSigner(address);
}

async function sendEth(users: SignerWithAddress[]) {
    let signers = await ethers.getSigners();

    for (let i = 0; i < users.length; i++) {
        await signers[0].sendTransaction({
            to: users[i].address,
            value: parseEther("1.0")

        });
    }
}

async function prepareCallData(type: string, parameters: any[]): Promise<BytesLike> {
    if (type == "status") {
        let ABI = ["function changeUpgradeStatus(bool _status)"];
        let iface = new ethers.utils.Interface(ABI);
        let calldata = iface.encodeFunctionData("changeUpgradeStatus", [parameters[0]]);
        return calldata;
    }
    else if (type == "role") {
        let ABI = ["function grantRole(bytes32 role, address account)"];
        let iface = new ethers.utils.Interface(ABI);
        let calldata = iface.encodeFunctionData("grantRole", [parameters[0], parameters[1]]);
        return calldata;
    }
    else {
        return ethers.utils.randomBytes(0);
    }
}
describe("IbAlluoUSD and Handler", function () {
    let signers: SignerWithAddress[];
    let admin: SignerWithAddress;

    let ibAlluoCurrent: IbAlluo;
    let StIbAlluo: StIbAlluo;

    let usdAdapter: UsdCurveAdapter;

    let multisig: PseudoMultisigWallet;
    let handler: LiquidityHandler;

    let dai: IERC20, usdc: IERC20, usdt: IERC20;
    let curveLpUSD: IERC20;
    let superToken: IERC20;

    let usdWhale: SignerWithAddress;
    let curveUsdLpHolder: SignerWithAddress;

    let exchangeAddress: string;
    let superFactory: ISuperTokenFactory;

    before(async function () {

        //We are forking Polygon mainnet, please set Alchemy key in .env
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.POLYGON_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 29518660,
                },
            }, ],
        });

        signers = await ethers.getSigners();

        admin = await getImpersonatedSigner("0x2580f9954529853Ca5aC5543cE39E9B5B1145135");
        await (await (await ethers.getContractFactory("ForceSender")).deploy({
            value: parseEther("10.0")
        })).forceSend(admin.address);

        usdWhale = await getImpersonatedSigner("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8");
        curveUsdLpHolder = await getImpersonatedSigner("0x7117de93b352ae048925323f3fcb1cd4b4d52ec4");

        dai = await ethers.getContractAt("IERC20", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063");
        usdc = await ethers.getContractAt("IERC20", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
        usdt = await ethers.getContractAt("IERC20", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
        curveLpUSD = await ethers.getContractAt("IERC20", "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171");

        console.log("We are forking Polygon mainnet\n");
        expect(await dai.balanceOf(usdWhale.address)).to.be.gt(0, "Whale has no DAI, or you are not forking Polygon");
        expect(await usdc.balanceOf(usdWhale.address)).to.be.gt(0, "Whale has no USDC, or you are not forking Polygon");
        expect(await usdt.balanceOf(usdWhale.address)).to.be.gt(0, "Whale has no USDT, or you are not forking Polygon");

        await sendEth([usdWhale])
    });

    beforeEach(async function () {

        const IbAlluo = await ethers.getContractFactory("IbAlluo") as IbAlluo__factory;
        //We are using this contract to simulate Gnosis multisig wallet
        const Multisig = await ethers.getContractFactory("PseudoMultisigWallet") as PseudoMultisigWallet__factory;
        multisig = await Multisig.deploy(true);

        exchangeAddress = "0x6b45B9Ab699eFbb130464AcEFC23D49481a05773";
        
        handler = await ethers.getContractAt("LiquidityHandler", "0x31a3439Ac7E6Ea7e0C0E4b846F45700c6354f8c1");

        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), multisig.address)

        const UsdAdapter = await ethers.getContractFactory("UsdCurveAdapter") as UsdCurveAdapter__factory;

        usdAdapter = await UsdAdapter.deploy(admin.address, handler.address, 200)

        await usdAdapter.connect(admin).adapterApproveAll()

        let lastAdapterId = (await handler.getLastAdapterIndex()).add(1)

        await handler.connect(admin).setAdapter(
            lastAdapterId,
            "USD Curve-Aave",
            500,
            usdAdapter.address,
            true
        )

        ibAlluoCurrent = await upgrades.deployProxy(IbAlluo,
            [
                "Interest Bearing Alluo USD",
                "IbAlluoUSD",
                multisig.address,
                handler.address,
                [dai.address,
                    usdc.address,
                    usdt.address
                ],
                BigNumber.from("100000000470636740"),
                1600,
                "0x86C80a8aa58e0A4fa09A69624c31Ab2a6CAD56b8",
                exchangeAddress
            ], {
                initializer: 'initialize',
                kind: 'uups'
            }
        ) as IbAlluo;

        await handler.connect(admin).setIbAlluoToAdapterId(ibAlluoCurrent.address, lastAdapterId)
        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), ibAlluoCurrent.address)


        const StIbAlluoFactory = await ethers.getContractFactory("StIbAlluo") as StIbAlluo__factory;

        StIbAlluo = await upgrades.deployProxy(StIbAlluoFactory,
            [ibAlluoCurrent.address, 18, "Streaming IbAlluo USD", "StIbAlluoUSD", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", multisig.address, [ibAlluoCurrent.address]
            ], {
                initializer: 'alluoInitialize',
                kind: 'uups'
            }
        ) as StIbAlluo;

        let ABI = ["function setSuperToken(address _superToken)"];
        let iface = new ethers.utils.Interface(ABI);
        let calldata = iface.encodeFunctionData("setSuperToken", [StIbAlluo.address]);

        await multisig.executeCall(ibAlluoCurrent.address, calldata);
    });

    describe('All IbAlluo tests with StIbAlluo integration', function () {
        it("Test upgradeability of original ibAlluo contract", async function() {

            let ibAlluoCurrentUsd = await ethers.getContractAt("IbAlluo", "0xC2DbaAEA2EfA47EBda3E572aa0e55B742E408BF6");
            await ibAlluoCurrentUsd.connect(admin).grantRole("0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
            await ibAlluoCurrentUsd.connect(admin).changeUpgradeStatus(true);

            const IbAlluoNew = await ethers.getContractFactory("IbAlluo");
            let IbAlluoUsd = await upgrades.forceImport("0xC2DbaAEA2EfA47EBda3E572aa0e55B742E408BF6", IbAlluoNew);
            await upgrades.upgradeProxy(IbAlluoUsd.address, IbAlluoNew);
            console.log("Upgrade complete")
        })
        it("Create flow through contract", async function() {
            await deposit(signers[1], dai, parseUnits("10000", 18));
            let balanceBefore = await ibAlluoCurrent.getBalance(signers[2].address);
            let encodeData = await ibAlluoCurrent.connect(signers[1]).formatPermissions();
            let superhost = await ethers.getContractAt("Superfluid", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7");
            await superhost.connect(signers[1]).callAgreement(
                "0x6EeE6060f715257b970700bc2656De21dEdF074C",
                encodeData,
                "0x"
            )
            await ibAlluoCurrent.connect(signers[1]).createFlow(signers[2].address, "1", parseEther("10000"))

            await skipDays(1)
            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).greaterThanOrEqual(Number(balanceBefore));
            console.log(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address));
        })

        it("Create flow through contract then delete flow", async function() {
            await deposit(signers[1], dai, parseUnits("10000", 18));
            let balanceBefore = await ibAlluoCurrent.getBalance(signers[2].address);
            let encodeData = await ibAlluoCurrent.connect(signers[1]).formatPermissions();
            let superhost = await ethers.getContractAt("Superfluid", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7");
            await superhost.connect(signers[1]).callAgreement(
                "0x6EeE6060f715257b970700bc2656De21dEdF074C",
                encodeData,
                "0x"
            )
            await ibAlluoCurrent.connect(signers[1]).createFlow(signers[2].address, "1", parseEther("10000"))

            await skipDays(1)
            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).greaterThanOrEqual(Number(balanceBefore));
            let balanceAfter = await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address);

            await ibAlluoCurrent.connect(signers[1]).deleteFlow(signers[2].address);
            await skipDays(1)
            // There is slight inaccuracy because of the time it takes to execute.
            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).greaterThan(Number(balanceAfter));
            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).lessThan(Number(balanceAfter) * 1.01);

        })
        it("Create flow through contract then update flow to give 10x the money", async function() {
            await deposit(signers[1], dai, parseUnits("10000", 18));
            let balanceBefore = await ibAlluoCurrent.getBalance(signers[2].address);
            let encodeData = await ibAlluoCurrent.connect(signers[1]).formatPermissions();
            let superhost = await ethers.getContractAt("Superfluid", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7");
            await superhost.connect(signers[1]).callAgreement(
                "0x6EeE6060f715257b970700bc2656De21dEdF074C",
                encodeData,
                "0x"
            )
            await ibAlluoCurrent.connect(signers[1]).createFlow(signers[2].address, "1", parseEther("10000"))

            await skipDays(1)
            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).greaterThanOrEqual(Number(balanceBefore));
            console.log("Before update flow", await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address));

            // 10x the value of the flow.
            await ibAlluoCurrent.connect(signers[1]).updateFlow(signers[2].address, "10", "0")

            let balanceAfterDay1 = Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address));

            await skipDays(1)
            console.log("After update flow", await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address));

            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).greaterThan(balanceAfterDay1);
        })



        it("Call agreement CFA directly to host", async function() {
            await deposit(signers[1], dai, parseUnits("10000", 18));
            let balanceBefore = await ibAlluoCurrent.getBalance(signers[2].address);

            await ibAlluoCurrent.connect(signers[1]).approve(StIbAlluo.address, parseEther("10000"));
            await StIbAlluo.connect(signers[1]).upgrade(parseEther("10000"))


            let superhost = await ethers.getContractAt("Superfluid", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7");
            let CFA = await ethers.getContractAt("IConstantFlowAgreementV1", "0x6EeE6060f715257b970700bc2656De21dEdF074C");

            let encodeData = await ibAlluoCurrent.callStatic.formatFlow(signers[2].address, "1", "0x6EeE6060f715257b970700bc2656De21dEdF074C")

            await superhost.connect(signers[1]).callAgreement(
                "0x6EeE6060f715257b970700bc2656De21dEdF074C",
                encodeData,
                "0x"
            )


            await skipDays(1)
            expect(Number(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address))).greaterThanOrEqual(Number(balanceBefore));
            console.log(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address));
        })
        it("Call agreement directly with CFA, and then withdraws from ibAlluo should pull StIbAlluo", async function() {
            await deposit(signers[1], dai, parseUnits("10000", 18));
            let balanceBefore = await ibAlluoCurrent.getBalance(signers[2].address);

            await ibAlluoCurrent.connect(signers[1]).approve(StIbAlluo.address, parseEther("10000"));
            await StIbAlluo.connect(signers[1]).upgrade(parseEther("10000"))

            let superhost = await ethers.getContractAt("Superfluid", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7");
            let CFA = await ethers.getContractAt("IConstantFlowAgreementV1", "0x6EeE6060f715257b970700bc2656De21dEdF074C");

            let encodeData = await ibAlluoCurrent.callStatic.formatFlow(signers[2].address, "10000000000000", "0x6EeE6060f715257b970700bc2656De21dEdF074C")
            await superhost.connect(signers[1]).callAgreement(
                "0x6EeE6060f715257b970700bc2656De21dEdF074C",
                encodeData,
                "0x"
            )


            await skipDays(100)
            console.log(await ibAlluoCurrent.connect(signers[2]).getBalance(signers[2].address));

            await ibAlluoCurrent.connect(signers[2]).withdraw(dai.address, parseEther("10"));
            expect(Number(await dai.connect(signers[2]).balanceOf(signers[2].address))).greaterThanOrEqual(0);
            console.log(await dai.connect(signers[2]).balanceOf(signers[2].address));
        })
        it("Should convert StIbAlluo to IbAlluo when needed automatically", async function() {
            await deposit(signers[1], dai, parseUnits("10000", 18));

            await ibAlluoCurrent.connect(signers[1]).approve(StIbAlluo.address, parseEther("5000"));
            await StIbAlluo.connect(signers[1]).upgrade(parseEther("5000"))

            // Just some dust.
            // expect(await ibAlluoCurrent.connect(signers[1]).getBalance(signers[1].address)).equal((parseUnits("10000", 18)))
            await ibAlluoCurrent.connect(signers[1]).withdraw(dai.address, parseEther("10000"));
            expect(Number(await dai.balanceOf(signers[1].address))).greaterThanOrEqual(0);
            console.log(await dai.balanceOf(signers[1].address));
        })
        it("Simulation with random deposits and withdrawals", async function () {
            let numberOfDeposits = getRandomArbitrary(4, 5);
            let i = 0;

            while (i <= numberOfDeposits) {
                await deposit(signers[1], dai, parseUnits((getRandomArbitrary(500, 10000)).toString(), 18))
                await deposit(signers[2], usdc, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                await deposit(signers[3], usdt, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                i++;
            }
            i = 0;
            let numberOfWithdrawals = getRandomArbitrary(3, 4);

            while (i <= numberOfWithdrawals / 3) {
                await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther((getRandomArbitrary(100, 500)).toString()))
                await ibAlluoCurrent.connect(signers[2]).withdraw(dai.address, parseEther((getRandomArbitrary(100, 500)).toString()))
                await ibAlluoCurrent.connect(signers[3]).withdraw(usdc.address, parseEther((getRandomArbitrary(100, 500)).toString()))
                i++;
            }
            //console.log("BIG deposit and withdrawal");
            await deposit(signers[0], dai, parseUnits("4000", 18))
            await ibAlluoCurrent.connect(signers[0]).withdraw(usdc.address, parseEther("4000"))

            while (i <= numberOfWithdrawals) {
                await ibAlluoCurrent.connect(signers[1]).withdraw(usdc.address, parseEther((getRandomArbitrary(100, 500)).toString()))
                await ibAlluoCurrent.connect(signers[2]).withdraw(usdt.address, parseEther((getRandomArbitrary(100, 500)).toString()))
                await ibAlluoCurrent.connect(signers[3]).withdraw(dai.address, parseEther((getRandomArbitrary(100, 500)).toString()))
                i++;
            }

            while (i <= numberOfDeposits) {
                await deposit(signers[1], dai, parseUnits((getRandomArbitrary(500, 10000)).toString(), 18))
                await deposit(signers[2], usdc, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                await deposit(signers[3], usdt, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                i++;
            }

            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);

            i = 0;
            while (i <= 2) {
                await deposit(signers[1], dai, parseUnits((getRandomArbitrary(500, 10000)).toString(), 18))
                await deposit(signers[2], usdc, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                await deposit(signers[3], usdt, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                i++;
            }

            await curveLpUSD.connect(curveUsdLpHolder).transfer(usdAdapter.address, parseEther("5000"));

            i = 0;
            while (i <= 2) {
                await deposit(signers[1], dai, parseUnits((getRandomArbitrary(500, 10000)).toString(), 18))
                await deposit(signers[2], usdc, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                await deposit(signers[3], usdt, parseUnits((getRandomArbitrary(500, 10000)).toString(), 6))
                i++;
            }
        });

        it("Should check all core functions of handler", async function () {

            await deposit(signers[1], dai, parseUnits("2000", 18));
            await deposit(signers[2], usdc, parseUnits("3000", 6));
            await deposit(signers[3], usdt, parseUnits("5000", 6));

            await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther("150"))
            await ibAlluoCurrent.connect(signers[2]).withdraw(usdc.address, parseEther("150"))
            await ibAlluoCurrent.connect(signers[3]).withdraw(dai.address, parseEther("150"))

            await deposit(signers[1], dai, parseUnits("100", 18));
            await deposit(signers[2], usdc, parseUnits("100", 6));
            await deposit(signers[3], usdt, parseUnits("100", 6));

            await curveLpUSD.connect(curveUsdLpHolder).transfer(usdAdapter.address, parseEther("300"));

            await deposit(signers[1], dai, parseUnits("1000", 18));
            await deposit(signers[2], usdc, parseUnits("1000", 6));
            await deposit(signers[3], usdt, parseUnits("1000", 6));

            await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther("900"))
            await deposit(signers[2], usdc, parseUnits("100", 6));
            await deposit(signers[2], usdt, parseUnits("900", 6));
            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);
            await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther("600"))

            await ibAlluoCurrent.connect(signers[1]).withdraw(dai.address, parseEther("100"))
            await ibAlluoCurrent.connect(signers[2]).withdraw(usdc.address, parseEther("100"))
            await ibAlluoCurrent.connect(signers[3]).withdraw(usdt.address, parseEther("100"))
            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);
            await deposit(signers[2], usdt, parseUnits("300", 6));
            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);
        });
    });

    describe('Token transfers and apy calculation', function () {
        it('Should return right user balance after one year even without claim', async function () {

            // address that will get minted tokens
            const recipient = signers[3];
            // amount of tokens to be minted, including decimals value of ibAlluoCurrent
            const amount = ethers.utils.parseUnits("100.0", await ibAlluoCurrent.decimals());

            await deposit(recipient, dai, amount);

            await skipDays(365);

            //view function that returns balance with APY
            let balance = await ibAlluoCurrent.getBalance(signers[3].address);
            //console.log(balance.toString());
            expect(balance).to.be.gt(parseUnits("115.9", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("116.1", await ibAlluoCurrent.decimals()));
        });

        it('Should not change growingRatio more than once a minute', async function () {

            // address that will get minted tokens
            const recipient = signers[3];
            // amount of tokens to be minted, including decimals value of ibAlluoCurrent
            const amount = ethers.utils.parseUnits("100.0", await ibAlluoCurrent.decimals());

            await deposit(recipient, dai, amount);

            await skipDays(365);

            let balance = await ibAlluoCurrent.getBalance(signers[3].address);

            ibAlluoCurrent.updateRatio();
            let oldDF = ibAlluoCurrent.growingRatio().toString;
            //Does not change DF again
            ibAlluoCurrent.updateRatio();
            let newDF = ibAlluoCurrent.growingRatio().toString;
            expect(oldDF).to.equal(newDF)
            balance = await ibAlluoCurrent.getBalance(signers[3].address);
            expect(balance).to.be.gt(parseUnits("115.9", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("116.1", await ibAlluoCurrent.decimals()));
        });

        it('getBalance should return zero if user dont have tokens', async function () {

            let balance = await ibAlluoCurrent.getBalance(signers[3].address);
            //console.log(balance.toString());
            expect(balance).to.equal(0);
        });

        it("Should check all transferAssetValue functions ", async function () {
            await deposit(signers[1], dai, parseUnits("1000", 18));
            await ibAlluoCurrent.connect(signers[1]).transfer(signers[2].address, parseEther("100"))
            await ibAlluoCurrent.connect(signers[1]).transfer(signers[3].address, parseEther("100"))
            await skipDays(365);

            let totalAsset = await ibAlluoCurrent.totalAssetSupply()
            expect(totalAsset).to.be.gt(parseUnits("1159", await ibAlluoCurrent.decimals()));
            expect(totalAsset).to.be.lt(parseUnits("1160.1", await ibAlluoCurrent.decimals()));

            await ibAlluoCurrent.connect(signers[2]).transferAssetValue(signers[1].address, parseEther("115.9"))

            await ibAlluoCurrent.connect(signers[3]).approveAssetValue(signers[2].address, parseEther("116"))
            await ibAlluoCurrent.connect(signers[2]).transferFromAssetValue(signers[3].address, signers[1].address, parseEther("115.9"))

            let tokenBalance = await ibAlluoCurrent.balanceOf(signers[1].address);
            expect(tokenBalance).to.be.gt(parseUnits("999", await ibAlluoCurrent.decimals()));
            expect(tokenBalance).to.be.lt(parseUnits("1000", await ibAlluoCurrent.decimals()));

            let valueBalance = await ibAlluoCurrent.getBalance(signers[1].address)
            expect(valueBalance).to.be.gt(parseUnits("1159", await ibAlluoCurrent.decimals()));
            expect(valueBalance).to.be.lt(parseUnits("1160", await ibAlluoCurrent.decimals()));
        });

        it("Should withdraw from caller to recipient", async function () {
            await deposit(signers[1], dai, parseUnits("3000", 18));

            await ibAlluoCurrent.connect(signers[1]).withdrawTo(signers[2].address, dai.address, parseEther("100"))
            let tokenBalance = await dai.balanceOf(signers[2].address);
            expect(tokenBalance).to.be.gt(parseUnits("100", 18));

        });

        it('Should correctly calculate balances over time and various transfers', async function () {

            //changing interest
            let newAnnualInterest = 800;
            let newInterestPerSecond = BigNumber.from("100000000244041000");

            let ABI = ["function setInterest(uint256 _newAnnualInterest, uint256 _newInterestPerSecond)"];
            let iface = new ethers.utils.Interface(ABI);
            let calldata = iface.encodeFunctionData("setInterest", [newAnnualInterest, newInterestPerSecond]);

            await multisig.executeCall(ibAlluoCurrent.address, calldata);

            const amount = ethers.utils.parseUnits("100.0", await ibAlluoCurrent.decimals());

            //big deposit to full buffer
            const largeAmount = ethers.utils.parseUnits("10000.0", await ibAlluoCurrent.decimals());
            await deposit(signers[9], dai, largeAmount);

            //start
            await deposit(signers[1], dai, amount);
            await skipDays(73);

            //after first period
            await deposit(signers[1], dai, amount);
            await deposit(signers[2], dai, amount);
            await skipDays(73);

            //after second period
            await deposit(signers[4], dai, amount);
            await deposit(signers[3], dai, amount);
            await skipDays(73);

            //after third period
            await deposit(signers[4], dai, amount);
            await skipDays(73);

            //after fourth period
            await ibAlluoCurrent.updateRatio();
            let balance = await ibAlluoCurrent.getBalance(signers[3].address);
            // console.log(balance.toString());

            expect(balance).to.be.gt(parseUnits("103.12", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("103.13", await ibAlluoCurrent.decimals()));
            await ibAlluoCurrent.connect(signers[3]).withdraw(dai.address, balance);

            //changing interest
            newAnnualInterest = 500;
            newInterestPerSecond = BigNumber.from("100000000154712595");

            ABI = ["function setInterest(uint256 _newAnnualInterest, uint256 _newInterestPerSecond)"];
            iface = new ethers.utils.Interface(ABI);
            calldata = iface.encodeFunctionData("setInterest", [newAnnualInterest, newInterestPerSecond]);

            await multisig.executeCall(ibAlluoCurrent.address, calldata);

            await deposit(signers[4], dai, amount);
            await skipDays(73);
            // 213146060334668005011
            //after fifth period
            balance = await ibAlluoCurrent.getBalance(signers[1].address);
            // console.log(balance.toString());
            expect(balance).to.be.gt(parseUnits("213.14", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("213.15", await ibAlluoCurrent.decimals()));
            await ibAlluoCurrent.connect(signers[1]).withdraw(dai.address, balance);

            balance = await ibAlluoCurrent.getBalance(signers[2].address);
            //console.log(balance.toString());
            expect(balance).to.be.gt(parseUnits("105.75", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("105.76", await ibAlluoCurrent.decimals()));
            await ibAlluoCurrent.connect(signers[2]).withdraw(dai.address, balance);

            balance = await ibAlluoCurrent.getBalanceForTransfer(signers[4].address);
            expect(balance).to.be.gt(parseUnits("307.66", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("307.67", await ibAlluoCurrent.decimals()));
            await ibAlluoCurrent.connect(signers[4]).withdraw(dai.address, balance);
        });
        it('Should not give rewards if the interest is zero', async function () {

            // address that will get minted tokens
            const recipient = signers[3];
            // amount of tokens to be minted, including decimals value of ibAlluoCurrent
            const amount = ethers.utils.parseUnits("100.0", await ibAlluoCurrent.decimals());

            await deposit(recipient, dai, amount);

            await skipDays(365);

            let balance = await ibAlluoCurrent.getBalance(signers[3].address);
            expect(balance).to.be.gt(parseUnits("115.9", await ibAlluoCurrent.decimals()));
            expect(balance).to.be.lt(parseUnits("116.1", await ibAlluoCurrent.decimals()));

            //changing interest
            const newAnnualInterest = 0;
            const newInterestPerSecond = BigNumber.from("100000000000000000");

            let ABI = ["function setInterest(uint256 _newAnnualInterest, uint256 _newInterestPerSecond)"];
            let iface = new ethers.utils.Interface(ABI);
            const calldata = iface.encodeFunctionData("setInterest", [newAnnualInterest, newInterestPerSecond]);

            await multisig.executeCall(ibAlluoCurrent.address, calldata);

            await skipDays(365);

            //balance is the same
            let newBalance = await ibAlluoCurrent.getBalance(signers[3].address);
            expect(newBalance).to.be.lt(parseUnits("116.1", await ibAlluoCurrent.decimals()));
        });
    });

    describe('Token basic functionality', function () {
        describe("Tokenomics and Info", function () {
            it("Should return basic information", async function () {
                expect(await ibAlluoCurrent.name()).to.equal("Interest Bearing Alluo USD"),
                    expect(await ibAlluoCurrent.symbol()).to.equal("IbAlluoUSD"),
                    expect(await ibAlluoCurrent.decimals()).to.equal(18);
            });
            it("Should return the total supply equal to 0", async function () {
                expect(await ibAlluoCurrent.totalSupply()).to.equal(0);
            });
        });
        describe("Balances", function () {
            it('When the requested account has no tokens it returns zero', async function () {
                expect(await ibAlluoCurrent.balanceOf(signers[1].address)).to.equal("0");
            });

            it('When the requested account has some tokens it returns the amount', async function () {
                await deposit(signers[1], dai, parseEther('50'));
                expect(await ibAlluoCurrent.balanceOf(signers[1].address)).to.equal(parseEther('50'));
            });

        });
        describe("Transactions", function () {
            describe("Should fail when", function () {

                it('transfer to zero address', async function () {
                    await deposit(signers[1], dai, parseEther('50'))
                    await expect(ibAlluoCurrent.transfer(ethers.constants.AddressZero, parseEther('50'))).to.be.revertedWith("SuperfluidToken: burn amount exceeds balance");
                });

                it('sender doesn\'t have enough tokens', async function () {
                    await expect(ibAlluoCurrent.connect(signers[1]).transfer(signers[2].address, parseEther('100'))).to.be.revertedWith("SuperfluidToken: burn amount exceeds balance");
                });

                it('transfer amount exceeds allowance', async function () {
                    await expect(ibAlluoCurrent.transferFrom(signers[1].address, signers[2].address, parseEther('100'))).to.be.revertedWith("ERC20: insufficient allowance");
                });
            });
            describe("Should transfer when everything is correct", function () {
                it('from signer1 to signer2 with correct balances at the end', async function () {
                    await deposit(signers[1], dai, parseEther('50'));
                    await ibAlluoCurrent.connect(signers[1]).transfer(signers[2].address, parseEther('25'));
                    const addr1Balance = await ibAlluoCurrent.balanceOf(signers[1].address);
                    const addr2Balance = await ibAlluoCurrent.balanceOf(signers[2].address);
                    expect(addr1Balance).to.equal(parseEther('25'));
                    expect(addr2Balance).to.equal(parseEther('25'));
                });
            });

        });

        describe('Approve', function () {
            it("Approving and TransferFrom", async function () {
                await deposit(signers[1], dai, parseEther('100'));
                await ibAlluoCurrent.connect(signers[1]).approve(signers[2].address, parseEther('50'));
                expect(await ibAlluoCurrent.allowance(signers[1].address, signers[2].address)).to.equal(parseEther('50'));

                await ibAlluoCurrent.connect(signers[2]).transferFrom(signers[1].address, signers[2].address, parseEther("50"))
                let balance = await ibAlluoCurrent.balanceOf(signers[1].address);
                expect(balance).to.equal(parseEther('50'));
            });
            it("Not approving becouse of zero address", async function () {
                await expect(ibAlluoCurrent.approve(ethers.constants.AddressZero, parseEther('100'))).to.be.revertedWith("ERC20: approve to the zero address");
            });

            it("increasing and decreasing allowance", async function () {
                await deposit(signers[1], dai, parseEther('100'));
                await ibAlluoCurrent.connect(signers[1]).increaseAllowance(signers[2].address, parseEther('50'));
                expect(await ibAlluoCurrent.allowance(signers[1].address, signers[2].address)).to.equal(parseEther('50'));

                await expect(
                        ibAlluoCurrent.connect(signers[2]).transferFrom(signers[1].address, signers[2].address, parseEther("60")))
                    .to.be.revertedWith("ERC20: insufficient allowance");
                await ibAlluoCurrent.connect(signers[1]).increaseAllowance(signers[2].address, parseEther('20'));
                await ibAlluoCurrent.connect(signers[1]).decreaseAllowance(signers[2].address, parseEther('10'));
                await ibAlluoCurrent.connect(signers[2]).transferFrom(signers[1].address, signers[2].address, parseEther("60"))
                await expect(
                        ibAlluoCurrent.connect(signers[1]).decreaseAllowance(signers[2].address, parseEther("50")))
                    .to.be.revertedWith("ERC20: decreased allowance below zero");

                let balance = await ibAlluoCurrent.balanceOf(signers[1].address);
                expect(balance).to.equal(parseEther('40'));
            });
        });
        describe('Mint / Burn', function () {
            it("burn fails because the amount exceeds the balance", async function () {
                await deposit(signers[1], dai, parseEther('100'));
                await expect(ibAlluoCurrent.connect(signers[1]).withdraw(dai.address, parseEther('200'))).to.be.revertedWith("SuperfluidToken: burn amount exceeds balance");
            });
        });
    });

    describe('Admin and core functionality', function () {

        it("Should allow deposit", async function () {
            // address that will get minted tokens
            const recipient = signers[1];
            // amount of tokens to be minted, including decimals value of token
            const amount = ethers.utils.parseUnits("10.0", await ibAlluoCurrent.decimals());

            expect(await ibAlluoCurrent.balanceOf(recipient.address)).to.be.equal(0);

            await deposit(recipient, dai, amount);

            expect(await ibAlluoCurrent.balanceOf(recipient.address)).to.be.equal(amount);
        });

        it("Should allow user to burn tokens for withdrawal", async () => {
            const recipient = signers[1];
            const amount = ethers.utils.parseUnits("10.0", await ibAlluoCurrent.decimals());

            await deposit(recipient, dai, amount);

            await expect(ibAlluoCurrent.connect(recipient).withdraw(dai.address, amount))
                .to.emit(ibAlluoCurrent, "BurnedForWithdraw")
                .withArgs(recipient.address, amount);
        });

        it("Should grant role that can be granted only to contract", async () => {
            const role = await ibAlluoCurrent.DEFAULT_ADMIN_ROLE();
            const NewContract = await ethers.getContractFactory('PseudoMultisigWallet') as PseudoMultisigWallet__factory;
            const newContract = await NewContract.deploy(true);

            expect(await ibAlluoCurrent.hasRole(role, newContract.address)).to.be.false;

            let calldata = await prepareCallData("role", [role, newContract.address])

            await multisig.executeCall(ibAlluoCurrent.address, calldata);

            expect(await ibAlluoCurrent.hasRole(role, newContract.address)).to.be.true;
        });

        it("Should not grant role that can be granted only to contract", async () => {
            const role = await ibAlluoCurrent.DEFAULT_ADMIN_ROLE();
            const target = signers[1];

            expect(await ibAlluoCurrent.hasRole(role, target.address)).to.be.false;

            let calldata = await prepareCallData("role", [role, target.address])

            const tx = multisig.executeCall(ibAlluoCurrent.address, calldata);

            expect(tx).to.be.revertedWith("IbAlluo: Not contract");
        });

        it("Should grant role that can be granted to anyone", async () => {
            const role = await ibAlluoCurrent.UPGRADER_ROLE();
            const target = signers[1];

            expect(await ibAlluoCurrent.hasRole(role, target.address)).to.be.false;


            let calldata = await prepareCallData("role", [role, target.address])

            const tx = multisig.executeCall(ibAlluoCurrent.address, calldata);
        });

        it("Should set new interest", async () => {
            const newAnnualInterest = 800;
            const newInterestPerSecond = BigNumber.from("100000000154712595");
            const realNewInterestPerSecond = BigNumber.from("1000000001547125950000000000");

            const oldAnnualInterest = await ibAlluoCurrent.annualInterest();
            const oldInterestPerSecond = await ibAlluoCurrent.interestPerSecond();

            expect(newAnnualInterest).to.be.not.equal(oldAnnualInterest);
            expect(newInterestPerSecond).to.be.not.equal(oldInterestPerSecond);

            let ABI = ["function setInterest(uint256 _newAnnualInterest, uint256 _newInterestPerSecond)"];
            let iface = new ethers.utils.Interface(ABI);
            const calldata = iface.encodeFunctionData("setInterest", [newAnnualInterest, newInterestPerSecond]);

            await expect(multisig.executeCall(ibAlluoCurrent.address, calldata))
                .to.emit(ibAlluoCurrent, "InterestChanged")
                .withArgs(
                    oldAnnualInterest,
                    newAnnualInterest,
                    oldInterestPerSecond,
                    realNewInterestPerSecond
                );
        });

        it("Should not set new interest (caller without DEFAULT_ADMIN_ROLE)", async () => {
            const newAnnualInterest = 1600;
            const newInterestPerSecond = BigNumber.from("100000000470636749");
            const role = await ibAlluoCurrent.DEFAULT_ADMIN_ROLE();
            const notAdmin = signers[1];

            await expect(ibAlluoCurrent.connect(notAdmin).setInterest(newAnnualInterest, newInterestPerSecond)).to.be
                .revertedWith(`AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`);
        });

        it("Should pause all public/external user functions", async () => {
            const address1 = signers[1];
            const address2 = signers[2];
            const amount = ethers.utils.parseUnits("5.0", await ibAlluoCurrent.decimals());

            await deposit(address1, usdc, parseUnits("15.0", 6))

            expect(await ibAlluoCurrent.paused()).to.be.false;

            let ABI = ["function pause()"];
            let iface = new ethers.utils.Interface(ABI);
            const calldata = iface.encodeFunctionData("pause", []);

            await multisig.executeCall(ibAlluoCurrent.address, calldata);

            expect(await ibAlluoCurrent.paused()).to.be.true;

            await expect(ibAlluoCurrent.connect(address1).transfer(address1.address, amount)).to.be.revertedWith("Pausable: paused");
            await expect(ibAlluoCurrent.approve(address1.address, amount)).to.be.revertedWith("Pausable: paused");
            await expect(ibAlluoCurrent.transferFrom(address1.address, address2.address, amount)).to.be.revertedWith("Pausable: paused");
            await expect(ibAlluoCurrent.increaseAllowance(address1.address, amount)).to.be.revertedWith("Pausable: paused");
            await expect(ibAlluoCurrent.decreaseAllowance(address1.address, amount)).to.be.revertedWith("Pausable: paused");

            await expect(ibAlluoCurrent.updateRatio()).to.be.revertedWith("Pausable: paused");
            await expect(ibAlluoCurrent.connect(address1).withdraw(dai.address, amount)).to.be.revertedWith("Pausable: paused");
            await expect(deposit(address1, usdc, parseUnits("15.0", 6))).to.be.revertedWith("Pausable: paused");
        });

        it("Should unpause all public/external user functions", async () => {
            let ABI1 = ["function pause()"];
            let iface1 = new ethers.utils.Interface(ABI1);
            const calldata1 = iface1.encodeFunctionData("pause", []);

            await multisig.executeCall(ibAlluoCurrent.address, calldata1);

            let ABI2 = ["function unpause()"];
            let iface2 = new ethers.utils.Interface(ABI2);
            const calldata2 = iface2.encodeFunctionData("unpause", []);

            await multisig.executeCall(ibAlluoCurrent.address, calldata2);

            expect(await ibAlluoCurrent.paused()).to.be.false;
        });

        it("Should set new updateRatio time limit", async () => {
            const newLimit = 120;
            const oldLimit = await ibAlluoCurrent.updateTimeLimit();

            expect(newLimit).to.not.be.equal(oldLimit);

            let ABI = ["function setUpdateTimeLimit(uint256 _newLimit)"];
            let iface = new ethers.utils.Interface(ABI);
            const calldata = iface.encodeFunctionData("setUpdateTimeLimit", [newLimit]);

            await expect(multisig.executeCall(ibAlluoCurrent.address, calldata)).to.emit(ibAlluoCurrent, "UpdateTimeLimitSet").withArgs(oldLimit, newLimit);
        });

        it("Should not set new updateRatio time limit (caller without DEFAULT_ADMIN_ROLE)", async () => {
            const newLimit = 7200;
            const notAdmin = signers[1];
            const role = await ibAlluoCurrent.DEFAULT_ADMIN_ROLE();

            await expect(ibAlluoCurrent.connect(notAdmin).setUpdateTimeLimit(newLimit)).to.be
                .revertedWith(`AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`);
        });

        it("Should add new deposit token and allow to deposit with it", async () => {


            let ABI = ["function changeTokenStatus(address _token, bool _status)"];
            let iface = new ethers.utils.Interface(ABI);
            const calldata = iface.encodeFunctionData("changeTokenStatus", [usdt.address, true]);

            await multisig.executeCall(ibAlluoCurrent.address, calldata);

            const recipient = signers[1];

            const amount = "135.3";
            let amountIn6 = ethers.utils.parseUnits(amount, 6)

            await deposit(recipient, usdt, amountIn6);

            await deposit(signers[1], dai, parseUnits("2000", 18));
            await deposit(signers[2], usdc, parseUnits("3000", 6));
            await deposit(signers[3], usdt, parseUnits("5000", 6));

            await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther("150"))
            await ibAlluoCurrent.connect(signers[2]).withdraw(usdc.address, parseEther("150"))
            await ibAlluoCurrent.connect(signers[3]).withdraw(dai.address, parseEther("150"))

            await deposit(signers[1], dai, parseUnits("100", 18));
            await deposit(signers[2], usdc, parseUnits("100", 6));
            await deposit(signers[3], usdt, parseUnits("100", 6));

            await curveLpUSD.connect(curveUsdLpHolder).transfer(usdAdapter.address, parseEther("300"));

            await deposit(signers[1], dai, parseUnits("1000", 18));
            await deposit(signers[2], usdc, parseUnits("1000", 6));
            await deposit(signers[3], usdt, parseUnits("1000", 6));

            await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther("900"))
            await deposit(signers[2], usdc, parseUnits("100", 6));
            await deposit(signers[2], usdt, parseUnits("900", 6));
            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);
            await ibAlluoCurrent.connect(signers[1]).withdraw(usdt.address, parseEther("600"))

            await ibAlluoCurrent.connect(signers[1]).withdraw(dai.address, parseEther("100"))
            await ibAlluoCurrent.connect(signers[2]).withdraw(usdc.address, parseEther("100"))
            await ibAlluoCurrent.connect(signers[3]).withdraw(usdt.address, parseEther("100"))
            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);
            await deposit(signers[2], usdt, parseUnits("300", 6));
            await handler.satisfyAdapterWithdrawals(ibAlluoCurrent.address);
        });
    });

    async function deposit(recipient: SignerWithAddress, token: IERC20, amount: BigNumberish) {
        await token.connect(usdWhale).transfer(recipient.address, amount);

        await token.connect(recipient).approve(ibAlluoCurrent.address, amount);

        await ibAlluoCurrent.connect(recipient).deposit(token.address, amount);
    }

});