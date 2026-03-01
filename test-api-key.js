#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/*
 * This script helps you test your Firebase API key
 * Run with: node test-api-key.js YOUR_API_KEY_HERE
 */

const https = require('https');

const apiKey = process.argv[2] || 'AIzaSyCN4I_INUKp1qyqLiATrH0HXFZU4Y5Iumg';

console.log('🔍 Testing Firebase API Key...');
console.log('API Key:', apiKey.substring(0, 10) + '...\n');

const testData = JSON.stringify({
  returnSecureToken: true,
  email: 'test@test.com',
  password: 'TestPassword123'
});

const options = {
  hostname: 'identitytoolkit.googleapis.com',
  path: `/v1/accounts:signUp?key=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', JSON.parse(data));
    
    if (res.statusCode === 200) {
      console.log('\n✅ API KEY IS VALID! Firebase authentication is working.');
    } else {
      console.log('\n❌ API KEY FAILED! See error above.');
      console.log('\nSolutions:');
      console.log('1. Go to: https://console.cloud.google.com/apis/credentials?project=stacktrackpro');
      console.log('2. Click "+ CREATE CREDENTIALS" → API key');
      console.log('3. Copy the new key');
      console.log('4. Update .env.local with the new key');
      console.log('5. Run this script again: node test-api-key.js NEW_KEY_HERE');
    }
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e);
});

req.write(testData);
req.end();
