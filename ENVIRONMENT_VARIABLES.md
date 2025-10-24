# Environment Variables Checklist

This document lists all environment variables needed for the Underwraps Gift List application.

---

## Frontend Environment Variables

Set these in your `.env.local` file (create it if it doesn't exist):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
```

**Where to get these:**
1. Go to Supabase Dashboard
2. Navigate to **Project Settings** → **API**
3. Copy the **Project URL** and **anon public** key

---

## Supabase Edge Function Secrets

These are **NOT** set in `.env.local`. Instead, set them in the Supabase Dashboard:

### How to Set Secrets:

1. Go to Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Click **Add secret**
4. Add each of the following:

### Required Secrets:

| Secret Name | Example Value | Where to Get | Used By |
|------------|---------------|--------------|---------|
| `RESEND_API_KEY` | `re_xxxxx` | [resend.com/api-keys](https://resend.com/api-keys) | `send-invitation` |
| `FROM_EMAIL` | `Underwraps <noreply@yourdomain.com>` | Your verified Resend domain | `send-invitation` |
| `APP_BASE_URL` | `https://yourapp.vercel.app` | Your production app URL | `send-invitation` |

### Setting Up Resend:

1. Sign up at [resend.com](https://resend.com)
2. **Option A - Quick Start** (Testing):
   - Use the free test email: `onboarding@resend.dev`
   - No domain verification needed
   - Limited to 100 emails/day

3. **Option B - Production** (Recommended):
   - Add your domain (Settings → Domains)
   - Add DNS records (Resend provides them)
   - Wait for verification (~5 minutes)
   - Create API key (API Keys → Create)
   - Use your domain email: `noreply@yourdomain.com`

---

## Automatic Environment Variables

These are automatically provided by Supabase in edge functions. You don't need to set them:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Secret service role key (admin access)

---

## Vercel Deployment Variables

Set these in Vercel Dashboard → **Project Settings** → **Environment Variables**:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Production, Preview, Development |

**Important:** Make sure to select all environments (Production, Preview, Development) when adding these.

---

## Testing Your Configuration

### Test Frontend Connection:

```bash
# Start dev server
npm run dev

# Try to sign up/login
# If it works, your frontend vars are correct
```

### Test Edge Functions:

```bash
# Check edge function logs
supabase functions logs send-invitation --tail

# If you see "Missing RESEND_API_KEY", the secret isn't set
```

### Test Email Sending:

1. Create a group
2. Try to invite a member
3. Check the invited email inbox
4. If email doesn't arrive:
   - Check Supabase edge function logs
   - Verify Resend API key is correct
   - Check Resend dashboard for delivery status

---

## Common Issues

### Frontend can't connect to Supabase
**Solution:** Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`

### Edge functions fail with "Missing environment variable"
**Solution:** Set the secret in Supabase Dashboard → Edge Functions, not in `.env.local`

### Emails not sending
**Solutions:**
- Verify `RESEND_API_KEY` is correct
- Check domain is verified in Resend
- Verify `FROM_EMAIL` matches your verified domain
- Check Resend dashboard for error messages

### "Invalid API key" from Resend
**Solution:** 
- Create a new API key in Resend
- Make sure you copied the full key (starts with `re_`)
- Update the `RESEND_API_KEY` secret in Supabase

---

## Security Best Practices

✅ **DO:**
- Use different Supabase projects for dev/staging/production
- Rotate API keys periodically
- Use environment-specific values in Vercel
- Keep `.env.local` in `.gitignore`

❌ **DON'T:**
- Commit `.env.local` to git
- Share your `SUPABASE_SERVICE_ROLE_KEY` publicly
- Use production credentials in development
- Hardcode secrets in edge function code

---

## Quick Reference

```bash
# Create .env.local file
cat > .env.local << EOF
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
EOF

# Set Supabase secrets (do this in Supabase Dashboard UI)
# Cannot be done via CLI for security

# Deploy edge functions (after setting secrets)
supabase functions deploy

# Check if secrets are set
supabase secrets list
```

---

## Checklist

Before going to production, verify:

- [ ] Frontend `.env.local` has correct Supabase URL and anon key
- [ ] Supabase edge function secrets are set (RESEND_API_KEY, FROM_EMAIL, APP_BASE_URL)
- [ ] Resend domain is verified (or using test email)
- [ ] Vercel environment variables are set for all environments
- [ ] Test signup/login works
- [ ] Test group creation works
- [ ] Test invitation email sending works
- [ ] Test invitation acceptance works

---

**All set!** Your environment is properly configured. 🚀

