import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const [deployerClient] = await viem.getWalletClients();

  const tokenName    = process.env.TOKEN_NAME    ?? "Verdexis Token"
  const tokenSymbol  = process.env.TOKEN_SYMBOL  ?? "VDX"
  const initialSupply = BigInt(process.env.INITIAL_SUPPLY ?? "10000000")

  console.log(`Deployer : ${deployerClient.account.address}`)
  console.log(`Token    : ${tokenName} (${tokenSymbol})`)
  console.log(`Supply   : ${initialSupply.toLocaleString()} tokens`)

  const token = await viem.deployContract("MyToken", [tokenName, tokenSymbol, initialSupply])

  console.log(`\nDeployed to: ${token.address}`)
  console.log(`\nAdd to server/.env:`)
  console.log(`ETHEREUM_TOKEN_ADDRESS=${token.address}`)
  console.log(`ETHEREUM_TOKEN_SYMBOL=${tokenSymbol}`)
  console.log(`\nAdd to app/.env:`)
  console.log(`VITE_CUSTOM_TOKEN_ADDRESS=${token.address}`)
  console.log(`VITE_CUSTOM_TOKEN_SYMBOL=${tokenSymbol}`)

  // Verify basic token state
  const name         = await token.read.name()
  const symbol       = await token.read.symbol()
  const decimals     = await token.read.decimals()
  const totalSupply  = await token.read.totalSupply()
  const ownerBalance = await token.read.balanceOf([deployerClient.account.address])

  console.log(`\nVerification:`)
  console.log(`  name        : ${name}`)
  console.log(`  symbol      : ${symbol}`)
  console.log(`  decimals    : ${decimals}`)
  console.log(`  totalSupply : ${(totalSupply / BigInt(10 ** Number(decimals))).toLocaleString()} ${symbol}`)
  console.log(`  owner bal   : ${(ownerBalance / BigInt(10 ** Number(decimals))).toLocaleString()} ${symbol}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
