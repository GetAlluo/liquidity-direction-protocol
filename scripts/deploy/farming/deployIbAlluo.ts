import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"

async function main() {

  let gnosisAddress = "0x4B948C0354c82f1DC3c510bfa93578540DAb917d";
  let handler = "0xF877605269bB018c96bD1c93F276F834F45Ccc3f";
  let supprotedTokens = ["0x61791647b8dc56bd481F1CE2c3ce5EE9d5588E9e"];
  let exchange = "";

  const IbAlluo = await ethers.getContractFactory("IbAlluo");

  let ibAlluo = await upgrades.deployProxy(IbAlluo,
    [
        "Interest Bearing Alluo BTC",
        "IbAlluoBTC",
        gnosisAddress,
        handler,
        supprotedTokens,
        BigNumber.from("100000000154712500"),
        500,
        "0x9399BB24DBB5C4b782C70c2969F58716Ebbd6a3b",
        exchange
    ],
        { initializer: 'initialize', kind: 'uups' }
);

  console.log("ibAlluo deployed to:", ibAlluo.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });