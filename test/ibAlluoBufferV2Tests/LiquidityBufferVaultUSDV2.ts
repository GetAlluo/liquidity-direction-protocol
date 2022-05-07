import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { before } from "mocha";
import { TestERC20, TestERC20__factory, LiquidityBufferUSDAdaptor, LiquidityBufferUSDAdaptor__factory, IERC20, PseudoMultisigWallet, PseudoMultisigWallet__factory , AlluoLpV3, AlluoLpV3__factory, LiquidityBufferVault, LiquidityBufferVault__factory, LiquidityBufferVaultForTests__factory, LiquidityBufferVaultForTests,  IbAlluo, IbAlluo__factory, IbAlluoV2, LiquidityBufferVaultV2, IbAlluoV2__factory, LiquidityBufferVaultV2__factory, IbAlluoUSD, LiquidityBufferVaultV3, USDAdaptor, IbAlluoUSD__factory, LiquidityBufferVaultV3__factory, USDAdaptor__factory} from "../../typechain";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

function getRandomArbitrary(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
  }

async function  prepareCallData(type: string, parameters: any[]) : Promise<BytesLike>{
    if(type == "status"){
        let ABI = ["function changeUpgradeStatus(bool _status)"];
        let iface = new ethers.utils.Interface(ABI);
        let calldata = iface.encodeFunctionData("changeUpgradeStatus", [parameters[0]]);
        return calldata;
    }
    else if(type == "role"){
        let ABI = ["function grantRole(bytes32 role, address account)"];
        let iface = new ethers.utils.Interface(ABI);
        let calldata = iface.encodeFunctionData("grantRole", [parameters[0], parameters[1]]);
        return calldata;
    }
    else{
        return ethers.utils.randomBytes(0);
    }
}


