const url = 'https://eth.drpc.org';
const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: ['0x541d6221c09d27ba177c4bcf34c87447fa1063f1', 'latest'] });

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
