import { ethers, upgrades } from "hardhat"
import * as readline from 'readline';

function ask(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

async function main() {
    const signers = await ethers.getSigners();
    await ask(`Did you grant UPGRADER_ROLE to ${signers[0].address}?`);
    await ask(`Did you changeUpgradeStatus to true?`);

    const LockerNew = await ethers.getContractFactory("AlluoLockedV2Final");

    // just in case something wrong with upgrade files
    // let lockerOld = await ethers.getContractFactory("AlluoLockedNew")
    // await upgrades.forceImport("0x34618270647971a3203579380b61De79ecC474D1", lockerOld)

    await ask(`Are you sure?`);
    await upgrades.upgradeProxy('0x34618270647971a3203579380b61De79ecC474D1', LockerNew);
    console.log('AlluoLocker upgraded');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });