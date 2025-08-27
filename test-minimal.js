const express = require('express');
const app = express();

app.use(express.json());

// Put simple route FIRST to test order dependency
app.get('/api/simple', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Simple endpoint working - defined FIRST',
    timestamp: new Date().toISOString() 
  });
});

// Health route SECOND
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Health endpoint working - defined SECOND',
    timestamp: new Date().toISOString() 
  });
});

console.log('Super minimal server setup complete - 2 routes only');
module.exports = app;