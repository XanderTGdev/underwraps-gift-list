# Supabase Migration Guide

This guide walks you through migrating from your Loveable-managed Supabase project to a fresh, directly-managed Supabase project.

## Overview

You have two options:
1. **Fresh Start** (Recommended): New Supabase project with consolidated schema
2. **Keep Data**: Migrate existing data to the new project

This guide covers Option 1 (Fresh Start), which is cleaner and easier.

---

## Prerequisites

- [ ] Node.js and npm installed
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] A Supabase account

---

## Step 1: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: `underwraps-gift-list` (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait ~2 minutes for project to be created

---

## Step 2: Get Project Credentials

Once your project is ready:

1. In Supabase dashboard, go to **Project Settings** → **API**
2. Copy and save these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Project ID/Reference** (e.g., `xxxxx`)
   - **anon public** key
   - **service_role** key (keep this secret!)

3. Go to **Project Settings** → **Database**
   - Copy the **Connection string** (you'll need this for deployments)

---

## Step 3: Link Your Local Project

In your project directory:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your new project
supabase link --project-ref YOUR_PROJECT_REF
```

When prompted, enter your database password from Step 1.

---

## Step 4: Clean Up Old Migrations

```bash
# Create a backup directory
mkdir -p supabase/migrations_old

# Move old migrations to backup
mv supabase/migrations/2025*.sql supabase/migrations_old/

# The new consolidated migration (00000000000000_consolidated_schema.sql) stays
```

---

## Step 5: Apply the Consolidated Migration

```bash
# Push the consolidated schema to your new project
supabase db push

# You should see: "Applying migration 00000000000000_consolidated_schema.sql..."
```

If successful, you'll see:
```
✓ All migrations applied successfully
```

---

## Step 6: Set Up Environment Variables

You need to configure these environment variables for your edge functions.

### In Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Click **Add secret**
3. Add these secrets:

| Secret Name | Value | Where to Get It |
|------------|-------|-----------------|
| `RESEND_API_KEY` | Your Resend API key | [resend.com/api-keys](https://resend.com/api-keys) |
| `FROM_EMAIL` | `noreply@yourdomain.com` | Your verified domain in Resend |
| `APP_BASE_URL` | `https://yourapp.vercel.app` | Your production app URL |

### Get Resend API Key:

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain (or use their free testing domain)
3. Create an API key
4. Add it to Supabase secrets as `RESEND_API_KEY`

---

## Step 7: Deploy Edge Functions

```bash
# Deploy all edge functions at once
supabase functions deploy

# Or deploy them individually
supabase functions deploy accept-invitation
supabase functions deploy add-item
supabase functions deploy claim-item
supabase functions deploy create-group
supabase functions deploy create-wishlist
supabase functions deploy delete-group
supabase functions deploy delete-item
supabase functions deploy delete-user
supabase functions deploy delete-wishlist
supabase functions deploy edit-item
supabase functions deploy fetch-product-metadata
supabase functions deploy remove-member
supabase functions deploy send-invitation
supabase functions deploy unclaim-item
supabase functions deploy update-user-role
supabase functions deploy validate-invitation
```

---

## Step 8: Update Your Frontend Configuration

Update your frontend environment variables:

### For Local Development (`.env.local`):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### For Vercel Deployment:

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Update:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## Step 9: Update Supabase Client (if needed)

Check your `src/integrations/supabase/client.ts` file. It should look like:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Step 10: Test Everything

### 10.1 Test Authentication:
- [ ] Sign up new user
- [ ] Sign in
- [ ] Sign out

### 10.2 Test Groups:
- [ ] Create a new group
- [ ] View group details
- [ ] Invite a member (check email arrives)
- [ ] Accept invitation (use different browser/incognito)
- [ ] Remove a member

### 10.3 Test Wishlists:
- [ ] Create a wishlist
- [ ] Add items to wishlist
- [ ] Edit item
- [ ] Delete item

### 10.4 Test Claims:
- [ ] Claim an item (as different user)
- [ ] View claimed items
- [ ] Unclaim an item
- [ ] Check reveal date logic

---

## Step 11: Configure Auth Providers (Optional)

If you want social auth (Google, GitHub, etc.):

1. Go to **Authentication** → **Providers**
2. Enable desired providers
3. Configure OAuth credentials
4. Update your app's auth UI accordingly

---

## Troubleshooting

### Migration Fails

```bash
# Check what's wrong
supabase db diff

# Reset and try again
supabase db reset
supabase db push
```

### Edge Functions Not Working

```bash
# Check logs
supabase functions logs FUNCTION_NAME --tail

# Common issues:
# - Missing environment variables
# - CORS issues (check headers in function code)
```

### RLS Policy Issues

If users can't access data they should:

```bash
# Connect to your database
supabase db remote connect

# Then run SQL queries to debug:
# SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

### "Email rate limit exceeded" (Resend)

Free tier has limits. Upgrade Resend plan or use Supabase's built-in email auth.

---

## Key Differences from Loveable Setup

| Aspect | Loveable | New Setup |
|--------|----------|-----------|
| Migrations | Managed by AI | You control directly |
| Deployments | Through Loveable | Direct CLI (`supabase functions deploy`) |
| Schema Changes | Request via Loveable | Edit SQL, run `supabase db push` |
| Edge Functions | AI generates | You edit directly |
| Version Control | Hidden | Visible in your repo |

---

## Next Steps

1. **Delete old migrations backup** after confirming everything works:
   ```bash
   rm -rf supabase/migrations_old
   ```

2. **Update your README** with new setup instructions

3. **Consider setting up CI/CD** for automatic deployments:
   ```yaml
   # Example GitHub Action
   - name: Deploy Supabase Functions
     run: supabase functions deploy
   ```

4. **Monitor your project**:
   - Set up alerts in Supabase dashboard
   - Monitor database performance
   - Check edge function logs regularly

---

## Rollback Plan (If Needed)

If something goes wrong, you can always:

1. Keep your old Loveable project active temporarily
2. Point your app back to the old project (revert env vars)
3. Debug the new project without downtime
4. Switch back when ready

---

## Getting Help

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord**: [discord.supabase.com](https://discord.supabase.com)
- **Edge Functions Guide**: [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)

---

## Summary Checklist

- [ ] Create new Supabase project
- [ ] Get and save credentials
- [ ] Link local project
- [ ] Clean up old migrations
- [ ] Apply consolidated migration
- [ ] Set up environment variables (Resend API key)
- [ ] Deploy edge functions
- [ ] Update frontend env vars
- [ ] Test all functionality
- [ ] Deploy to production
- [ ] Update documentation

---

**You're all set!** 🎉

You now have full control over your Supabase backend without the Loveable middleman.