describe("IbAlluo and Buffer", function () {
    let signers: SignerWithAddress[];
    let whale: SignerWithAddress;
    let curveLpHolder: SignerWithAddress;

    let alluoLpV3: AlluoLpV3;
    let ibAlluoCurrent: IbAlluoUSD;
    let multisig: PseudoMultisigWallet;
    let buffer: LiquidityBufferVaultV3;

    let dai: IERC20, usdc: IERC20, usdt: IERC20;
    let curveLp: IERC20;

    let adaptor: USDAdaptor;
    before(async function () {

        //We are forking Polygon mainnet, please set Alchemy key in .env
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.POLYGON_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 26313740, 
                },
            },],
        });

        signers = await ethers.getSigners();
        const whaleAddress = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8";
        const curveLpHolderAddress = "0xa0f2e2f7b3ab58e3e52b74f08d94ae52778d46df";

        await ethers.provider.send(
            'hardhat_impersonateAccount',
            [whaleAddress]
        );

        await ethers.provider.send(
            'hardhat_impersonateAccount',
            [curveLpHolderAddress]
        );
        
        whale = await ethers.getSigner(whaleAddress);
        curveLpHolder = await ethers.getSigner(curveLpHolderAddress);
        dai = await ethers.getContractAt("IERC20", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063");
        usdc = await ethers.getContractAt("IERC20", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
        usdt = await ethers.getContractAt("IERC20", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
        curveLp = await ethers.getContractAt("IERC20", "0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171");
        
        console.log("We are forking Polygon mainnet\n");
        expect(await dai.balanceOf(whale.address)).to.be.gt(0, "Whale has no DAI, or you are not forking Polygon");

        await signers[0].sendTransaction({
            to: whale.address,
            value: parseEther("100.0")
        });
    });


    beforeEach(async function () {
        const IbAlluo = await ethers.getContractFactory("IbAlluoUSD") as IbAlluoUSD__factory;
        //We are using this contract to simulate Gnosis multisig wallet
        const Multisig = await ethers.getContractFactory("PseudoMultisigWallet") as PseudoMultisigWallet__factory;
        //For tests we are using version of contract with hardhat console.log, to see all Txn
        //you can switch two next lines and turn off logs
        // const Buffer = await ethers.getContractFactory("LiquidityBufferVaultForTests") as LiquidityBufferVaultForTests__factory;
        const Buffer = await ethers.getContractFactory("LiquidityBufferVaultV3") as LiquidityBufferVaultV3__factory;
        const Adaptor = await ethers.getContractFactory("USDAdaptor") as USDAdaptor__factory;

        let curvePool = "0x445FE580eF8d70FF569aB36e80c647af338db351"

        multisig = await Multisig.deploy(true);

        await upgrades.silenceWarnings();
        buffer = await upgrades.deployProxy(Buffer,
            [multisig.address, multisig.address,],
            {initializer: 'initialize', kind:'uups',unsafeAllow: ['delegatecall']},
        ) as LiquidityBufferVaultV3;

        ibAlluoCurrent = await upgrades.deployProxy(IbAlluo,
            [multisig.address,
            buffer.address,
            [dai.address,
            usdc.address,
            usdt.address]],
            {initializer: 'initialize', kind:'uups'}
        ) as IbAlluoUSD;


        
        adaptor = await Adaptor.deploy(multisig.address, buffer.address);
        // Necessary info for adaptor:
        // multisig.address, curvePool, dai.address, usdc.address, usdt.address
        let ABI = ["function setAlluoLp(address newAlluoLp)"];
        let iface = new ethers.utils.Interface(ABI);
        let calldata = iface.encodeFunctionData("setAlluoLp", [ibAlluoCurrent.address]);
        await multisig.executeCall(buffer.address, calldata);


        expect(await ibAlluoCurrent.liquidityBuffer()).equal(buffer.address);
        await ibAlluoCurrent.migrateStep2();



        ABI = ["function registerAdapter(string calldata _name, address _AdapterAddress, uint256 _percentage, bool _status, address _ibAlluo, uint256 _AdapterId)"];
        iface = new ethers.utils.Interface(ABI);
        calldata = iface.encodeFunctionData("registerAdapter", ["CurvePool", adaptor.address, 0, true, ibAlluoCurrent.address, 1]);
        await multisig.executeCall(buffer.address, calldata);


        ABI = ["function setSlippage ( uint32 _newSlippage )"];
        iface = new ethers.utils.Interface(ABI);
        calldata = iface.encodeFunctionData("setSlippage", [300] );
        await multisig.executeCall(adaptor.address, calldata);


        let tokenArray = [dai.address, usdc.address, usdt.address];
        tokenArray.forEach( async token => {

            ABI = ["function setTokenToAdapter (address _token, uint256 _AdapterId)"];
            iface = new ethers.utils.Interface(ABI);
            calldata = iface.encodeFunctionData("setTokenToAdapter", [token, 1] );
            await multisig.executeCall(buffer.address, calldata);
        })
        await adaptor.AdaptorApproveAll();

    });
    describe('USD Adaptor with IbAlluoV2: Test cases', function () {

        
        it("Depositing 100 DAI and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], dai, parseEther("100"));
            await ibAlluoCurrent.connect(signers[0]).withdraw(dai.address, parseEther("50"));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());

        })
        it("Depositing 100 DAI, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], dai, parseEther("100"));
            await ibAlluoCurrent.connect(signers[0]).withdraw(dai.address, parseEther("50"));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
            
            await deposit(signers[1], dai, parseEther("100"));
            await buffer.satisfyWithdrawals();
            expect(await dai.balanceOf(signers[0].address)).equal(parseEther("50"))
        })

        it("Depositing 100 USDC and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], usdc, parseUnits("100", 6));
            await ibAlluoCurrent.connect(signers[0]).withdraw(usdc.address, parseUnits("100", 18));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
        })

        
        it("Depositing surplus USDC should not revert (Checking USD Adaptor Deposit function: Check toSend", async function () {
            await deposit(signers[0], usdc, parseUnits("100", 6));
            await deposit(signers[0], usdc, parseUnits("100", 6));
            await deposit(signers[0], usdc, parseUnits("100", 6));
            await deposit(signers[0], usdc, parseUnits("100", 6))
        })

        it("Depositing USDC when there is outstanding withdrawals (leaveInPool>0, toSend =0) should not revert (Checking USD Adaptor Deposit function: Check leaveInPool", async function () {
            await deposit(signers[0], usdc, parseUnits("10000", 6));
            await ibAlluoCurrent.connect(signers[0]).withdraw(usdc.address, parseUnits("10000", 18));

            await deposit(signers[0], usdc, parseUnits("100", 6));

        })


        it("Depositing 100 USDC, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], usdc, parseUnits("100", 6));
            await ibAlluoCurrent.connect(signers[0]).withdraw(usdc.address, parseUnits("50", 18));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
            
            await deposit(signers[1], usdc, parseUnits("100", 6));
            await buffer.satisfyWithdrawals();
            expect(Number(await usdc.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
        })

        it("Depositing 100 USDT and immediately attempting to withdraw 50 should put you in the waiting list", async function () {
            await deposit(signers[0], usdt, parseUnits("100", 6));
            await ibAlluoCurrent.connect(signers[0]).withdraw(usdt.address, parseUnits("50", 18));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
        })
        it("Depositing 100 USDT, attempt to withdraw 50 and then only get paid after there is a deposit", async function () {
            await deposit(signers[0], usdt, parseUnits("100", 6));
            await ibAlluoCurrent.connect(signers[0]).withdraw(usdt.address, parseUnits("50", 18));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
            
            await deposit(signers[1], usdt, parseUnits("100", 6));
            await buffer.satisfyWithdrawals();
            expect(Number(await usdt.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
        })

        it("The balance of the multisig wallet should increase with deposits.", async function () {
                let walletBalance = await usdc.balanceOf(multisig.address);

                await deposit(signers[0], dai, parseEther("100"));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);


                await deposit(signers[0], usdc, parseUnits("100", 6));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);

                await deposit(signers[0], usdt, parseUnits("100", 6));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);

                await deposit(signers[0], dai, parseEther("100"));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);


                await deposit(signers[0], usdc, parseUnits("100", 6));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);

                await deposit(signers[0], usdt, parseUnits("100", 6));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);

                await deposit(signers[0], dai, parseEther("100"));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);


                await deposit(signers[0], usdc, parseUnits("100", 6));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);

                await deposit(signers[0], usdt, parseUnits("100", 6));
                expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
                walletBalance = await usdc.balanceOf(multisig.address);

                console.log("Final multisig balance:", walletBalance);
    
            })
        it("Attemping to withdraw more than allowed causes revert.", async function () {
            let walletBalance = await usdc.balanceOf(multisig.address);
            await deposit(signers[1], usdc, parseUnits("100", 6));
            expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
            await expect(ibAlluoCurrent.connect(signers[1]).withdraw(usdc.address, parseUnits("500", 18))).to.be.revertedWith('ERC20: burn amount exceeds balance')
            })

            
    })
    describe('Mass deposits and withdrawal test cases', function () {
        it("Multiple deposits and withdrawals: Eventually, all withdrawers should be paid", async function () {
            let walletBalance = await usdc.balanceOf(multisig.address);

            await deposit(signers[0], dai, parseEther("100"));
            expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
            walletBalance = await usdc.balanceOf(multisig.address);


            await deposit(signers[1], usdc, parseUnits("100", 6));
            expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
            walletBalance = await usdc.balanceOf(multisig.address);

            await deposit(signers[2], usdt, parseUnits("100", 6));
            expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))
            walletBalance = await usdc.balanceOf(multisig.address);

            await ibAlluoCurrent.connect(signers[0]).withdraw(dai.address, parseEther("50"));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
            await ibAlluoCurrent.connect(signers[1]).withdraw(usdc.address, parseUnits("50", 18));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
            await ibAlluoCurrent.connect(signers[2]).withdraw(usdt.address,parseUnits("50", 18));
            expect(await buffer.lastWithdrawalRequest()).not.equal(await buffer.lastSatisfiedWithdrawal());
    
            expect(await buffer.totalWithdrawalAmount()).equal(parseEther("150"))
            // When there are deposits, should pay everyone back.
            await deposit(signers[2], usdt, parseUnits("1000", 6));
            await buffer.satisfyWithdrawals();
            expect(Number(await usdc.balanceOf(multisig.address))).greaterThan(Number(walletBalance))

            expect(Number(await dai.balanceOf(signers[0].address))).greaterThanOrEqual(Number(parseUnits("49", 18)))
            expect(Number(await usdc.balanceOf(signers[1].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))
            expect(Number(await usdt.balanceOf(signers[2].address))).greaterThanOrEqual(Number(parseUnits("49", 6)))



            })

            
    })

    async function deposit(recipient: SignerWithAddress, token: IERC20, amount: BigNumberish) {
        await token.connect(whale).transfer(recipient.address, amount);
        await token.connect(recipient).approve(ibAlluoCurrent.address, amount);        
        await ibAlluoCurrent.connect(recipient).deposit(token.address, amount);
    }
    
});
