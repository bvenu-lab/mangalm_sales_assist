const jwt = require('jsonwebtoken');

// Use the same secret as the API Gateway
const secret = 'local-dev-secret-change-in-production';

const payload = {
    id: 'test-user-id',
    username: 'test-user',
    email: 'test@example.com',
    role: 'admin',
    storeIds: ['4261931000001048015']
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log('Generated JWT Token:');
console.log(token);
console.log('\nUse this in the Authorization header as:');
console.log('Bearer ' + token);
console.log('\nToken payload:', payload);