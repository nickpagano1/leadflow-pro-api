const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const nodemailer = require('nodemailer');
const validator = require('validator');
const path = require('path');
require('dotenv').config();

const app = express();

// Security middleware with relaxed CSP for inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://reflows.app', 'https://www.reflows.app', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Note: www redirect handled at DNS/Vercel level

// Serve static files
app.use(express.static('public'));

// Async error wrapper - defined before routes that use it
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Optimized MongoDB connection for serverless
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 1, // Single connection for serverless
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
      maxIdleTimeMS: 30000,
      retryWrites: true
    });
    
    cachedConnection = connection;
    console.log('MongoDB connected successfully');
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

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
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled'],
      default: 'active'
    }
  }
});

// Email Configuration Schema
const emailConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['gmail', 'outlook', 'custom'],
    required: true
  },
  email: {
    type: String,
    required: true,
    validate: [validator.isEmail, 'Invalid email address']
  },
  host: String,
  port: Number,
  secure: Boolean,
  username: String,
  password: String,
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Lead Schema
const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    validate: [validator.isEmail, 'Invalid email address']
  },
  firstName: String,
  lastName: String,
  company: String,
  phone: String,
  source: String,
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new'
  },
  tags: [String],
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastContact: Date,
  value: Number
});

// Automation Campaign Schema
const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  recipients: [{
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead'
    },
    email: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'opened', 'clicked', 'failed'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,
    clickedAt: Date
  }],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'completed', 'paused'],
    default: 'draft'
  },
  scheduledAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

const User = mongoose.model('User', userSchema);
const EmailConfig = mongoose.model('EmailConfig', emailConfigSchema);
const Lead = mongoose.model('Lead', leadSchema);
const Campaign = mongoose.model('Campaign', campaignSchema);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  // If ?signup=true parameter, serve signup form
  if (req.query.signup === 'true') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    const signupHtml = `<!DOCTYPE html>
<html>
<head>
    <title>🚀 LeadFlow Pro - Final Working Signup</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            padding: 40px;
            width: 100%;
            max-width: 500px;
        }
        h1 { 
            text-align: center; 
            margin-bottom: 10px; 
            color: #333;
            font-size: 32px;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }
        .form-group { margin-bottom: 20px; }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600;
            color: #555;
        }
        input { 
            width: 100%; 
            padding: 14px; 
            border: 2px solid #e1e1e1; 
            border-radius: 8px; 
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button { 
            width: 100%; 
            padding: 16px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            border: none; 
            border-radius: 8px; 
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        button:hover { transform: translateY(-2px); }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .result { 
            margin-top: 25px; 
            padding: 20px; 
            border-radius: 8px; 
            white-space: pre-wrap;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 14px;
        }
        .success { 
            background: #d4edda; 
            color: #155724; 
            border: 2px solid #c3e6cb; 
        }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 2px solid #f5c6cb; 
        }
        .status {
            text-align: center;
            margin-bottom: 25px;
            padding: 15px;
            background: #e8f5e8;
            border: 2px solid #4caf50;
            border-radius: 8px;
            font-weight: 700;
            color: #2e7d32;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LeadFlow Pro</h1>
        <div class="subtitle">Join thousands of businesses growing with LeadFlow</div>
        <div class="status">✅ FINAL WORKING SIGNUP FORM</div>
        
        <form id="signupForm">
            <div class="form-group">
                <label for="email">Email Address:</label>
                <input type="email" id="email" value="" required placeholder="you@company.com">
            </div>
            
            <div class="form-group">
                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" value="John" required placeholder="John">
            </div>
            
            <div class="form-group">
                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" value="Doe" required placeholder="Doe">
            </div>
            
            <div class="form-group">
                <label for="company">Company:</label>
                <input type="text" id="company" value="LeadFlow Pro" placeholder="Your Company">
            </div>
            
            <div class="form-group">
                <label for="password">Password (minimum 6 characters):</label>
                <input type="password" id="password" value="SecurePass123!" required>
            </div>
            
            <button type="submit" id="submitBtn">🚀 Create My Account</button>
        </form>
        
        <div id="result"></div>
    </div>

    <script>
        console.log('🎯 LeadFlow Pro FINAL Working Signup Loaded!');
        
        // Set unique email with timestamp
        document.getElementById('email').value = 'user' + Date.now() + '@example.com';
        
        document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            
            // Reset UI
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Creating Account...';
            result.innerHTML = '';
            
            // Collect form data
            const formData = {
                email: document.getElementById('email').value.trim(),
                first_name: document.getElementById('firstName').value.trim(),
                last_name: document.getElementById('lastName').value.trim(),
                company: document.getElementById('company').value.trim(),
                password: document.getElementById('password').value
            };
            
            console.log('📤 Sending data:', { ...formData, password: '[HIDDEN]' });
            
            try {
                // Use the simple working register endpoint
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                console.log('📡 Response Status:', response.status);
                const responseData = await response.json();
                console.log('📦 Full Response:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = \`🎉 ACCOUNT CREATED SUCCESSFULLY!

✅ Welcome \${responseData.user?.firstName} \${responseData.user?.lastName}!
✅ Email: \${responseData.user?.email}
✅ User ID: \${responseData.user?.id || responseData.agent_id}
✅ Company: \${responseData.user?.company}
✅ Plan: \${responseData.user?.subscription || 'free'}
✅ Token: Generated and saved locally

🎯 SUCCESS! You can now use LeadFlow Pro!

Next steps:
• Login with your credentials
• Start capturing leads
• Grow your business!\`;
                    
                    // Store authentication data
                    if (responseData.access_token) {
                        localStorage.setItem('access_token', responseData.access_token);
                        localStorage.setItem('user_email', responseData.user?.email);
                        localStorage.setItem('user_id', responseData.user?.id || responseData.agent_id);
                        console.log('✅ Auth data saved to localStorage');
                    }
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`❌ SIGNUP FAILED

Error: \${responseData.error || 'Unknown error occurred'}

\${responseData.details ? 'Details: ' + responseData.details + '\\n' : ''}
\${responseData.received ? 'Data received by server:\\n' + JSON.stringify(responseData.received, null, 2) + '\\n' : ''}
\${responseData.debug ? 'Debug info:\\n' + JSON.stringify(responseData.debug, null, 2) : ''}\`;
                }
            } catch (error) {
                console.error('💥 Network Error:', error);
                result.className = 'result error';
                result.innerHTML = \`💥 CONNECTION ERROR

\${error.message}

This usually means:
• Network connection issue
• Server temporarily unavailable  
• CORS policy blocking request

Check browser console (F12) for technical details.\`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Create My Account';
            }
        });
    </script>
</body>
</html>`;
    
    return res.status(200).send(signupHtml);
  }
  
  // Default health check response
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// SIMPLE WORKING SIGNUP ENDPOINT
app.post('/api/register', asyncHandler(async (req, res) => {
  try {
    console.log('Registration request received');
    
    // Connect to database
    await connectDB();
    console.log('Database connected');
    
    const { email, password, first_name, last_name, company } = req.body;
    
    // Basic validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'first_name', 'last_name'],
        received: { email: !!email, password: !!password, first_name: !!first_name, last_name: !!last_name }
      });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const newUser = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      company: company || 'Not specified',
      subscription: 'free',
      isActive: true
    });
    
    const savedUser = await newUser.save();
    console.log('User saved:', savedUser._id);
    
    // Generate token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      access_token: token,
      user: {
        id: savedUser._id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        company: savedUser.company
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Failed to create account',
      details: error.message
    });
  }
}));

