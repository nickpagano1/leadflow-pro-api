const express = require('express');
const app = express();

app.use(express.json());

// Test non-API paths
app.get('/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Non-API test endpoint working',
    path: '/test',
    timestamp: new Date().toISOString() 
  });
});

// Test different API path
app.get('/api/different', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Different API endpoint working',
    path: '/api/different',
    timestamp: new Date().toISOString() 
  });
});

// Keep health route for comparison
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Health endpoint working',
    path: '/api/health',
    timestamp: new Date().toISOString() 
  });
});

console.log('Super minimal server setup complete - 2 routes only');
module.exports = app;