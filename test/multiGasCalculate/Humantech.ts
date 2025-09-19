// test/HubZKPRepeatBoundary.test.ts

import { ethers } from "hardhat";
import fs from "fs";
import { Wallet } from "ethers";

describe("Hub ZKP SBT Gas Measurement (Boundary Test)", function () {
    it("Should measure gas usage with diverse & boundary inputs", async function () {
        this.timeout(0);
        const results: any[] = [];

        const [deployer, templateUser] = await ethers.getSigners();
        const verifier = Wallet.createRandom();
        const Hub = await ethers.getContractFactory("Hub");
        const hub = await Hub.deploy(verifier.address);
        await hub.waitForDeployment();

        const baseCircuitId = "kyc-proof";
        const customFee = ethers.parseEther("0.01");
        const chainId = (await ethers.provider.getNetwork()).chainId;

        for (let i = 0; i < 1000; i++) {
            try {
                const user = ethers.Wallet.createRandom().connect(ethers.provider);
                await deployer.sendTransaction({
                    to: user.address,
                    value: ethers.parseEther("0.05")
                });

                const nullifier = i === 0 ? 0 : (i === 999 ? 2 ** 256 - 1 : 100000 + i);
                const expiration = i === 0
                    ? 0
                    : (i === 999 ? Math.floor(Date.now() / 1000) + 10 ** 7 : Math.floor(Date.now() / 1000) + (3600 + i * 5));

                const publicValues =
                    i === 0
                        ? [0, 0]
                        : i === 999
                            ? [2 ** 256 - 1, 2 ** 256 - 1]
                            : [i % 100, (i * 3) % 1000];

                const circuitId = ethers.keccak256(ethers.toUtf8Bytes(`${baseCircuitId}-${i}`));

                const msgHash = ethers.solidityPackedKeccak256(
                    ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256[]", "uint256"],
                    [circuitId, user.address, expiration, customFee, nullifier, publicValues, chainId]
                );

                const sig = await verifier.signMessage(ethers.getBytes(msgHash));

                const tx = await hub.connect(user).setSBT(
                    circuitId,
                    user.address,
                    expiration,
                    customFee,
                    nullifier,
                    publicValues,
                    sig,
                    { value: customFee }
                );
                const receipt = await tx.wait();

                const revokeTx = await hub.connect(deployer).revokeSBT(user.address, circuitId);
                const revokeReceipt = await revokeTx.wait();

                results.push({
                    iteration: i,
                    nullifier: nullifier.toString(),
                    expiration,
                    publicValues,
                    gasUsed: {
                        setSBT: receipt.gasUsed.toString(),
                        revokeSBT: revokeReceipt.gasUsed.toString()
                    }
                });

                if (i % 100 === 0) console.log(`✅ [${i}] completed`);
            } catch (err) {
                results.push({
                    iteration: i,
                    error: true,
                    message: (err as Error).message
                });
                console.error(`❌ [${i}] failed:`, (err as Error).message);
            }
        }

        fs.writeFileSync("sbt_otterspace_results.json", JSON.stringify(results, null, 2));
        console.log("✅ All data written to sbt_otterspace_results.json");
    });
});
