# 🚀 Separate Deployment Guide

## 📋 **Issue Resolution**

The TypeScript error with `minimatch` is caused by conflicts between the Next.js frontend and the bot files. Here's how to deploy them separately:

## 🔧 **Solution: Separate Deployments**

### **Option 1: Frontend Only on Vercel**

Deploy only the Next.js frontend to Vercel:

1. **Remove bot files from main project:**
```bash
# Move bot to separate directory
mv bot ../loveall-bot
mv api ../loveall-bot
```

2. **Update vercel.json for frontend only:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ]
}
```

3. **Deploy frontend:**
```bash
vercel --prod
```

### **Option 2: Bot on Railway/Render**

Deploy the bot separately on Railway or Render:

1. **Create separate bot repository:**
```bash
# Create new repo for bot
mkdir loveall-bot
cd loveall-bot
# Copy bot files
cp -r ../loveall/bot/* .
cp -r ../loveall/api/* .
cp ../loveall/artifacts ./artifacts
```

2. **Deploy to Railway:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up
```

3. **Set environment variables in Railway dashboard**

### **Option 3: Bot on Vercel (Separate Project)**

1. **Create separate Vercel project for bot:**
```bash
# Create bot-only project
mkdir loveall-bot-vercel
cd loveall-bot-vercel

# Copy bot files
cp -r ../loveall/bot/* .
cp -r ../loveall/api/* .
cp -r ../loveall/artifacts ./artifacts
```

2. **Create minimal package.json:**
```json
{
  "name": "loveall-bot-vercel",
  "version": "1.0.0",
  "dependencies": {
    "@neynar/nodejs-sdk": "^3.34.0",
    "ethers": "^6.15.0",
    "dotenv": "^17.2.1"
  }
}
```

3. **Deploy bot:**
```bash
vercel --prod
```

## 🎯 **Recommended Approach**

### **Step 1: Deploy Frontend**
```bash
# In main project directory
rm -rf bot api
npm run build
vercel --prod
```

### **Step 2: Deploy Bot Separately**
```bash
# Create bot project
mkdir loveall-bot-deploy
cd loveall-bot-deploy

# Copy bot files
cp -r ../loveall/bot/* .
cp -r ../loveall/artifacts ./artifacts

# Deploy bot
vercel --prod
```

### **Step 3: Connect Frontend to Bot**
Update frontend to call bot API endpoints.

## 🔗 **Integration**

### **Frontend API Calls**
```javascript
// In your frontend
const BOT_API_URL = 'https://your-bot-domain.vercel.app';

// Check bot status
const status = await fetch(`${BOT_API_URL}/api/status`);

// Process mention
const result = await fetch(`${BOT_API_URL}/api/process-mention`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ castData })
});
```

## 🚨 **Environment Variables**

### **Frontend (Vercel)**
```bash
NEXT_PUBLIC_BOT_API_URL=https://your-bot-domain.vercel.app
```

### **Bot (Separate Vercel/Railway)**
```bash
NEYNAR_API_KEY=your_api_key
NEYNAR_CLIENT_ID=your_client_id
NEYNAR_SIGNER_UUID=your_signer_uuid
PRIVATE_KEY=your_private_key
BASE_RPC_URL=https://mainnet.base.org
GROK_API_KEY=your_grok_api_key
```

## ✅ **Benefits of Separate Deployment**

1. **No TypeScript conflicts**
2. **Independent scaling**
3. **Separate monitoring**
4. **Easier debugging**
5. **Better resource management**

## 🎉 **Result**

- ✅ Frontend deployed on Vercel
- ✅ Bot deployed separately
- ✅ No TypeScript errors
- ✅ Full functionality maintained

---

**This approach resolves the deployment issues while maintaining all functionality! 🚀**
