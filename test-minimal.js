const express = require('express');
const app = express();

app.use(express.json());

// Single route test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Health endpoint working',
    timestamp: new Date().toISOString() 
  });
});

// Second route immediately after
app.get('/api/simple', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Simple endpoint working',
    timestamp: new Date().toISOString() 
  });
});

console.log('Super minimal server setup complete - 2 routes only');
module.exports = app;