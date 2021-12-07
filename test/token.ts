import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";
import { keccak256 } from "ethers/lib/utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let Token: ContractFactory;
let token: Contract;

let owner: SignerWithAddress;
let addr1: SignerWithAddress;
let addr2: SignerWithAddress;

describe("Token contract", function (){
    
    beforeEach(async function () {
        Token = await ethers.getContractFactory("AlluoToken");
        token = await Token.deploy();
        
        [owner, addr1, addr2] = await ethers.getSigners();
    });

    describe("Tokenomics and Info", function () {
        it("Should return basic information", async function () {
            expect(await token.name()).to.equal("Alluo Token"),
            expect(await token.symbol()).to.equal("ALLUO"),
            expect(await token.decimals()).to.equal(18);
        });
        it("Should return the total supply equal to 200000000", async function () {
            expect(await token.totalSupply()).to.equal(parseEther('200000000'));
        });
        it("Deployment should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await token.balanceOf(owner.address);
            expect(await token.totalSupply()).to.equal(ownerBalance);
        });
    });
    describe("Balances", function () {
        it('When the requested account has no tokens it returns zero', async function () {
            expect(await token.balanceOf(addr1.address)).to.equal("0");
        });
        
        it('When the requested account has some tokens it returns the amount', async function () {
            await token.transfer(addr1.address, parseEther('50'));
            expect(await token.balanceOf(addr1.address)).to.equal(parseEther('50'));
        });

    });
    describe("Transactions", function () {
        describe("Should fail when", function (){

            it('transfer to zero address', async function () {
                await expect(token.transfer(ZERO_ADDRESS, parseEther('100'))
                ).to.be.revertedWith("ERC20: transfer to the zero address");
            });
            
            it('transfer from zero address', async function () {
                await expect(token.transferFrom(ZERO_ADDRESS, addr1.address, parseEther('100'))
                ).to.be.revertedWith("ERC20: transfer from the zero address");
            });

            it('sender doesn’t have enough tokens', async function () {
                await token.connect(addr1).approve(addr2.address, parseEther('200'));
                await expect(token.transferFrom(addr1.address, addr2.address, parseEther('100'))
                ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });

            it('transfer amount exceeds allowance', async function () {
                await expect(token.transferFrom(owner.address, addr2.address, parseEther('100'))
                ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
            });
        });
        describe("Should transfer when everything is correct", function () {
            it('from owner to addr1', async function () {
                await token.transfer(addr1.address, parseEther('50'));
                const addr1Balance = await token.balanceOf(addr1.address);
                expect(addr1Balance).to.equal(parseEther('50'));
            });

            it('from addr1 to addr2 with correct balances at the end', async function () {
                await token.transfer(addr1.address, parseEther('50'));
                await token.connect(addr1).transfer(addr2.address, parseEther('25'));
                const addr1Balance = await token.balanceOf(addr1.address);
                const addr2Balance = await token.balanceOf(addr2.address);
                expect(addr1Balance).to.equal(parseEther('25')),
                expect(addr2Balance).to.equal(parseEther('25'));
            });
        });

    });

    describe('Approve', function () {
        it("Approving and TransferFrom", async function () {
            await token.transfer(addr1.address, parseEther('100'));
            await token.connect(addr1).approve(addr2.address, parseEther('50'));
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(parseEther('50'));

            await token.connect(addr2).transferFrom(addr1.address, addr2.address, parseEther("50") )
            expect(await token.balanceOf(addr1.address)).to.equal(parseEther('50'));
        });
        it("Not approving becouse of zero address", async function () {
            await expect(token.approve(ZERO_ADDRESS, parseEther('100'))
                ).to.be.revertedWith("ERC20: approve to the zero address");
        });
    });

    describe('Mint / Burn', function () {
        it("minting", async function () {
            await token.mint(addr1.address, parseEther('1000'));
            expect(await token.totalSupply()).to.equal(parseEther('200001000')),
            expect(await token.balanceOf(addr1.address)).to.equal(parseEther('1000'));
        });

        it("the mint fails because the address doesn't have the role of a minter", async function () {
            await expect(token.connect(addr1).mint(addr2.address, parseEther('200'))
                ).to.be.revertedWith("AlluoToken: must have minter role to mint");
        });

        it("burning", async function () {
            await token.transfer(addr1.address, parseEther('1000'));
            await token.burn(addr1.address, parseEther('1000'));
            expect(await token.totalSupply()).to.equal(parseEther('199999000')),
            expect(await token.balanceOf(addr1.address)).to.equal(0);
        });

        it("the burn fails because the address doesn't have the role of a burner", async function () {
            await expect(token.connect(addr1).burn(owner.address, parseEther('200'))
                ).to.be.revertedWith("AlluoToken: must have burner role to burn");
        });

        it("burn fails because the amount exceeds the balance", async function () {
            await token.transfer(addr1.address, parseEther('100'));
            await expect(token.burn(addr1.address, parseEther('200'))
            ).to.be.revertedWith("ERC20: burn amount exceeds balance");
        });

        it("adding new burner and burn", async function () {
            await token.grantRole(await token.MINTER_ROLE(), addr1.address);
            await token.transfer(addr2.address, parseEther('1000'));
            await token.connect(addr1).burn(addr2.address, parseEther('500'));
            expect(await token.totalSupply()).to.equal(parseEther('199999500')),
            expect(await token.balanceOf(addr2.address)).to.equal(parseEther('500'));
        });

    });

    describe('Pause', function () {
        it("Pause token contract and not allow transfers", async function () {
            await token.pause();
            await expect(token.transfer(addr1.address, parseEther('100'))
            ).to.be.revertedWith("Pausable: paused");
        });
        it("Pause and unpause token contract", async function () {
            await token.pause();
            await expect(token.transfer(addr1.address, parseEther('100'))
            ).to.be.revertedWith("Pausable: paused");
            await token.unpause();
            await token.transfer(addr1.address, parseEther('50'));
            const addr1Balance = await token.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(parseEther('50'));
        });

        it("Not allow user without pauser role to pause and unpause", async function () {
            await expect(token.connect(addr1).pause()
            ).to.be.revertedWith("AlluoToken: must have pauser role to pause");
            await token.pause();
            await expect(token.connect(addr1).unpause()
            ).to.be.revertedWith("AlluoToken: must have pauser role to unpause");
        });
    });

    describe('Granting roles', function () {
        it("Not allow user without admin role grant other roles", async function () {
            await expect(token.connect(addr1).grantRole(await token.MINTER_ROLE(), addr2.address)
            ).to.be.revertedWith(`AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.DEFAULT_ADMIN_ROLE()}`);
        });
        // it("grants admin role to new address", async function () {
        // });
    });
});
  