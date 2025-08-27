const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// User Schema
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
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Simple body handling - req.body should be parsed by Vercel
    let body = req.body;
    
    console.log('=== SIGNUP REQUEST DEBUG ===');
    console.log('Raw body:', body);
    console.log('Body type:', typeof body);
    console.log('Body keys:', body ? Object.keys(body) : 'NO KEYS');
    
    // If body is empty or null, return detailed error
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({
        error: 'No request body received',
        debug: {
          bodyReceived: body,
          bodyType: typeof body,
          hasBody: !!body,
          method: req.method,
          contentType: req.headers['content-type']
        }
      });
    }

  try {
    // Connect to MongoDB (same as login)
    await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxIdleTimeMS: 30000,
      retryWrites: true
    });
    
    console.log('Raw request body:', body);
    console.log('Request body type:', typeof body);
    console.log('Request body keys:', body ? Object.keys(body) : 'NO BODY');
    
    const { email, password, first_name, last_name, company, phone, plan } = body;

    console.log('Signup attempt for:', email);
    console.log('Extracted values:', { 
      email: email || 'MISSING', 
      first_name: first_name || 'MISSING', 
      last_name: last_name || 'MISSING', 
      company: company || 'MISSING',
      password: password ? 'PROVIDED' : 'MISSING'
    });

    // Validation with detailed error info
    if (!email || !password || !first_name || !last_name) {
      console.log('Missing required fields:', { email: !!email, password: !!password, first_name: !!first_name, last_name: !!last_name });
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: {
          email: email || null,
          first_name: first_name || null,
          last_name: last_name || null,
          password: password ? '[PROVIDED]' : null,
          company: company || null
        },
        validation: {
          email: !!email,
          password: !!password,
          first_name: !!first_name,
          last_name: !!last_name
        }
      });
    }

    if (!validator.isEmail(email)) {
      console.log('Invalid email format:', email);
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      console.log('Password too short:', password.length);
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with simplified data
    console.log('Creating user with data:', {
      email: email.toLowerCase(),
      firstName: first_name,
      lastName: last_name,
      company: company || 'Not specified'
    });

    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      company: company || 'Not specified',
      phone: phone || '',
      subscription: plan || 'free'
    });

    console.log('About to save user...');
    await user.save();
    console.log('User saved successfully!');
    console.log('User created successfully:', email);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('JWT token generated');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      access_token: token,
      agent_id: user._id,
      agent_name: `${user.firstName} ${user.lastName}`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error during signup',
      details: error.message,
      type: error.name
    });
  }
};