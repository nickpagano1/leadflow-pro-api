const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
require('dotenv').config();

// MongoDB connection (reuse from login.js)
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxIdleTimeMS: 30000,
      retryWrites: true
    });
    
    cachedConnection = connection;
    console.log('MongoDB connected successfully (health endpoint)');
    return connection;
  } catch (error) {
    console.error('MongoDB connection error (health):', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

// User Schema (same as login.js)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Invalid email address']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  subscription: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    default: 'free'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = async (req, res) => {
  // BULLETPROOF CORS HEADERS  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET request returns health status
  if (req.method === 'GET') {
    console.log('🏥 HEALTH CHECK - GET request');
    return res.status(200).json({
      status: 'OK',
      message: 'LeadFlow Pro API Health Check',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      endpoints: {
        signup_primary: '/api/auth/login (with first_name, last_name)',
        signup_fallback: '/api/health (POST)',
        login: '/api/auth/login'
      }
    });
  }

  // POST request handles signup
  if (req.method === 'POST') {
    console.log('🏥 BULLETPROOF HEALTH SIGNUP ENDPOINT - Request received');
    
    try {
      await connectDB();
      
      console.log('📦 Request body keys:', Object.keys(req.body || {}));

      const { 
        email, 
        password, 
        first_name, 
        last_name, 
        firstName,
        lastName,
        company,
        phone,
        plan,
        subscription 
      } = req.body;

      // BASIC VALIDATION
      if (!email || !password) {
        console.log('❌ Missing email or password');
        return res.status(400).json({ 
          error: 'Email and password are required',
          required: ['email', 'password', 'first_name', 'last_name'],
          received: Object.keys(req.body || {}),
          endpoint: 'health-signup'
        });
      }

      if (!validator.isEmail(email)) {
        console.log('❌ Invalid email format:', email);
        return res.status(400).json({ error: 'Invalid email format' });
      }

      if (password.length < 6) {
        console.log('❌ Password too short');
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // VALIDATE SIGNUP FIELDS
      const finalFirstName = first_name || firstName;
      const finalLastName = last_name || lastName;
      
      if (!finalFirstName || !finalLastName) {
        console.log('❌ Missing required signup fields');
        return res.status(400).json({ 
          error: 'First name and last name are required for signup',
          required: ['email', 'password', 'first_name', 'last_name'],
          received: Object.keys(req.body || {}),
          hint: 'This is the health endpoint in signup mode'
        });
      }

      console.log('🔍 HEALTH SIGNUP MODE - All fields validated');

      // CHECK IF USER EXISTS
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        console.log('❌ User already exists:', email);
        return res.status(400).json({ 
          error: 'User already exists with this email address',
          suggestion: 'Try logging in at /api/auth/login instead',
          endpoint: 'health-signup'
        });
      }

      // HASH PASSWORD
      console.log('🔐 Hashing password for new user');
      const hashedPassword = await bcrypt.hash(password, 12);

      // CREATE NEW USER
      console.log('👤 Creating new user account via health endpoint');
      const user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: finalFirstName.trim(),
        lastName: finalLastName.trim(),
        company: (company || 'Not specified').trim(),
        phone: (phone || '').trim(),
        subscription: subscription || plan || 'free',
        lastLogin: new Date(),
        isActive: true
      });

      await user.save();
      console.log('✅ NEW USER CREATED VIA HEALTH ENDPOINT:', user._id);

      // GENERATE JWT TOKEN
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email,
          type: 'health-signup',
          endpoint: '/api/health'
        },
        process.env.JWT_SECRET || 'fallback-secret-key',
        { expiresIn: '24h' }
      );

      // PREPARE SUCCESS RESPONSE
      const userResponse = {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company || '',
        phone: user.phone || '',
        subscription: user.subscription,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      };

      const responseData = {
        success: true,
        message: '🎉 Account created successfully via health endpoint!',
        operation: 'health-signup',
        endpoint: '/api/health',
        access_token: token,
        token: token, // For compatibility
        agent_id: user._id.toString(), // For compatibility
        user: userResponse,
        agent: userResponse, // For compatibility
        timestamp: new Date().toISOString()
      };

      console.log('🎉 HEALTH SIGNUP SUCCESS!');
      console.log('✅ User ID:', user._id);
      console.log('✅ Email:', user.email);
      console.log('✅ Strategy: Health Endpoint');

      return res.status(201).json(responseData);

    } catch (error) {
      console.error('💥 HEALTH ENDPOINT ERROR:', error);
      
      // DETAILED ERROR HANDLING
      let errorMessage = 'Internal server error';
      let statusCode = 500;
      
      if (error.code === 11000) {
        // Duplicate key error (email already exists)
        errorMessage = 'Email address already exists';
        statusCode = 400;
        console.log('❌ Duplicate email error in health endpoint');
      } else if (error.name === 'ValidationError') {
        errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
        statusCode = 400;
        console.log('❌ Validation error in health endpoint:', errorMessage);
      } else if (error.name === 'MongooseError') {
        errorMessage = 'Database error';
        console.log('❌ MongoDB error in health endpoint:', error.message);
      }

      return res.status(statusCode).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : 'Contact support if issue persists',
        operation: 'health-signup',
        endpoint: '/api/health',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Method not allowed
  return res.status(405).json({ 
    error: 'Method not allowed', 
    allowed: ['GET', 'POST'],
    endpoint: '/api/health'
  });
};