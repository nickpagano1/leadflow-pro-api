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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Serve test form on GET request
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      
      const testForm = \`<!DOCTYPE html>
<html>
<head>
    <title>LeadFlow Pro Signup Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #000; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #333; }
        .result { margin-top: 20px; padding: 10px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
    </style>
</head>
<body>
    <h1>🎯 LeadFlow Pro Signup Test</h1>
    <p><strong>This form tests the actual signup API!</strong></p>
    <p class="info" style="padding: 10px; border-radius: 4px;">Form is pre-filled with test data. Click "Create Account" to test the signup functionality.</p>
    
    <form id="signupTest">
        <div class="form-group">
            <label>Email:</label>
            <input type="email" id="email" value="test\${Date.now()}@example.com" required>
        </div>
        
        <div class="form-group">
            <label>First Name:</label>
            <input type="text" id="firstName" value="Test" required>
        </div>
        
        <div class="form-group">
            <label>Last Name:</label>
            <input type="text" id="lastName" value="User" required>
        </div>
        
        <div class="form-group">
            <label>Company:</label>
            <input type="text" id="company" value="LeadFlow Pro" required>
        </div>
        
        <div class="form-group">
            <label>Password:</label>
            <input type="password" id="password" value="TestPassword123!" required>
        </div>
        
        <button type="submit" id="submitBtn">Create Account</button>
    </form>
    
    <div id="result"></div>

    <script>
        console.log('🎯 Signup test form loaded!');
        
        document.getElementById('signupTest').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Testing...';
            result.innerHTML = '';
            
            const data = {
                email: document.getElementById('email').value,
                first_name: document.getElementById('firstName').value,
                last_name: document.getElementById('lastName').value,
                company: document.getElementById('company').value,
                password: document.getElementById('password').value
            };
            
            console.log('📤 Sending signup data:', data);
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                console.log('📡 Response status:', response.status);
                const responseData = await response.json();
                console.log('📦 Response data:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = \`🎉 SUCCESS!

Account created successfully!
✅ User ID: \${responseData.user?.id || 'N/A'}
✅ Email: \${responseData.user?.email || 'N/A'}
✅ Token: \${responseData.access_token ? 'Generated' : 'Missing'}

You can now proceed to test login!\`;
                    
                    if (responseData.access_token) {
                        localStorage.setItem('access_token', responseData.access_token);
                        console.log('✅ Token saved to localStorage');
                    }
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`❌ SIGNUP FAILED

Error: \${responseData.error || 'Unknown error'}

Full response:
\${JSON.stringify(responseData, null, 2)}\`;
                }
            } catch (error) {
                console.error('💥 Error:', error);
                result.className = 'result error';
                result.innerHTML = \`💥 NETWORK ERROR

\${error.message}

Check the browser console (F12) for more details.\`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
    </script>
</body>
</html>\`;
      
      return res.status(200).send(testForm);
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