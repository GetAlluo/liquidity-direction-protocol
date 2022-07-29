import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { before } from "mocha";
import { IERC20, PseudoMultisigWallet, PseudoMultisigWallet__factory, IbAlluo, IbAlluo__factory, LiquidityHandler, UsdCurveAdapter, BtcCurveAdapter, LiquidityHandler__factory, UsdCurveAdapter__factory, EurCurveAdapter, EthNoPoolAdapter, EurCurveAdapter__factory, EthNoPoolAdapter__factory, BtcCurveAdapter__factory, StIbAlluo, StIbAlluo__factory } from "../typechain";

async function getLastWithdrawalInfo(token: IbAlluo, handler: LiquidityHandler) {
    let request = (await handler.ibAlluoToWithdrawalSystems(token.address)).lastWithdrawalRequest
    let satisfied = (await handler.ibAlluoToWithdrawalSystems(token.address)).lastSatisfiedWithdrawal
    let total = (await handler.ibAlluoToWithdrawalSystems(token.address)).totalWithdrawalAmount
    return [request, satisfied, total]
}

async function getImpersonatedSigner(address: string): Promise < SignerWithAddress > {
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

describe("Handler and different adapters", function () {
    let signers: SignerWithAddress[];
    let admin: SignerWithAddress;

    let ibAlluoUsd: IbAlluo;
    let ibAlluoEur: IbAlluo;
    let ibAlluoEth: IbAlluo;
    let ibAlluoBtc: IbAlluo;

    let StIbAlluoUsd: StIbAlluo;
    let StIbAlluoEur: StIbAlluo;
    let StIbAlluoEth: StIbAlluo;
    let StIbAlluoBtc: StIbAlluo;

    let usdAdapter: UsdCurveAdapter;
    let eurAdapter: EurCurveAdapter;
    let ethAdapter: EthNoPoolAdapter;
    let btcAdapter: BtcCurveAdapter;

    let handler: LiquidityHandler;

    let dai: IERC20, usdc: IERC20, usdt: IERC20;
    let curveLpUSD: IERC20;

    let usdWhale: SignerWithAddress;
    let curveUsdLpHolder: SignerWithAddress;

    let jeur: IERC20, par: IERC20, eurt: IERC20, eurs: IERC20;
    let curveLpEUR: IERC20;

    let jeurWhale: SignerWithAddress;
    let parWhale: SignerWithAddress;
    let eurtWhale: SignerWithAddress;
    let eursWhale: SignerWithAddress;

    let weth: IERC20;

    let wethWhale: SignerWithAddress;

    let wbtc: IERC20, renBtc: IERC20;
    let curveLpBTC: IERC20;

    let wbtcWhale: SignerWithAddress;
    let renBtcWhale: SignerWithAddress;

    before(async function () {
        //We are forking Polygon mainnet, please set Alchemy key in .env
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.POLYGON_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 28729129,
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

        jeurWhale = await getImpersonatedSigner("0x00d7c133b923548f29cc2cc01ecb1ea2acdf2d4c");
        parWhale = await getImpersonatedSigner("0xac3203d77823496e421aa7e88cdc2f6c387d6182");
        eurtWhale = await getImpersonatedSigner("0x1a4b038c31a8e5f98b00016b1005751296adc9a4");
        eursWhale = await getImpersonatedSigner("0x6de2865067b65d4571c17f6b9eeb8dbdd5e36584");

        wethWhale = await getImpersonatedSigner("0x72a53cdbbcc1b9efa39c834a540550e23463aacb");


        wbtcWhale = await getImpersonatedSigner("0xF9930a9d65cc57d024CF9149AE67e66c7a77E167");
        renBtcWhale = await getImpersonatedSigner("0x7477a4d4bf17c4eae4f41493b7b49a2d8901ab45");

        dai = await ethers.getContractAt("IERC20", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063");
        usdc = await ethers.getContractAt("IERC20", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
        usdt = await ethers.getContractAt("IERC20", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
        curveLpUSD = await ethers.getContractAt("IERC20", "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171");

        jeur = await ethers.getContractAt("IERC20", "0x4e3Decbb3645551B8A19f0eA1678079FCB33fB4c");
        par = await ethers.getContractAt("IERC20", "0xE2Aa7db6dA1dAE97C5f5C6914d285fBfCC32A128");
        eurt = await ethers.getContractAt("IERC20", "0x7BDF330f423Ea880FF95fC41A280fD5eCFD3D09f");
        eurs = await ethers.getContractAt("IERC20", "0xE111178A87A3BFf0c8d18DECBa5798827539Ae99");

        weth = await ethers.getContractAt("IERC20", "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619");

        wbtc = await ethers.getContractAt("IERC20", "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6");
        renBtc = await ethers.getContractAt("IERC20", "0xDBf31dF14B66535aF65AaC99C32e9eA844e14501");
        curveLpBTC = await ethers.getContractAt("IERC20", "0xf8a57c1d3b9629b77b6726a042ca48990A84Fb49");

        console.log("We are forking Polygon mainnet\n");
        expect(await dai.balanceOf(usdWhale.address)).to.be.gt(0, "Whale has no DAI, or you are not forking Polygon");
        expect(await usdc.balanceOf(usdWhale.address)).to.be.gt(0, "Whale has no USDC, or you are not forking Polygon");
        expect(await usdt.balanceOf(usdWhale.address)).to.be.gt(0, "Whale has no USDT, or you are not forking Polygon");
        expect(await jeur.balanceOf(jeurWhale.address)).to.be.gt(0, "Whale has no jeur, or you are not forking Polygon");
        expect(await par.balanceOf(parWhale.address)).to.be.gt(0, "Whale has no par, or you are not forking Polygon");
        expect(await eurt.balanceOf(eurtWhale.address)).to.be.gt(0, "Whale has no eurt, or you are not forking Polygon");
        expect(await eurs.balanceOf(eursWhale.address)).to.be.gt(0, "Whale has no eurs, or you are not forking Polygon");
        expect(await weth.balanceOf(wethWhale.address)).to.be.gt(0, "Whale has no weth, or you are not forking Polygon");
        expect(await wbtc.balanceOf(wbtcWhale.address)).to.be.gt(0, "Whale has no wbtc, or you are not forking Polygon");
        expect(await renBtc.balanceOf(renBtcWhale.address)).to.be.gt(0, "Whale has no renBtc, or you are not forking Polygon");

        await sendEth([usdWhale, jeurWhale, parWhale, eurtWhale, eursWhale, wethWhale, wbtcWhale, renBtcWhale])
    });


    beforeEach(async function () {
        const exchangeAddress = "0x6b45B9Ab699eFbb130464AcEFC23D49481a05773"; 
        const IbAlluo = await ethers.getContractFactory("IbAlluo") as IbAlluo__factory;
        //We are using this contract to simulate Gnosis multisig wallet

        const Handler = await ethers.getContractFactory("LiquidityHandler") as LiquidityHandler__factory;
        // Temp values for exchange stuff.
        handler = await upgrades.deployProxy(Handler,
            [admin.address, exchangeAddress], {
                initializer: 'initialize',
                kind: 'uups'
            }
        ) as LiquidityHandler;

        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), admin.address)

        const UsdAdapter = await ethers.getContractFactory("UsdCurveAdapter") as UsdCurveAdapter__factory;
        const EurAdapter = await ethers.getContractFactory("EurCurveAdapter") as EurCurveAdapter__factory;
        const EthAdapter = await ethers.getContractFactory("EthNoPoolAdapter") as EthNoPoolAdapter__factory;
        const BtcAdapter = await ethers.getContractFactory("BtcCurveAdapter") as BtcCurveAdapter__factory;

        eurAdapter = await EurAdapter.deploy(admin.address, handler.address, 200);
        usdAdapter = await UsdAdapter.deploy(admin.address, handler.address, 200);
        ethAdapter = await EthAdapter.deploy(admin.address, handler.address);
        btcAdapter = await BtcAdapter.deploy(admin.address, handler.address, 200);

        await usdAdapter.connect(admin).adapterApproveAll()
        await handler.connect(admin).setAdapter(
            1,
            "USD Curve-Aave",
            500,
            usdAdapter.address,
            true
        )

        await eurAdapter.connect(admin).adapterApproveAll()
        await handler.connect(admin).setAdapter(
            2,
            "EUR Curve-Aave",
            500,
            eurAdapter.address,
            true
        )

        await handler.connect(admin).setAdapter(
            3,
            "ETH No Pool Adapter",
            500,
            ethAdapter.address,
            true
        )

        await handler.connect(admin).setAdapter(
            4,
            "BTC Curve-Ren",
            500,
            btcAdapter.address,
            true
        )

        ibAlluoUsd = await upgrades.deployProxy(IbAlluo,
            [
                "Interest Bearing Alluo USD",
                "ibAlluoUsd",
                admin.address,
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

        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), ibAlluoUsd.address)
        await handler.connect(admin).setIbAlluoToAdapterId(ibAlluoUsd.address, 1)



        ibAlluoEur = await upgrades.deployProxy(IbAlluo,
            [
                "Interest Bearing Alluo EUR",
                "ibAlluoEur",
                admin.address,
                handler.address,
                [jeur.address,
                    par.address,
                    eurt.address,
                    eurs.address
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

        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), ibAlluoEur.address)
        await handler.connect(admin).setIbAlluoToAdapterId(ibAlluoEur.address, 2)
        ibAlluoEth = await upgrades.deployProxy(IbAlluo,
            [
                "Interest Bearing Alluo ETH",
                "ibAlluoEth",
                admin.address,
                handler.address,
                [weth.address],
                BigNumber.from("100000000470636740"),
                1600,
                "0x86C80a8aa58e0A4fa09A69624c31Ab2a6CAD56b8",
                exchangeAddress
            ], {
                initializer: 'initialize',
                kind: 'uups'
            }
        ) as IbAlluo;


        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), ibAlluoEth.address)
        await handler.connect(admin).setIbAlluoToAdapterId(ibAlluoEth.address, 3)

        ibAlluoBtc = await upgrades.deployProxy(IbAlluo,
            [
                "Interest Bearing Alluo BTC",
                "ibAlluoBtc",
                admin.address,
                handler.address,
                [wbtc.address,
                    renBtc.address
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


        await handler.connect(admin).grantRole(await handler.DEFAULT_ADMIN_ROLE(), ibAlluoBtc.address)
        await handler.connect(admin).setIbAlluoToAdapterId(ibAlluoBtc.address, 4)

        
        let StIbAlluoEur: StIbAlluo;
        let StIbAlluoEth: StIbAlluo;
        let StIbAlluoBtc: StIbAlluo;
        const StIbAlluoFactory = await ethers.getContractFactory("StIbAlluo") as StIbAlluo__factory;

        StIbAlluoUsd = await upgrades.deployProxy(StIbAlluoFactory,
            [ibAlluoUsd.address, 18, "Streaming IbAlluo USD", "StIbAlluoUSD", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", admin.address,[ibAlluoUsd.address]
            ], {
                initializer: 'alluoInitialize',
                kind: 'uups'
            }
        ) as StIbAlluo;

        StIbAlluoEth = await upgrades.deployProxy(StIbAlluoFactory,
            [ibAlluoEth.address, 18, "Streaming IbAlluo ETH", "StIbAlluoEth", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7",admin.address, [ibAlluoEth.address]
            ], {
                initializer: 'alluoInitialize',
                kind: 'uups'
            }
        ) as StIbAlluo;


        StIbAlluoEur = await upgrades.deployProxy(StIbAlluoFactory,
            [ibAlluoEur.address, 18, "Streaming IbAlluo Eur", "StIbAlluoEUR", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", admin.address,[ibAlluoEur.address]
            ], {
                initializer: 'alluoInitialize',
                kind: 'uups'
            }
        ) as StIbAlluo;


        StIbAlluoBtc = await upgrades.deployProxy(StIbAlluoFactory,
            [ibAlluoBtc.address, 18, "Streaming IbAlluo Btc", "StIbAlluoBTC", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", admin.address,[ibAlluoBtc.address]
            ], {
                initializer: 'alluoInitialize',
                kind: 'uups'
            }
        ) as StIbAlluo;


        await ibAlluoBtc.connect(admin).setSuperToken(StIbAlluoBtc.address);
        await ibAlluoUsd.connect(admin).setSuperToken(StIbAlluoUsd.address);
        await ibAlluoEur.connect(admin).setSuperToken(StIbAlluoEur.address);
        await ibAlluoEth.connect(admin).setSuperToken(StIbAlluoEth.address);
    });


    describe('BTC Adaptor with IbAlluo: Test cases', function () {
        it("Depositing 1 wbtc and immediately attempting to withdraw 0.5 should put you in the waiting list", async function () {
            await deposit(signers[0], wbtc, parseUnits("1", 8));
            await ibAlluoBtc.connect(signers[0]).withdraw(wbtc.address, parseUnits("0.5", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoBtc, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 1 wbtc, attempt to withdraw 0.5 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], wbtc, parseUnits("1", 8));
            await ibAlluoBtc.connect(signers[0]).withdraw(wbtc.address, parseUnits("0.5", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoBtc, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], wbtc, parseUnits("1", 8));
            await handler.satisfyAdapterWithdrawals(ibAlluoBtc.address);
            // Loss from slippage makes tests awkward.

            expect(Number(await wbtc.balanceOf(signers[0].address))).lessThan(Number(parseUnits("0.51", 8)))
            expect(Number(await wbtc.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("0.49", 8)))
        })

        it("Depositing 0.1 renBtc and immediately attempting to withdraw 0.05 should put you in the waiting list", async function () {
            await deposit(signers[0], renBtc, parseUnits("0.1", 8));
            await ibAlluoBtc.connect(signers[0]).withdraw(renBtc.address, parseUnits("0.05", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoBtc, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 0.1 renBtc, attempt to withdraw 0.05 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], renBtc, parseUnits("0.1", 8));
            await ibAlluoBtc.connect(signers[0]).withdraw(renBtc.address, parseUnits("0.05", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoBtc, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], renBtc, parseUnits("0.1", 8));
            await handler.satisfyAdapterWithdrawals(ibAlluoBtc.address);
            // Loss from slippage makes tests awkward.

            expect(Number(await renBtc.balanceOf(signers[0].address))).lessThan(Number(parseUnits("0.051", 8)))
            expect(Number(await renBtc.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("0.049", 8)))
        })

        it("The balance of the multisig wallet should increase with deposits.", async function () {
            let walletBalance = await wbtc.balanceOf(admin.address);

            await deposit(signers[0], wbtc, parseUnits("1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await wbtc.balanceOf(admin.address);

            await deposit(signers[0], renBtc, parseUnits("0.1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await wbtc.balanceOf(admin.address);

            await deposit(signers[0], wbtc, parseUnits("1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await wbtc.balanceOf(admin.address);

            await deposit(signers[0], renBtc, parseUnits("0.1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await wbtc.balanceOf(admin.address);

            await deposit(signers[0], wbtc, parseUnits("1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await wbtc.balanceOf(admin.address);

            await deposit(signers[0], renBtc, parseUnits("0.1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await wbtc.balanceOf(admin.address);
            console.log("Final multisig balance:", walletBalance);

        })
        it("Attemping to withdraw more than allowed causes revert.", async function () {
            let walletBalance = await wbtc.balanceOf(admin.address);
            await deposit(signers[1], wbtc, parseUnits("1", 8));
            expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            await expect(ibAlluoBtc.connect(signers[1]).withdraw(wbtc.address, parseUnits("2", 18))).to.be.revertedWith('SuperfluidToken: burn amount exceeds balance')
        })
        describe('BTC Mass deposits and withdrawal test cases', function () {
            it("Multiple deposits and withdrawals: Eventually, all withdrawers should be paid", async function () {
                let walletBalance = await wbtc.balanceOf(admin.address);
                let userBalanceAtStart = await wbtc.balanceOf(signers[0].address);

                await deposit(signers[0], wbtc, parseUnits("1", 8));
                expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await wbtc.balanceOf(admin.address);

                await deposit(signers[2], renBtc, parseUnits("0.1", 8));
                expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await wbtc.balanceOf(admin.address);

                await ibAlluoBtc.connect(signers[0]).withdraw(wbtc.address, parseUnits("0.5", 18));
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoBtc, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

                await ibAlluoBtc.connect(signers[2]).withdraw(renBtc.address, parseUnits("0.05", 18));
                withdrawalArray = await getLastWithdrawalInfo(ibAlluoBtc, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

                // When there are deposits, should pay everyone back.
                await deposit(signers[2], renBtc, parseUnits("2", 8));
                await handler.satisfyAdapterWithdrawals(ibAlluoBtc.address);
                expect(Number(await wbtc.balanceOf(admin.address))).greaterThan(Number(walletBalance))

                let delta = (await wbtc.balanceOf(signers[0].address)).sub(userBalanceAtStart)

                expect(Number(delta)).lessThan(Number(parseUnits("0.51", 8)))
                expect(Number(delta)).greaterThanOrEqual(Number(parseUnits("0.49", 8)))
                expect(Number(await renBtc.balanceOf(signers[2].address))).lessThan(Number(parseUnits("0.051", 8)))
                expect(Number(await renBtc.balanceOf(signers[2].address))).greaterThanOrEqual(Number(parseUnits("0.049", 8)))
            })
        })
    })


    describe("EThAdapter no pool: Test cases", function () {
        it("Depositing 100 weth and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], weth, parseEther("100"));
            await ibAlluoEth.connect(signers[0]).withdraw(weth.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEth, handler)

            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 100 weth, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], weth, parseEther("100"));
            await ibAlluoEth.connect(signers[0]).withdraw(weth.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEth, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], weth, parseEther("100"));
            await handler.satisfyAdapterWithdrawals(ibAlluoEth.address);

            expect(await weth.balanceOf(signers[0].address)).equal(parseEther("50"))
        })

        it("The balance of the multisig wallet should increase with weth deposits.", async function () {
            let walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            //console.log("Final multisig balance:", walletBalance);

        })
        it("Attemping to withdraw more weth than allowed causes revert.", async function () {
            let walletBalance = await weth.balanceOf(admin.address);
            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await expect(ibAlluoEth.connect(signers[1]).withdraw(weth.address, parseUnits("500", 18))).to.be.revertedWith('SuperfluidToken: burn amount exceeds balance')
        })


    })
    describe('weth Mass deposits and withdrawal test cases', function () {
        it("Multiple deposits and withdrawals: Eventually, all withdrawers should be paid", async function () {
            let walletBalance = await weth.balanceOf(admin.address);
            let userBalanceAtStart = await weth.balanceOf(signers[0].address);

            await deposit(signers[0], weth, parseEther("100"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[1], weth, parseEther("50"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await deposit(signers[2], weth, parseEther("180"));
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await weth.balanceOf(admin.address);

            await ibAlluoEth.connect(signers[0]).withdraw(weth.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEth, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await ibAlluoEth.connect(signers[1]).withdraw(weth.address, parseEther("35"));
            withdrawalArray = await getLastWithdrawalInfo(ibAlluoEth, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await ibAlluoEth.connect(signers[2]).withdraw(weth.address, parseEther("180"));
            withdrawalArray = await getLastWithdrawalInfo(ibAlluoEth, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            // When there are deposits, should pay everyone back.
            await deposit(signers[2], weth, parseUnits("1000", 18));
            await handler.satisfyAdapterWithdrawals(ibAlluoEth.address);
            expect(Number(await weth.balanceOf(admin.address))).greaterThan(Number(walletBalance))

            let delta = (await weth.balanceOf(signers[0].address)).sub(userBalanceAtStart)

            expect(Number(delta)).lessThan(Number(parseUnits("51", 18)))
            expect(Number(delta)).greaterThanOrEqual(Number(parseUnits("49", 18)))
            expect(Number(await weth.balanceOf(signers[1].address))).lessThan(Number(parseUnits("36", 18)))
            expect(Number(await weth.balanceOf(signers[1].address))).greaterThanOrEqual(Number(parseUnits("34", 18)))
            expect(Number(await weth.balanceOf(signers[2].address))).lessThan(Number(parseUnits("181", 18)))
            expect(Number(await weth.balanceOf(signers[2].address))).greaterThanOrEqual(Number(parseUnits("179", 18)))

        })
    })


    describe('EUR Adaptor with IbAlluo: Test cases', function () {
        it("Depositing 100 jeur and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], jeur, parseEther("100"));
            await ibAlluoEur.connect(signers[0]).withdraw(jeur.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 100 jeur, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], jeur, parseEther("100"));
            await ibAlluoEur.connect(signers[0]).withdraw(jeur.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], jeur, parseEther("100"));
            await handler.satisfyAdapterWithdrawals(ibAlluoEur.address);
            // Loss from slippage makes tests awkward.

            expect(Number(await jeur.balanceOf(signers[0].address))).lessThan(Number(parseUnits("51", 18)))
            expect(Number(await jeur.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 18)))
        })

        it("Depositing 100 par and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], par, parseEther("100"));
            await ibAlluoEur.connect(signers[0]).withdraw(par.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 100 par, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], par, parseEther("100"));
            await ibAlluoEur.connect(signers[0]).withdraw(par.address, parseEther("50"));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], par, parseEther("100"));
            await handler.satisfyAdapterWithdrawals(ibAlluoEur.address);
            // Loss from slippage makes tests awkward.

            expect(Number(await par.balanceOf(signers[0].address))).lessThan(Number(parseUnits("51", 18)))
            expect(Number(await par.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 18)))
        })

        it("Depositing 100 eurt and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], eurt, parseUnits("100", 6));
            await ibAlluoEur.connect(signers[0]).withdraw(eurt.address, parseUnits("100", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 100 eurt, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], eurt, parseUnits("100", 6));
            await ibAlluoEur.connect(signers[0]).withdraw(eurt.address, parseUnits("50", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], eurt, parseUnits("100", 6));
            await handler.satisfyAdapterWithdrawals(ibAlluoEur.address);
            expect(Number(await eurt.balanceOf(signers[0].address))).lessThan(Number(parseUnits("51", 6)))
            expect(Number(await eurt.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
        })

        it("Depositing 100 eurs and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], eurs, parseUnits("100", 2));
            await ibAlluoEur.connect(signers[0]).withdraw(eurs.address, parseUnits("50", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
        })
        it("Depositing 100 eurs, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], eurs, parseUnits("100", 2));
            await ibAlluoEur.connect(signers[0]).withdraw(eurs.address, parseUnits("50", 18));
            let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
            expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

            await deposit(signers[1], eurs, parseUnits("100", 2));
            await handler.satisfyAdapterWithdrawals(ibAlluoEur.address);
            expect(Number(await eurs.balanceOf(signers[0].address))).lessThan(Number(parseUnits("51", 2)))
            expect(Number(await eurs.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 2)))
        })

        it("The balance of the multisig wallet should increase with deposits.", async function () {
            let walletBalance = await eurt.balanceOf(admin.address);

            await deposit(signers[0], jeur, parseEther("100"));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);


            await deposit(signers[0], eurt, parseUnits("100", 6));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);

            await deposit(signers[0], eurs, parseUnits("100", 2));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);

            await deposit(signers[0], jeur, parseEther("100"));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);


            await deposit(signers[0], eurt, parseUnits("100", 6));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);

            await deposit(signers[0], eurs, parseUnits("100", 2));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);

            await deposit(signers[0], jeur, parseEther("100"));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);


            await deposit(signers[0], eurt, parseUnits("100", 6));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);

            await deposit(signers[0], eurs, parseUnits("100", 2));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            walletBalance = await eurt.balanceOf(admin.address);

            console.log("Final multisig balance:", walletBalance);

        })
        it("Attemping to withdraw more than allowed causes revert.", async function () {
            let walletBalance = await eurt.balanceOf(admin.address);
            await deposit(signers[1], eurt, parseUnits("100", 6));
            expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
            await expect(ibAlluoEur.connect(signers[1]).withdraw(eurt.address, parseUnits("500", 18))).to.be.revertedWith('SuperfluidToken: burn amount exceeds balance')
        })
        describe('EUR Mass deposits and withdrawal test cases', function () {
            it("Multiple deposits and withdrawals: Eventually, all withdrawers should be paid", async function () {
                let walletBalance = await eurt.balanceOf(admin.address);
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)

                await deposit(signers[0], jeur, parseEther("100"));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[0], par, parseEther("100"));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[1], eurt, parseUnits("100", 6));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[2], eurs, parseUnits("100", 2));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await ibAlluoEur.connect(signers[0]).withdraw(jeur.address, parseEther("50"));
                withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)

                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
                await ibAlluoEur.connect(signers[1]).withdraw(eurt.address, parseUnits("50", 18));
                withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)

                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
                await ibAlluoEur.connect(signers[2]).withdraw(eurs.address, parseUnits("50", 18));
                withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)

                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

                // When there are deposits, should pay everyone back.
                await deposit(signers[2], eurs, parseUnits("1000", 2));
                await handler.satisfyAdapterWithdrawals(ibAlluoEur.address);
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))

                expect(Number(await jeur.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 18)))
                expect(Number(await eurt.balanceOf(signers[1].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
                expect(Number(await eurs.balanceOf(signers[2].address))).greaterThanOrEqual(Number(parseUnits("49", 2)))

                await deposit(signers[0], par, parseEther("100"));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);


                await deposit(signers[0], eurs, parseUnits("100", 2));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[0], jeur, parseEther("100"));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[0], par, parseEther("100"));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[0], eurt, parseUnits("100", 6));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                await deposit(signers[0], eurs, parseUnits("100", 2));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                walletBalance = await eurt.balanceOf(admin.address);

                console.log("Final multisig balance:", walletBalance);

            })
            it("Attemping to withdraw more than allowed causes revert.", async function () {
                let walletBalance = await eurt.balanceOf(admin.address);
                await deposit(signers[1], eurt, parseUnits("100", 6));
                expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                await expect(ibAlluoEur.connect(signers[1]).withdraw(eurt.address, parseUnits("500", 18))).to.be.revertedWith('SuperfluidToken: burn amount exceeds balance')
            })
            describe('EUR Mass deposits and withdrawal test cases', function () {
                it("Multiple deposits and withdrawals: Eventually, all withdrawers should be paid", async function () {
                    let walletBalance = await eurt.balanceOf(admin.address);
                    let userBalanceAtStart = await jeur.balanceOf(signers[0].address);

                    await deposit(signers[0], jeur, parseEther("100"));
                    expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                    walletBalance = await eurt.balanceOf(admin.address);

                    await deposit(signers[11], eurt, parseUnits("100", 6));
                    expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                    walletBalance = await eurt.balanceOf(admin.address);

                    await deposit(signers[12], eurs, parseUnits("100", 2));
                    expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))
                    walletBalance = await eurt.balanceOf(admin.address);

                    await ibAlluoEur.connect(signers[0]).withdraw(jeur.address, parseEther("50"));
                    let withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
                    expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
                    await ibAlluoEur.connect(signers[11]).withdraw(eurt.address, parseUnits("50", 18));
                    withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
                    expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
                    await ibAlluoEur.connect(signers[12]).withdraw(eurs.address, parseUnits("50", 18));
                    withdrawalArray = await getLastWithdrawalInfo(ibAlluoEur, handler)
                    expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

                    // When there are deposits, should pay everyone back.
                    await deposit(signers[2], eurs, parseUnits("1000", 2));
                    await handler.satisfyAdapterWithdrawals(ibAlluoEur.address);
                    expect(Number(await eurt.balanceOf(admin.address))).greaterThan(Number(walletBalance))

                    let delta = (await jeur.balanceOf(signers[0].address)).sub(userBalanceAtStart)

                    expect(Number(delta)).lessThan(Number(parseUnits("51", 18)))
                    expect(Number(delta)).greaterThanOrEqual(Number(parseUnits("49", 18)))
                    expect(Number(await eurt.balanceOf(signers[1].address))).lessThan(Number(parseUnits("51", 6)))
                    expect(Number(await eurt.balanceOf(signers[1].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
                    expect(Number(await eurs.balanceOf(signers[2].address))).lessThan(Number(parseUnits("51", 2)))
                    expect(Number(await eurs.balanceOf(signers[2].address))).greaterThanOrEqual(Number(parseUnits("49", 2)))
                })
            })
        })

        describe("USD Tests", function () {
            it("Depositing 100 DAI and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
                await deposit(signers[0], dai, parseEther("100"));
                await ibAlluoUsd.connect(signers[0]).withdraw(dai.address, parseEther("50"));
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoUsd, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
            })
            it("Depositing 100 DAI, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
                await deposit(signers[0], dai, parseEther("100"));
                await ibAlluoUsd.connect(signers[0]).withdraw(dai.address, parseEther("50"));
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoUsd, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

                await deposit(signers[1], dai, parseEther("100"));
                await handler.satisfyAdapterWithdrawals(ibAlluoUsd.address);
                expect(Number(await dai.balanceOf(signers[0].address))).lessThan(Number(parseUnits("51", 18)))
                expect(Number(await dai.balanceOf(signers[0].address))).greaterThan(Number(parseUnits("49", 18)))

            })

            it("Depositing 100 USDC and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
                await deposit(signers[0], usdc, parseUnits("100", 6));
                await ibAlluoUsd.connect(signers[0]).withdraw(usdc.address, parseUnits("100", 18));
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoUsd, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
            })

            it("Depositing surplus USDC should not revert (Checking USD Adaptor Deposit function: Check toSend", async function () {
                await deposit(signers[0], usdc, parseUnits("100", 6));
                await deposit(signers[0], usdc, parseUnits("100", 6));
                await deposit(signers[0], usdc, parseUnits("100", 6));
                await deposit(signers[0], usdc, parseUnits("100", 6))
            })

            it("Depositing USDC when there is outstanding withdrawals (leaveInPool>0, toSend =0) should not revert (Checking USD Adaptor Deposit function: Check leaveInPool", async function () {
                await deposit(signers[0], usdc, parseUnits("10000", 6));
                await ibAlluoUsd.connect(signers[0]).withdraw(usdc.address, parseUnits("10000", 18));

                await deposit(signers[0], usdc, parseUnits("100", 6));

            })

            it("Depositing 100 USDC, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
                await deposit(signers[0], usdc, parseUnits("100", 6));
                await ibAlluoUsd.connect(signers[0]).withdraw(usdc.address, parseUnits("50", 18));
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoUsd, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);

                await deposit(signers[1], usdc, parseUnits("100", 6));
                await handler.satisfyAdapterWithdrawals(ibAlluoUsd.address);
                expect(Number(await usdc.balanceOf(signers[0].address))).lessThan(Number(parseUnits("51", 6)))
                expect(Number(await usdc.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
            })

            it("Depositing 100 USDT and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
                await deposit(signers[0], usdt, parseUnits("100", 6));
                await ibAlluoUsd.connect(signers[0]).withdraw(usdt.address, parseUnits("50", 18));
                let withdrawalArray = await getLastWithdrawalInfo(ibAlluoUsd, handler)
                expect(withdrawalArray[0]).not.equal(withdrawalArray[1]);
            })
        })
    })

    async function deposit(recipient: SignerWithAddress, token: IERC20, amount: BigNumberish) {

        if (token == eurs) {
            await token.connect(eursWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoEur.address, amount);
            await ibAlluoEur.connect(recipient).deposit(token.address, amount);
        } else if (token == eurt) {
            await token.connect(eurtWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoEur.address, amount);
            await ibAlluoEur.connect(recipient).deposit(token.address, amount);
        } else if (token == jeur) {
            await token.connect(jeurWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoEur.address, amount);
            await ibAlluoEur.connect(recipient).deposit(token.address, amount);
        } else if (token == par) {
            await token.connect(parWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoEur.address, amount);
            await ibAlluoEur.connect(recipient).deposit(token.address, amount);
        } else if (token == weth) {
            await weth.connect(wethWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoEth.address, amount);
            await ibAlluoEth.connect(recipient).deposit(token.address, amount)
        } else if (token == wbtc) {
            await wbtc.connect(wbtcWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoBtc.address, amount);
            await ibAlluoBtc.connect(recipient).deposit(token.address, amount)
        } else if (token == renBtc) {
            await renBtc.connect(renBtcWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoBtc.address, amount);
            await ibAlluoBtc.connect(recipient).deposit(token.address, amount);
        } else {
            await token.connect(usdWhale).transfer(recipient.address, amount);
            await token.connect(recipient).approve(ibAlluoUsd.address, amount);
            await ibAlluoUsd.connect(recipient).deposit(token.address, amount);
        }
    }
})