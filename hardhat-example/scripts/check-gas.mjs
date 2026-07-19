import https from 'https';

function rpc(url, method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d).result));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

const [sepoliaGas, mainnetGas] = await Promise.all([
  rpc('https://sepolia.drpc.org', 'eth_gasPrice'),
  rpc('https://mainnet.infura.io/v3/e6cf6063c4f34a10ac049269911e3f56', 'eth_gasPrice'),
]);

// Use Chainlink ETH/USD on-chain price feed (mainnet)
const chainlinkFeed = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const latestAnswer = await rpc(
  'https://mainnet.infura.io/v3/e6cf6063c4f34a10ac049269911e3f56',
  'eth_call',
  [{ to: chainlinkFeed, data: '0x50d25bcd' }, 'latest']
);
const ethUsd = parseInt(latestAnswer, 16) / 1e8;

const sepoliaGwei  = parseInt(sepoliaGas, 16) / 1e9;
const mainnetGwei  = parseInt(mainnetGas, 16) / 1e9;

// ERC-20 transfer = ~65,000 gas
// Native ETH send = ~21,000 gas
// Token deployment = ~600,000 gas (already done)
const ERC20_GAS  = 65_000;
const NATIVE_GAS = 21_000;

const mainnetEthErc20  = (mainnetGwei * ERC20_GAS)  / 1e9;
const mainnetEthNative = (mainnetGwei * NATIVE_GAS) / 1e9;

console.log('========================================');
console.log('  LIVE GAS PRICES');
console.log('========================================');
console.log('Sepolia gas price :', sepoliaGwei.toFixed(4), 'gwei  (testnet)');
console.log('Mainnet gas price :', mainnetGwei.toFixed(4), 'gwei');
console.log('ETH/USD price     : $' + ethUsd.toLocaleString());
console.log('');
console.log('========================================');
console.log('  COST PER TRANSACTION (MAINNET)');
console.log('========================================');
console.log('VDX withdrawal (ERC-20 transfer):');
console.log('  ', mainnetEthErc20.toFixed(8), 'ETH  =  $' + (mainnetEthErc20 * ethUsd).toFixed(4));
console.log('ETH withdrawal (native transfer):');
console.log('  ', mainnetEthNative.toFixed(8), 'ETH  =  $' + (mainnetEthNative * ethUsd).toFixed(4));
console.log('');
console.log('========================================');
console.log('  HOW MANY WITHDRAWALS PER FUNDING');
console.log('========================================');
for (const eth of [0.01, 0.05, 0.1, 0.5, 1]) {
  const txs = Math.floor(eth / mainnetEthErc20);
  const usd = (eth * ethUsd).toFixed(2);
  console.log(`  ${eth} ETH  ($${usd})  =>  ${txs.toLocaleString()} VDX withdrawals`);
}
console.log('');
console.log('NOTE: Custody wallet needs ETH for gas ONLY.');
console.log('VDX tokens are separate — send them from deployer wallet.');
