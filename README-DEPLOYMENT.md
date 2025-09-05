# Deployment Guide

## Environment Variables Setup

### Required Environment Variables for Production

Set these environment variables in your Vercel dashboard:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_WOOCOMMERCE_BASE_URL=https://locknlockvietnam.com
VITE_WOOCOMMERCE_CONSUMER_KEY=ck_your_consumer_key_here
VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_your_consumer_secret_here
```

### Optional Environment Variables

```env
VITE_DEFAULT_PRODUCTS_TABLE=products
VITE_DEFAULT_AUDIT_TABLE=product_updates
```

## Vercel Deployment Steps

1. **Connect Repository**: Link your GitHub repository to Vercel

2. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all required environment variables above
   - Make sure to set them for "Production", "Preview", and "Development" environments

3. **Deploy**: Vercel will automatically build and deploy your application

## Security Features

- **Credential Masking**: Sensitive data is automatically masked in production UI
- **Environment Detection**: Production mode automatically hides credential input fields
- **Secure Storage**: All credentials are stored as environment variables, not in code
- **No Client Exposure**: Environment variables are properly prefixed with `VITE_` for Vite

## Production Behavior

When deployed to production:
- Credential input fields are hidden if environment variables are configured
- API keys and URLs are masked with `****` pattern
- Users can toggle visibility of credentials with "Show/Hide Config" button
- LocalStorage clearing is disabled in production mode

## Development vs Production

### Development Mode
- All credential fields are visible
- No masking of sensitive data
- LocalStorage can be cleared
- Full debugging information available

### Production Mode
- Credentials auto-loaded from environment variables
- Sensitive fields are masked
- Limited credential visibility
- Enhanced security warnings

## Verification

After deployment, verify:
1. ✅ Environment variables are properly loaded
2. ✅ Green "Configured via Environment" indicator appears
3. ✅ Sensitive data is masked in the UI
4. ✅ Database connections work properly
5. ✅ WooCommerce API connections work properly