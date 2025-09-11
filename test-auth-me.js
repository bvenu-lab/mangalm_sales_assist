const http = require('http');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function test() {
  // First login
  const loginData = JSON.stringify({
    username: 'demo',
    password: 'demo2025'
  });

  const loginResponse = await makeRequest({
    hostname: 'localhost',
    port: 3007,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, loginData);

  console.log('Login Response:');
  console.log(JSON.stringify(JSON.parse(loginResponse.body), null, 2));
  
  const { token } = JSON.parse(loginResponse.body);
  
  // Now test /auth/me
  const meResponse = await makeRequest({
    hostname: 'localhost',
    port: 3007,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('\n/auth/me Response:');
  console.log(JSON.stringify(JSON.parse(meResponse.body), null, 2));
}

test().catch(console.error);