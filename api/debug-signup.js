const mongoose = require('mongoose');

module.exports = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'debug-signup endpoint working',
        timestamp: new Date().toISOString(),
        method: req.method,
        environment: {
          MONGODB_URI: process.env.MONGODB_URI ? 'present' : 'missing',
          JWT_SECRET: process.env.JWT_SECRET ? 'present' : 'missing',
          NODE_ENV: process.env.NODE_ENV
        }
      });
    }
    
    // Test basic signup without mongoose schema
    if (req.method === 'POST') {
      const body = req.body;
      
      return res.status(200).json({
        status: 'POST received successfully',
        bodyReceived: body,
        bodyType: typeof body,
        keys: body ? Object.keys(body) : null,
        validation: {
          hasEmail: !!(body && body.email),
          hasPassword: !!(body && body.password),
          hasFirstName: !!(body && body.first_name),
          hasLastName: !!(body && body.last_name)
        }
      });
    }
    
    res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Debug signup error:', error);
    res.status(500).json({ 
      error: 'Debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
};