import http from 'http';

http.get('http://localhost:3000/api/blackbox/123', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('blackbox:', res.statusCode, data));
});
