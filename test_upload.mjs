import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=---boundary'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('upload:', res.statusCode, data));
});
req.write('-----boundary\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\ntest\r\n-----boundary--\r\n');
req.end();