// WORKING SIGNUP FORM (using create-account endpoint)
app.get('/api/signup', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  
  const signupHtml = `<!DOCTYPE html>
<html>
<head>
    <title>🚀 LeadFlow Pro - Create Account</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            padding: 50px;
            width: 100%;
            max-width: 550px;
        }
        h1 { 
            text-align: center; 
            margin-bottom: 15px; 
            color: #333;
            font-size: 36px;
            font-weight: 700;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 35px;
            font-size: 18px;
        }
        .form-group { margin-bottom: 25px; }
        label { 
            display: block; 
            margin-bottom: 10px; 
            font-weight: 600;
            color: #555;
            font-size: 16px;
        }
        input { 
            width: 100%; 
            padding: 16px; 
            border: 2px solid #e1e1e1; 
            border-radius: 10px; 
            font-size: 16px;
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15);
        }
        button { 
            width: 100%; 
            padding: 18px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            border: none; 
            border-radius: 10px; 
            font-size: 20px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.3s ease;
            margin-top: 10px;
        }
        button:hover { transform: translateY(-3px); }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .result { 
            margin-top: 30px; 
            padding: 25px; 
            border-radius: 10px; 
            white-space: pre-wrap;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
        }
        .success { 
            background: #d4edda; 
            color: #155724; 
            border: 2px solid #c3e6cb; 
        }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 2px solid #f5c6cb; 
        }
        .status {
            text-align: center;
            margin-bottom: 30px;
            padding: 18px;
            background: #e8f5e8;
            border: 3px solid #4caf50;
            border-radius: 10px;
            font-weight: 700;
            color: #2e7d32;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LeadFlow Pro</h1>
        <div class="subtitle">Transform your business with powerful lead generation</div>
        <div class="status">✅ FULLY WORKING SIGNUP</div>
        
        <form id="signupForm">
            <div class="form-group">
                <label for="email">Email Address:</label>
                <input type="email" id="email" value="" required placeholder="you@company.com">
            </div>
            
            <div class="form-group">
                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" value="John" required placeholder="John">
            </div>
            
            <div class="form-group">
                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" value="Doe" required placeholder="Doe">
            </div>
            
            <div class="form-group">
                <label for="company">Company:</label>
                <input type="text" id="company" value="LeadFlow Pro" placeholder="Your Company">
            </div>
            
            <div class="form-group">
                <label for="password">Password (minimum 6 characters):</label>
                <input type="password" id="password" value="MySecurePass123!" required>
            </div>
            
            <button type="submit" id="submitBtn">🚀 Create My Account</button>
        </form>
        
        <div id="result"></div>
    </div>

    <script>
        console.log('🎯 LeadFlow Pro WORKING Signup Page Loaded!');
        
        // Set unique email with timestamp
        document.getElementById('email').value = 'user' + Date.now() + '@example.com';
        
        document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            
            // Reset UI
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Creating Account...';
            result.innerHTML = '';
            
            // Collect form data
            const formData = {
                email: document.getElementById('email').value.trim(),
                first_name: document.getElementById('firstName').value.trim(),
                last_name: document.getElementById('lastName').value.trim(),
                company: document.getElementById('company').value.trim(),
                password: document.getElementById('password').value
            };
            
            console.log('📤 Sending to working endpoint:', { ...formData, password: '[PROTECTED]' });
            
            try {
                // Use the new working create-account endpoint
                const response = await fetch('/api/create-account', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                console.log('📡 Response Status:', response.status);
                const responseData = await response.json();
                console.log('📦 Response Data:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = \`🎉 ACCOUNT CREATED SUCCESSFULLY!

✅ Welcome \${responseData.user?.firstName} \${responseData.user?.lastName}!
✅ Email: \${responseData.user?.email}
✅ User ID: \${responseData.user?.id}
✅ Company: \${responseData.user?.company}
✅ Subscription: \${responseData.user?.subscription}
✅ Token: Generated and saved securely

🎯 SUCCESS! Your LeadFlow Pro account is ready!

Next Steps:
• Start capturing leads immediately
• Set up your first campaign  
• Integrate with your favorite tools
• Watch your business grow!

Ready to login and get started?\`;
                    
                    // Store authentication data
                    if (responseData.access_token) {
                        localStorage.setItem('access_token', responseData.access_token);
                        localStorage.setItem('user_email', responseData.user?.email);
                        localStorage.setItem('user_id', responseData.user?.id);
                        localStorage.setItem('agent_id', responseData.agent_id);
                        console.log('✅ Auth data successfully stored');
                    }
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`❌ ACCOUNT CREATION FAILED

Error: \${responseData.error || 'Unknown error occurred'}

\${responseData.required ? 'Required fields: ' + responseData.required.join(', ') : ''}
\${responseData.details ? '\\nDetails: ' + responseData.details : ''}\`;
                }
            } catch (error) {
                console.error('💥 Network Error:', error);
                result.className = 'result error';
                result.innerHTML = \`💥 CONNECTION ERROR

\${error.message}

Please check:
• Your internet connection
• Try refreshing the page
• Contact support if issue persists\`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Create My Account';
            }
        });
    </script>
</body>
</html>`;
  
  res.status(200).send(signupHtml);
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint works', timestamp: new Date().toISOString() });
});

