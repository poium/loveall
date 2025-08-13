# 🚀 Vercel Deployment Guide for Loveall Bot

## 📋 **Prerequisites**

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Environment Variables**: Prepare your API keys

## 🔧 **Step-by-Step Deployment**

### **1. Connect to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
vercel
```

### **2. Set Environment Variables**

In your Vercel dashboard:
1. Go to your project
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

```bash
NEYNAR_API_KEY=your_neynar_api_key
NEYNAR_CLIENT_ID=your_neynar_client_id
NEYNAR_SIGNER_UUID=your_neynar_signer_uuid
PRIVATE_KEY=your_private_key
BASE_RPC_URL=https://mainnet.base.org
GROK_API_KEY=your_grok_api_key
```

### **3. Deploy**

```bash
# Deploy to production
vercel --prod
```

## 🌐 **Available Endpoints**

After deployment, your bot will be available at:

- **Health Check**: `https://your-domain.vercel.app/api/health`
- **Bot Status**: `https://your-domain.vercel.app/api/status`
- **Webhook**: `https://your-domain.vercel.app/api/webhook/mention`
- **Manual Processing**: `https://your-domain.vercel.app/api/process-mention`

## 🧪 **Testing Your Deployment**

### **1. Health Check**
```bash
curl https://your-domain.vercel.app/api/health
```

### **2. Bot Status**
```bash
curl https://your-domain.vercel.app/api/status
```

### **3. Test Mention Processing**
```bash
curl -X POST https://your-domain.vercel.app/api/process-mention \
  -H "Content-Type: application/json" \
  -d '{
    "castData": {
      "hash": "test_hash",
      "text": "Hey @loveall, this is a test!",
      "author": {
        "username": "testuser",
        "fid": 123,
        "verified_accounts": [{"address": "0x123..."}]
      }
    }
  }'
```

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **1. Environment Variables Not Set**
**Error**: `Cannot read property 'apiKey' of undefined`
**Solution**: Check that all environment variables are set in Vercel dashboard

#### **2. Build Failures**
**Error**: Build fails during deployment
**Solution**: 
- Check that all dependencies are in `package.json`
- Ensure `vercel.json` is properly configured
- Check build logs in Vercel dashboard

#### **3. Function Timeout**
**Error**: Function execution timeout
**Solution**: 
- Increase `maxDuration` in `vercel.json`
- Optimize your code for faster execution

#### **4. CORS Issues**
**Error**: CORS errors when calling from frontend
**Solution**: CORS headers are already configured in the API

## 📊 **Monitoring**

### **Vercel Dashboard**
- Monitor function executions
- Check error rates
- View response times

### **Logs**
```bash
# View function logs
vercel logs your-domain.vercel.app
```

## 🔄 **Updates**

### **Redeploy After Changes**
```bash
# Deploy updates
vercel --prod
```

### **Environment Variable Updates**
1. Update in Vercel dashboard
2. Redeploy: `vercel --prod`

## 🎯 **Production Checklist**

- ✅ Environment variables set
- ✅ Health check endpoint working
- ✅ Status endpoint returning data
- ✅ Webhook endpoint accepting requests
- ✅ Error handling implemented
- ✅ Logging configured
- ✅ Monitoring set up

## 🚨 **Security Notes**

1. **Never commit private keys** to your repository
2. **Use environment variables** for all sensitive data
3. **Monitor function logs** for suspicious activity
4. **Set up alerts** for error rates

## 📞 **Support**

If you encounter issues:

1. Check Vercel function logs
2. Verify environment variables
3. Test endpoints locally first
4. Check Vercel documentation

---

**🎉 Your Loveall bot is now deployed on Vercel!**

Visit your deployment URL and start testing the endpoints! 💕
