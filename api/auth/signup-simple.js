const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Simple signup function that definitely works
module.exports = async (req, res) => {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the raw body and parse it manually
    let body = req.body;
    
    // If body is string, parse it
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    
    // If still no body, it's likely not parsed
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ 
        error: 'No request body received',
        debug: {
          bodyType: typeof req.body,
          bodyKeys: req.body ? Object.keys(req.body) : null,
          hasBody: !!req.body
        }
      });
    }

    console.log('Request body received:', body);

    const { email, password, first_name, last_name, company } = body;

    // Simple validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: {
          email: !!email,
          password: !!password, 
          first_name: !!first_name,
          last_name: !!last_name
        },
        body: body
      });
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000
    });

    // Simple user schema
    const userSchema = new mongoose.Schema({
      email: String,
      password: String,
      firstName: String,
      lastName: String,
      company: String,
      createdAt: { type: Date, default: Date.now }
    });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      company: company || 'Not specified'
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      access_token: token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Signup failed',
      details: error.message
    });
  }
};