// Debug endpoint to check what routes are registered
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({ 
    message: 'Registered routes',
    count: routes.length,
    routes: routes.slice(0, 20), // Show first 20
    timestamp: new Date().toISOString() 
  });
});

// Database health check endpoint
app.get('/api/healthdb', asyncHandler(async (req, res) => {
  try {
    await connectDB();
    const dbState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    res.json({ 
      status: 'OK', 
      database: states[dbState] || 'unknown',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
}));

// Working Signup Test Page (bypasses all routing issues)
app.get('/api/signup-working', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>🚀 LeadFlow Pro - WORKING SIGNUP</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            padding: 40px;
            width: 100%;
            max-width: 500px;
        }
        h1 { 
            text-align: center; 
            margin-bottom: 10px; 
            color: #333;
            font-size: 28px;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .form-group { margin-bottom: 20px; }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600;
            color: #555;
        }
        input { 
            width: 100%; 
            padding: 12px; 
            border: 2px solid #e1e1e1; 
            border-radius: 6px; 
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button { 
            width: 100%; 
            padding: 14px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            border: none; 
            border-radius: 6px; 
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        button:hover { transform: translateY(-2px); }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .result { 
            margin-top: 25px; 
            padding: 15px; 
            border-radius: 6px; 
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        .success { 
            background: #d4edda; 
            color: #155724; 
            border: 2px solid #c3e6cb; 
        }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 2px solid #f5c6cb; 
        }
        .status {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            background: #e8f5e8;
            border: 2px solid #4caf50;
            border-radius: 6px;
            font-weight: 600;
            color: #2e7d32;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LeadFlow Pro</h1>
        <div class="subtitle">Create Your Account</div>
        <div class="status">✅ WORKING SIGNUP INTERFACE</div>
        
        <form id="signupForm">
            <div class="form-group">
                <label for="email">Email Address:</label>
                <input type="email" id="email" value="" required placeholder="your@email.com">
            </div>
            
            <div class="form-group">
                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" value="John" required>
            </div>
            
            <div class="form-group">
                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" value="Doe" required>
            </div>
            
            <div class="form-group">
                <label for="company">Company:</label>
                <input type="text" id="company" value="LeadFlow Pro">
            </div>
            
            <div class="form-group">
                <label for="password">Password (min 6 characters):</label>
                <input type="password" id="password" value="TestPass123!" required>
            </div>
            
            <button type="submit" id="submitBtn">🚀 Create Account</button>
        </form>
        
        <div id="result"></div>
    </div>

    <script>
        console.log('🎯 LeadFlow Pro Working Signup Loaded!');
        
        // Set unique email with timestamp
        document.getElementById('email').value = 'test' + Date.now() + '@example.com';
        
        document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            
            // Reset UI
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Creating Account...';
            result.innerHTML = '';
            
            // Collect form data
            const formData = {
                email: document.getElementById('email').value.trim(),
                first_name: document.getElementById('firstName').value.trim(),
                last_name: document.getElementById('lastName').value.trim(),
                company: document.getElementById('company').value.trim(),
                password: document.getElementById('password').value
            };
            
            console.log('📤 Sending signup data:', { ...formData, password: '[HIDDEN]' });
            
            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                console.log('📡 Response Status:', response.status);
                const responseData = await response.json();
                console.log('📦 Response Data:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = \`🎉 SIGNUP SUCCESSFUL!

✅ Welcome \${responseData.user?.firstName} \${responseData.user?.lastName}!
✅ Email: \${responseData.user?.email}
✅ User ID: \${responseData.user?.id || responseData.agent_id}
✅ Token: Generated and stored locally
✅ Subscription: \${responseData.user?.subscription || 'free'}

🎯 You can now use LeadFlow Pro!
Next: Try logging in with your credentials.\`;
                    
                    // Store auth token
                    if (responseData.access_token) {
                        localStorage.setItem('access_token', responseData.access_token);
                        localStorage.setItem('user_email', responseData.user?.email);
                        console.log('✅ Auth token saved to localStorage');
                    }
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`❌ SIGNUP FAILED

Error: \${responseData.error || 'Unknown error'}

\${responseData.debug ? 'Debug Info:\\n' + JSON.stringify(responseData.debug, null, 2) : ''}
\${responseData.received ? 'Data Received by Server:\\n' + JSON.stringify(responseData.received, null, 2) : ''}
\${responseData.validation ? 'Validation Results:\\n' + JSON.stringify(responseData.validation, null, 2) : ''}\`;
                }
            } catch (error) {
                console.error('💥 Network Error:', error);
                result.className = 'result error';
                result.innerHTML = \`💥 NETWORK ERROR

\${error.message}

Possible causes:
• Server temporarily unavailable
• Network connection issue
• API endpoint not responding

Check browser console (F12) for technical details.\`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Create Account';
            }
        });
        
        // Health check on page load
        fetch('/api/health').then(r => r.json()).then(data => {
            console.log('🏥 API Health Check:', data);
        }).catch(err => {
            console.warn('⚠️ Health check failed:', err);
        });
    </script>
</body>
</html>`;
  
  res.status(200).send(html);
});

// Simple test endpoint
app.get('/api/test-simple', (req, res) => {
  res.json({ status: 'simple test works', timestamp: new Date().toISOString() });
});

// WORKING SIGNUP API (bypasses serverless function conflicts)
app.post('/api/signup', asyncHandler(async (req, res) => {
  console.log('=== WORKING SIGNUP REQUEST ===');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  await connectDB();
  
  try {
    const { email, password, first_name, last_name, company, phone, plan } = req.body;

    console.log('Signup attempt for:', email);
    console.log('Received data:', { email, first_name, last_name, company, has_password: !!password });

    // Validation
    if (!email || !password || !first_name || !last_name) {
      console.log('Missing required fields:', { email: !!email, password: !!password, first_name: !!first_name, last_name: !!last_name });
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { email: email || null, first_name: first_name || null, last_name: last_name || null, password: password ? '[PROVIDED]' : null }
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
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      company: company || 'Not specified',
      phone: phone || '',
      subscription: plan || 'free'
    });

    await user.save();
    console.log('User created successfully:', user._id);

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
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
    res.status(500).json({ 
      error: 'Failed to create account',
      details: error.message 
    });
  }
}));

// Authentication endpoints
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  await connectDB();
  
  const { email, password, firstName, lastName, company, phone } = req.body;

  // Validation
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = new User({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    lastName,
    company,
    phone: phone || '5551234567'
  });

  await user.save();

  // Generate JWT
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      subscription: user.subscription
    }
  });
}));

