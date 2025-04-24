const crypto = require('crypto');

// Generate a 32-byte (256-bit) random string for JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('JWT_SECRET:', jwtSecret);

// Generate a 32-byte (256-bit) random string for SESSION_SECRET
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('SESSION_SECRET:', sessionSecret);