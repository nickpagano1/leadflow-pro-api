const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Minimal user creation for testing
module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Connect to MongoDB (exactly like login)
    await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxIdleTimeMS: 30000,
      retryWrites: true
    });

    // Super simple user schema
    const userSchema = new mongoose.Schema({
      email: String,
      password: String,
      firstName: String,
      lastName: String,
      company: String,
      subscription: { type: String, default: 'free' },
      isActive: { type: Boolean, default: true },
      lastLogin: Date
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Create a simple test user
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const testUser = new User({
      email: 'test@reflows.app',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      company: 'LeadFlow Pro',
      subscription: 'free',
      isActive: true
    });

    // Try to save
    const savedUser = await testUser.save();

    res.json({
      success: true,
      message: 'Test user created successfully',
      user: {
        id: savedUser._id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to create test user',
      message: error.message,
      type: error.name
    });
  }
};