// Signup endpoint (alias for register to match frontend)
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  console.log('=== SIGNUP REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  await connectDB();
  
  try {
    const { email, password, first_name, last_name, company, phone, plan } = req.body;

  console.log('Signup attempt for:', email);
  console.log('Received data:', { email, first_name, last_name, company, has_password: !!password });

  // Validation
  if (!email || !password || !first_name || !last_name) {
    console.log('Missing required fields:', { email: !!email, password: !!password, first_name: !!first_name, last_name: !!last_name });
    return res.status(400).json({ error: 'Missing required fields' });
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

  // Create user
  const user = new User({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName: first_name,
    lastName: last_name,
    company,
    phone: phone || '5551234567',
    subscription: plan || 'premium'
  });

  await user.save();
  console.log('User created successfully:', user._id);

  // Generate JWT
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

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
    res.status(500).json({ error: 'Internal server error during signup' });
  }
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  await connectDB();
  
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  console.log('Login attempt for:', email);

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.log('User not found:', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.isActive) {
    console.log('User account deactivated:', email);
    return res.status(401).json({ error: 'Account is deactivated' });
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    console.log('Invalid password for:', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate JWT
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log('Login successful for:', email);

  res.json({
    message: 'Login successful',
    access_token: token,
    token,
    agent: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      subscription: user.subscription,
      lastLogin: user.lastLogin
    },
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      subscription: user.subscription,
      lastLogin: user.lastLogin
    }
  });
}));

