// Ultra-minimal test for auth functionality
module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const mongoose = require('mongoose');

    // Environment check
    const env = {
      hasMongoURI: !!process.env.MONGODB_URI,
      hasJWTSecret: !!process.env.JWT_SECRET,
      method: req.method,
      body: req.body
    };

    if (!process.env.MONGODB_URI) {
      return res.status(500).json({ error: 'Missing MONGODB_URI', env });
    }

    // Try MongoDB connection
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    const dbStatus = mongoose.connection.readyState;
    
    res.json({
      message: 'Auth test endpoint working',
      mongodb: dbStatus === 1 ? 'connected' : 'not connected',
      env,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
      type: error.name
    });
  }
};