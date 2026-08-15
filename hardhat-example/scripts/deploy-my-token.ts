import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const [deployerClient] = await viem.getWalletClients();

  const tokenName = process.env.TOKEN_NAME ?? "Fake ETH";
  const tokenSymbol = process.env.TOKEN_SYMBOL ?? "fETH";
  const initialSupply = BigInt(process.env.INITIAL_SUPPLY ?? "1000000");
  const recipient = process.env.RECIPIENT ?? deployerClient.account.address;

  console.log(`Deployer : ${deployerClient.account.address}`);
  console.log(`Token    : ${tokenName} (${tokenSymbol})`);
  console.log(`Supply   : ${initialSupply.toLocaleString()} tokens`);
  console.log(`Recipient: ${recipient}`);

  // Contract constructor accepts only the initial supply.
  const token = await viem.deployContract("MyToken", [initialSupply]);

  if (recipient.toLowerCase() !== deployerClient.account.address.toLowerCase()) {
    const mintTx = await token.write.mint([recipient, initialSupply * 10n ** 18n]);
    console.log(`Minted to recipient: ${mintTx}`);
  }

  console.log(`\nDeployed to: ${token.address}`);
  console.log(`\nAdd to wallet as a custom token:`);
  console.log(`Contract: ${token.address}`);
  console.log(`Symbol: ${tokenSymbol}`);
  console.log(`Decimals: 18`);

  const name = await token.read.name();
  const symbol = await token.read.symbol();
  const decimals = await token.read.decimals();
  const totalSupply = await token.read.totalSupply();
  const ownerBalance = await token.read.balanceOf([deployerClient.account.address]);
  const recipientBalance = await token.read.balanceOf([recipient]);

  console.log(`\nVerification:`);
  console.log(`  name        : ${name}`);
  console.log(`  symbol      : ${symbol}`);
  console.log(`  decimals    : ${decimals}`);
  console.log(`  totalSupply : ${(totalSupply / 10n ** 18n).toLocaleString()} ${symbol}`);
  console.log(`  owner bal   : ${(ownerBalance / 10n ** 18n).toLocaleString()} ${symbol}`);
  console.log(`  recipient bal: ${(recipientBalance / 10n ** 18n).toLocaleString()} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