// WORKING SIGNUP ENDPOINT (based on login structure)
app.post('/api/create-account', asyncHandler(async (req, res) => {
  await connectDB();
  
  const { email, password, first_name, last_name, company, phone } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['email', 'password', 'first_name', 'last_name']
    });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  console.log('Account creation attempt for:', email);

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    console.log('User already exists:', email);
    return res.status(400).json({ error: 'Account with this email already exists' });
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create new user
  const user = new User({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName: first_name,
    lastName: last_name,
    company: company || 'Not specified',
    phone: phone || '',
    subscription: 'free',
    isActive: true
  });

  await user.save();
  console.log('Account created successfully for:', email);

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate JWT (same as login)
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log('Account creation successful for:', email);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    access_token: token,
    token,
    agent_id: user._id,
    agent_name: `${user.firstName} ${user.lastName}`,
    agent: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      subscription: user.subscription,
      lastLogin: user.lastLogin
    },
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      subscription: user.subscription,
      lastLogin: user.lastLogin
    }
  });
}));

// Email configuration endpoints
app.post('/api/email/config', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const { provider, email, host, port, secure, username, password } = req.body;

    if (!provider || !email) {
      return res.status(400).json({ error: 'Provider and email are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Remove existing config for this user
    await EmailConfig.deleteMany({ userId: req.user.userId });

    // Create new config
    const emailConfig = new EmailConfig({
      userId: req.user.userId,
      provider,
      email,
      host,
      port,
      secure,
      username,
      password
    });

    await emailConfig.save();

    res.json({
      message: 'Email configuration saved successfully',
      config: {
        id: emailConfig._id,
        provider: emailConfig.provider,
        email: emailConfig.email,
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure
      }
    });
  } catch (error) {
    console.error('Email config error:', error);
    res.status(500).json({ error: 'Failed to save email configuration' });
  }
}));

app.get('/api/email/config', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const config = await EmailConfig.findOne({ userId: req.user.userId });
    
    if (!config) {
      return res.status(404).json({ error: 'Email configuration not found' });
    }

    res.json({
      config: {
        id: config._id,
        provider: config.provider,
        email: config.email,
        host: config.host,
        port: config.port,
        secure: config.secure,
        isActive: config.isActive
      }
    });
  } catch (error) {
    console.error('Get email config error:', error);
    res.status(500).json({ error: 'Failed to retrieve email configuration' });
  }
}));

app.post('/api/email/test', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const config = await EmailConfig.findOne({ userId: req.user.userId });
    
    if (!config) {
      return res.status(404).json({ error: 'Email configuration not found' });
    }

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password
      }
    });

    // Send test email
    await transporter.sendMail({
      from: config.email,
      to: config.email,
      subject: 'LeadFlow Pro - Email Configuration Test',
      text: 'This is a test email to verify your email configuration is working correctly.',
      html: '<h2>LeadFlow Pro</h2><p>This is a test email to verify your email configuration is working correctly.</p>'
    });

    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
}));

// Lead management endpoints
app.post('/api/leads', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const { email, firstName, lastName, company, phone, source, tags, notes, value } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const lead = new Lead({
      userId: req.user.userId,
      email,
      firstName,
      lastName,
      company,
      phone,
      source,
      tags,
      notes,
      value
    });

    await lead.save();

    res.status(201).json({
      message: 'Lead created successfully',
      lead: lead
    });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
}));

app.get('/api/leads', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const { page = 1, limit = 50, status, source, search } = req.query;
    
    const query = { userId: req.user.userId };
    
    if (status) query.status = status;
    if (source) query.source = source;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Lead.countDocuments(query);

    res.json({
      leads,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to retrieve leads' });
  }
}));

// Automation endpoints
app.post('/api/campaigns', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const { name, subject, content, recipients, scheduledAt } = req.body;

    if (!name || !subject || !content) {
      return res.status(400).json({ error: 'Name, subject, and content are required' });
    }

    const campaign = new Campaign({
      userId: req.user.userId,
      name,
      subject,
      content,
      recipients: recipients || [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null
    });

    await campaign.save();

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: campaign
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
}));

