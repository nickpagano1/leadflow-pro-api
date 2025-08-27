const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Test routes
app.get('/api/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test1', (req, res) => {
  console.log('Test1 endpoint called');
  res.json({ message: 'Test1 works', timestamp: new Date().toISOString() });
});

app.get('/api/test2', (req, res) => {
  console.log('Test2 endpoint called');
  res.json({ message: 'Test2 works', timestamp: new Date().toISOString() });
});

// No catch-all to test if that's interfering

console.log('Minimal server setup complete');
module.exports = app;