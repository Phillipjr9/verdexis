import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const [deployerClient] = await viem.getWalletClients();
  const initialSupply = BigInt(process.env.INITIAL_SUPPLY ?? "1000000");

  console.log(`Deploying SimilarToken to ${network.name ?? "mainnet"} with account: ${deployerClient.account.address}`);
  const token = await viem.deployContract("SimilarToken", [initialSupply]);

  console.log(`SimilarToken deployed to: ${token.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
