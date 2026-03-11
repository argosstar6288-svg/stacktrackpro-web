#!/usr/bin/env node

const https = require('https');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY in environment variables.');
  console.error('Set it first, then run this script again.');
  process.exit(1);
}

console.log('🔍 Testing OpenAI API Key...\n');

const testData = JSON.stringify({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: "Say 'API key is working' if you can read this."
    }
  ],
  max_tokens: 20
});

const options = {
  hostname: 'api.openai.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
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
    
    try {
      const parsed = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('\n✅ API KEY IS WORKING!');
        console.log('Response:', parsed.choices[0].message.content);
      } else {
        console.log('\n❌ API KEY FAILED!');
        console.log('Error:', JSON.stringify(parsed, null, 2));
        
        if (parsed.error?.code === 'insufficient_quota') {
          console.log('\n⚠️  ISSUE: OpenAI account has exceeded quota or billing limit.');
          console.log('Solution: Add payment method or upgrade plan at https://platform.openai.com/account/billing');
        }
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(testData);
req.end();
