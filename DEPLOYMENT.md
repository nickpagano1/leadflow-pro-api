# LeadFlow Pro Deployment Guide

## Current Status ✅
- Complete API server with MongoDB integration
- All authentication, email, automation, and analytics endpoints
- Production-ready with security and error handling
- Ready for deployment

## Quick Deployment Options

### Option 1: Railway.app (Recommended - Free Tier)
1. **Sign up**: Go to https://railway.app
2. **Connect GitHub**: Link your GitHub account
3. **Create new project**: "Deploy from GitHub repo"
4. **Upload code**: Push this folder to GitHub repo
5. **Environment variables**: Add these in Railway dashboard:
   ```
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb+srv://npagano:INnJcMOnDSKMJgT7@leadflow-production.ga7etbp.mongodb.net/?retryWrites=true&w=majority&appName=leadflow-production
   JWT_SECRET=leadflow_pro_jwt_secret_production_key_2024_secure_random_string
   ALLOWED_ORIGINS=https://reflows.app,https://www.reflows.app
   ```
6. **Deploy**: Railway auto-deploys
7. **Get URL**: Railway provides permanent URL like `leadflow-api.up.railway.app`
8. **Update DNS**: Point reflows.app to Railway URL

### Option 2: Render.com (Also Free Tier)
1. **Sign up**: Go to https://render.com
2. **New Web Service**: Connect GitHub repo
3. **Build command**: `npm install`
4. **Start command**: `npm start`
5. **Environment variables**: Same as Railway
6. **Deploy**: Get permanent URL
7. **Update DNS**: Point reflows.app to Render URL

### Option 3: DigitalOcean ($5/month)
1. **Create droplet**: Ubuntu 20.04
2. **Install Node.js**: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`
3. **Upload files**: Use scp or git clone
4. **Install dependencies**: `npm install`
5. **Start with PM2**: `pm2 start server.js`
6. **Configure nginx**: Proxy to port 3000
7. **Update DNS**: Point reflows.app to droplet IP

## Files Created for Deployment
- ✅ `railway.json` - Railway configuration
- ✅ `Procfile` - Process configuration  
- ✅ `.gitignore` - Git ignore rules
- ✅ `.env.example` - Environment template
- ✅ `server.js` - Complete API server
- ✅ `package.json` - Dependencies and scripts

## API Endpoints Available
- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`
- **Email**: `GET/POST /api/email/config`, `POST /api/email/test`
- **Leads**: `GET/POST /api/leads`
- **Campaigns**: `GET/POST /api/campaigns`, `POST /api/campaigns/:id/send`
- **User**: `GET/PUT /api/profile`
- **Stats**: `GET /api/stats`
- **Scanning**: `POST /api/scan/leads`

## Next Steps
1. **Choose deployment platform** (Railway recommended)
2. **Deploy the application**
3. **Get permanent URL**
4. **Update DNS** to point reflows.app to permanent URL
5. **No more password pages or tunnel issues!**

Your LeadFlow Pro API is production-ready! 🚀