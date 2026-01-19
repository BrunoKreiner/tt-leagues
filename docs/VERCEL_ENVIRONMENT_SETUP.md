# Vercel Environment Variables Setup

This guide explains how to add environment variables to your Vercel projects for the Table Tennis League app.

## Required Environment Variables

### Backend Project (Vercel)

Navigate to your backend project on Vercel:
1. Go to **Project Settings** → **Environment Variables**
2. Add the following variables:

#### Required Variables

```
TURNSTILE_SECRET_KEY=your-turnstile-secret-key-here
```

**Other existing variables you should already have:**
- `NODE_ENV=production`
- `JWT_SECRET=your-strong-secret`
- `FRONTEND_URL=https://your-frontend-project.vercel.app`
- `DATABASE_URL=postgres://...` (if using Postgres)

#### How to Get Turnstile Keys

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Turnstile** section
3. Click **Add Site**
4. Configure:
   - **Site Name**: Your app name (e.g., "TT Leagues")
   - **Domain**: Your Vercel domain (e.g., `your-backend-project.vercel.app`)
   - **Widget Mode**: Choose "Managed" (invisible) or "Non-interactive"
5. Copy the **Site Key** (for frontend) and **Secret Key** (for backend)
6. Add the **Secret Key** to backend environment variables

---

### Frontend Project (Vercel)

Navigate to your frontend project on Vercel:
1. Go to **Project Settings** → **Environment Variables**
2. Add the following variable:

#### Required Variables

```
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key-here
```

**Other existing variables you should already have:**
- `VITE_API_URL=https://your-backend-project.vercel.app/api`

#### How to Get Turnstile Site Key

Use the same **Site Key** from the Turnstile site you created above.

---

## Step-by-Step Instructions

### 1. Create Turnstile Site

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to **Turnstile** (in the left sidebar under "Application Services")
4. Click **Add Site**
5. Fill in:
   - **Site Name**: `TT Leagues Production` (or any name)
   - **Domain**: 
     - For backend: `your-backend-project.vercel.app`
     - For frontend: `your-frontend-project.vercel.app`
     - You can add multiple domains
   - **Widget Mode**: 
     - **Managed** (recommended) - Invisible, automatic challenge
     - **Non-interactive** - Always shows widget
6. Click **Create**
7. You'll see:
   - **Site Key** (copy this for frontend)
   - **Secret Key** (copy this for backend - keep it secret!)

### 2. Add to Backend Vercel Project

1. Go to your backend project on Vercel
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Add:
   - **Key**: `TURNSTILE_SECRET_KEY`
   - **Value**: Paste your Secret Key from Cloudflare
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### 3. Add to Frontend Vercel Project

1. Go to your frontend project on Vercel
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Add:
   - **Key**: `VITE_TURNSTILE_SITE_KEY`
   - **Value**: Paste your Site Key from Cloudflare
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### 4. Redeploy

After adding environment variables, you need to redeploy:

1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

---

## Testing

### Using Test Keys (Development)

For local development, you can use Cloudflare's test keys (already in `.env` files):

**Backend:**
```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

**Frontend:**
```
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

These test keys will always pass verification and are perfect for development.

### Production Keys

For production on Vercel, use the real keys from your Cloudflare Turnstile site.

---

## Verification

After deployment, test the registration/login forms:

1. Go to your frontend URL
2. Try to register a new account
3. You should see the Turnstile widget (or it should work invisibly)
4. Complete the form
5. Check backend logs if there are any issues

---

## Troubleshooting

### CAPTCHA Not Showing

- Check that `VITE_TURNSTILE_SITE_KEY` is set correctly
- Check browser console for errors
- Verify the domain is added to your Turnstile site configuration

### CAPTCHA Verification Failing

- Check that `TURNSTILE_SECRET_KEY` is set correctly in backend
- Verify the domain matches what's configured in Turnstile
- Check backend logs for Turnstile API errors
- Ensure you've redeployed after adding environment variables

### Test Keys Not Working

- Test keys should work automatically
- If not, check that the keys match exactly (no extra spaces)
- Restart your local dev server after changing `.env` files

---

## Security Notes

- **Never commit `.env` files** to git (they're in `.gitignore`)
- **Keep Secret Key secure** - don't share it publicly
- **Use different keys** for development and production if desired
- **Rotate keys** if you suspect they've been compromised

---

## Additional Resources

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
