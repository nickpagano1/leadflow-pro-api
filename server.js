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
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint works', timestamp: new Date().toISOString() });
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
});

// Lead management endpoints
app.post('/api/leads', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

app.get('/api/leads', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

// Automation endpoints
app.post('/api/campaigns', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

app.get('/api/campaigns', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
    const campaigns = await Campaign.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json({ campaigns });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to retrieve campaigns' });
  }
});

app.post('/api/campaigns/:id/send', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

// User profile endpoints
app.get('/api/profile', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

app.put('/api/profile', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

// Stats endpoints
app.get('/api/stats', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

// Lead scanning endpoint
app.post('/api/scan/leads', authenticateToken, asyncHandler(async (req, res) => {
  await connectDB();
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
});

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