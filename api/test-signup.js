module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Basic environment check
    const envCheck = {
      hasMongoURI: !!process.env.MONGODB_URI,
      hasJWTSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV,
      method: req.method,
      body: req.body
    };

    // Test MongoDB connection
    const mongoose = require('mongoose');
    
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({
        error: 'MONGODB_URI not found',
        env: envCheck
      });
    }

    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxIdleTimeMS: 30000,
      retryWrites: true
    });

    res.status(200).json({
      message: 'Test signup function working',
      mongoStatus: mongoose.connection.readyState,
      env: envCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Test function error',
      message: error.message,
      stack: error.stack.split('\n').slice(0, 5),
      type: error.name
    });
  }
};