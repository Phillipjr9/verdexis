const address = '0x4734Fe024B9Cb0BBFcd26Ed467a1e0F891aC8888';
const url = 'https://eth.drpc.org';
const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });

fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
})
  .then(async (res) => {
    console.log('status', res.status, res.statusText);
    const text = await res.text();
    console.log(text);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
