# Quick Start Guide

## TL;DR - 5 Minute Setup

```bash
# 1. Create new Supabase project at supabase.com
#    Save your project ref, URL, and keys

# 2. Link your project
supabase link --project-ref YOUR_PROJECT_REF

# 3. Backup old migrations
mkdir -p supabase/migrations_old
mv supabase/migrations/2025*.sql supabase/migrations_old/

# 4. Apply new schema
supabase db push

# 5. Set Resend API key in Supabase Dashboard
#    Project Settings → Edge Functions → Add secret
#    Name: RESEND_API_KEY
#    Value: re_xxxxxxxxxxxxx (from resend.com)

# 6. Deploy edge functions
supabase functions deploy

# 7. Update .env.local
cat > .env.local << EOF
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
EOF

# 8. Test locally
npm run dev

# 9. Update Vercel env vars (if using Vercel)
#    Dashboard → Settings → Environment Variables
#    Add: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 10. Deploy!
vercel --prod
```

---

## What's in This Repo

| File | Purpose |
|------|---------|
| `SUPABASE_MIGRATION_GUIDE.md` | **Start here** - Detailed step-by-step guide |
| `MIGRATION_SUMMARY.md` | What changed and why |
| `ENVIRONMENT_VARIABLES.md` | All env vars explained |
| `QUICK_START.md` | This file - quick reference |
| `supabase/migrations/00000000000000_consolidated_schema.sql` | Your new clean schema |

---

## Critical Environment Variables

### Frontend (`.env.local`):
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

### Supabase Edge Function Secrets (Dashboard):
- `RESEND_API_KEY` - From resend.com
- `FROM_EMAIL` - e.g., `noreply@yourdomain.com`
- `APP_BASE_URL` - Your app URL

---

## Get Resend API Key (Free)

1. Go to [resend.com](https://resend.com)
2. Sign up (free tier: 100 emails/day)
3. API Keys → Create API Key
4. Copy the key (starts with `re_`)
5. Add to Supabase: Project Settings → Edge Functions → Add secret

**Quick test option**: Use `onboarding@resend.dev` as `FROM_EMAIL` (no domain verification needed)

---

## Common Commands

```bash
# Link to Supabase
supabase link --project-ref YOUR_REF

# Apply migrations
supabase db push

# Deploy all functions
supabase functions deploy

# Deploy one function
supabase functions deploy send-invitation

# View function logs
supabase functions logs send-invitation --tail

# Reset database (⚠️ deletes all data)
supabase db reset

# Generate types (optional)
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## Troubleshooting One-Liners

```bash
# Migration fails?
supabase db reset && supabase db push

# Function failing?
supabase functions logs FUNCTION_NAME --tail

# Can't connect to DB?
supabase db remote connect

# Check RLS policies
# In psql: SELECT * FROM pg_policies WHERE tablename = 'your_table';

# Forgot your project ref?
# Check: supabase.com → your project → Settings → General
```

---

## Test Checklist

- [ ] Sign up new user
- [ ] Create group
- [ ] Invite member (check email arrives)
- [ ] Accept invitation
- [ ] Create wishlist
- [ ] Add item
- [ ] Claim item (different user)
- [ ] Check reveal date works

---

## Need Help?

1. Check `SUPABASE_MIGRATION_GUIDE.md` for detailed troubleshooting
2. Check `ENVIRONMENT_VARIABLES.md` for config issues
3. Check Supabase function logs: `supabase functions logs --tail`
4. Check Supabase Discord: [discord.supabase.com](https://discord.supabase.com)

---

**That's it!** Follow the numbered steps at the top and you're done. 🎉

For detailed explanations, see `SUPABASE_MIGRATION_GUIDE.md`.

