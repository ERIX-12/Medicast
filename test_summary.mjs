import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/summary/123',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('summary:', res.statusCode, data));
});
req.write(JSON.stringify({ frames: [] }));
req.end();