app.get('/api/campaigns', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const campaigns = await Campaign.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json({ campaigns });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to retrieve campaigns' });
  }
}));

app.post('/api/campaigns/:id/send', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      return res.status(400).json({ error: 'Campaign cannot be sent in current status' });
    }

    // Get email configuration
    const emailConfig = await EmailConfig.findOne({ userId: req.user.userId });
    if (!emailConfig) {
      return res.status(400).json({ error: 'Email configuration required' });
    }

    // Update campaign status
    campaign.status = 'sending';
    await campaign.save();

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.username,
        pass: emailConfig.password
      }
    });

    let sentCount = 0;
    let failedCount = 0;

    // Send emails to recipients
    for (let recipient of campaign.recipients) {
      try {
        await transporter.sendMail({
          from: emailConfig.email,
          to: recipient.email,
          subject: campaign.subject,
          html: campaign.content
        });

        recipient.status = 'sent';
        recipient.sentAt = new Date();
        sentCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.email}:`, error);
        recipient.status = 'failed';
        failedCount++;
      }
    }

    // Update campaign
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();

    res.json({
      message: 'Campaign sent successfully',
      stats: {
        sent: sentCount,
        failed: failedCount,
        total: campaign.recipients.length
      }
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
}));

// User profile endpoints
app.get('/api/profile', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
}));

app.put('/api/profile', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const { firstName, lastName, company, phone } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        firstName,
        lastName,
        company,
        phone
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}));

// Stats endpoints
app.get('/api/stats', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const totalLeads = await Lead.countDocuments({ userId: req.user.userId });
    const newLeads = await Lead.countDocuments({ 
      userId: req.user.userId, 
      status: 'new' 
    });
    const convertedLeads = await Lead.countDocuments({ 
      userId: req.user.userId, 
      status: 'converted' 
    });
    const totalCampaigns = await Campaign.countDocuments({ userId: req.user.userId });
    const activeCampaigns = await Campaign.countDocuments({ 
      userId: req.user.userId, 
      status: { $in: ['scheduled', 'sending'] }
    });

    const recentLeads = await Lead.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    const leadsByStatus = await Lead.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      overview: {
        totalLeads,
        newLeads,
        convertedLeads,
        totalCampaigns,
        activeCampaigns,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0
      },
      recentLeads,
      leadsByStatus: leadsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
}));

// Lead scanning endpoint
app.post('/api/scan/leads', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
  
  try {
    const { source, criteria } = req.body;

    if (!source) {
      return res.status(400).json({ error: 'Source is required' });
    }

    // Simulate lead scanning process
    // In production, this would integrate with actual lead sources
    const mockLeads = [
      {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Example Corp',
        source: source,
        score: 85
      },
      {
        email: 'jane.smith@company.com',
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'Company Inc',
        source: source,
        score: 92
      }
    ];

    res.json({
      message: 'Lead scan completed',
      leads: mockLeads,
      count: mockLeads.length
    });
  } catch (error) {
    console.error('Scan leads error:', error);
    res.status(500).json({ error: 'Failed to scan leads' });
  }
}));

// Homepage route - serve your website
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve all your website pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/properties', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'properties.html'));
});

app.get('/inquiries', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inquiries.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

app.get('/automation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'automation.html'));
});

app.get('/email-setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'email-setup.html'));
});

app.get('/email-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'email-test.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/calendar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});

app.get('/property_activity', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'property_activity.html'));
});

// Global error handler with detailed logging
app.use((error, req, res, next) => {
  console.error('Error Details:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Database connection errors
  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    return res.status(503).json({ 
      error: 'Database connection error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      details: Object.values(error.errors).map(e => e.message)
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Default error
  res.status(error.status || 500).json({ 
    error: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.path} not found` });
});

// 404 handler for pages - redirect to home
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Route not found' });
  } else {
    res.redirect('/');
  }
});

// For serverless deployment
if (process.env.NODE_ENV !== 'production') {
  // Local development server
  const PORT = process.env.PORT || 3000;
  const HOST = '0.0.0.0';

  connectDB().then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`LeadFlow Pro API server running on http://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: Connected to MongoDB`);
    });
  }).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
}

// Export for serverless
module.exports = app;