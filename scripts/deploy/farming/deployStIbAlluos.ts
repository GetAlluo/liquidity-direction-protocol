import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { StIbAlluo, StIbAlluo__factory } from "../../../typechain";

async function main() {


    let StIbAlluoUsd: StIbAlluo;
    let StIbAlluoEur: StIbAlluo;
    let StIbAlluoEth: StIbAlluo;
    let StIbAlluoBtc: StIbAlluo;
    const StIbAlluoFactory = await ethers.getContractFactory("StIbAlluo") as StIbAlluo__factory;

    let gnosis = "0x2580f9954529853Ca5aC5543cE39E9B5B1145135";

    let ibAlluoUsd = "0xC2DbaAEA2EfA47EBda3E572aa0e55B742E408BF6"
    let ibAlluoEur = "0xc9d8556645853C465D1D5e7d2c81A0031F0B8a92"
    let ibAlluoEth = "0xc677B0918a96ad258A68785C2a3955428DeA7e50"
    let ibAlluoBtc = "0xf272Ff86c86529504f0d074b210e95fc4cFCDce2"

    StIbAlluoUsd = await upgrades.deployProxy(StIbAlluoFactory,
        [ibAlluoUsd, 18, "Streaming IbAlluo USD", "StIbAlluoUSD", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", gnosis, [ibAlluoUsd]
        ], {
            initializer: 'alluoInitialize',
            kind: 'uups'
        }
    ) as StIbAlluo;

    StIbAlluoEth = await upgrades.deployProxy(StIbAlluoFactory,
        [ibAlluoEth, 18, "Streaming IbAlluo ETH", "StIbAlluoEth", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7",gnosis, [ibAlluoEth]
        ], {
            initializer: 'alluoInitialize',
            kind: 'uups'
        }
    ) as StIbAlluo;


    StIbAlluoEur = await upgrades.deployProxy(StIbAlluoFactory,
        [ibAlluoEur, 18, "Streaming IbAlluo Eur", "StIbAlluoEUR", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", gnosis,[ibAlluoEur]
        ], {
            initializer: 'alluoInitialize',
            kind: 'uups'
        }
    ) as StIbAlluo;


    StIbAlluoBtc = await upgrades.deployProxy(StIbAlluoFactory,
        [ibAlluoBtc, 18, "Streaming IbAlluo Btc", "StIbAlluoBTC", "0x3E14dC1b13c488a8d5D310918780c983bD5982E7", gnosis, [ibAlluoBtc]
        ], {
            initializer: 'alluoInitialize',
            kind: 'uups'
        }
    ) as StIbAlluo;

    console.log("All deployed...")
    console.log("StIbAlluoUsd:", StIbAlluoUsd.address);
    console.log("StIbAlluoEur:", StIbAlluoEur.address);
    console.log("StIbAlluoEth:", StIbAlluoEth.address);
    console.log("StIbAlluoBtc:", StIbAlluoBtc.address);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });