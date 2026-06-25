import http from 'http';

http.get('http://localhost:3000/api/telemetry/live', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('telemetry:', data));
});
