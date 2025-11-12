## UnderWraps Gift List

Collaborative gift lists for families, friends, and groups. Create groups, share wishlists, privately claim gifts, and keep the surprise intact until reveal day.

### Features

- **Groups and invitations**: Create groups, invite members via email, and manage memberships.
- **Roles and permissions**: Owner/Admin/Member roles for safe administration.
- **Wishlists**: Multiple wishlists per group with items, images, links, prices, and notes.
- **Private claiming**: Claim and unclaim items without spoiling surprises; respect a configurable reveal date.
- **Smart links**: Auto-fetch product metadata (title/image) from URLs.
- **Email delivery**: Sends invitation emails via Resend.
- **Modern UI**: Built with React, TypeScript, shadcn-ui, and Tailwind. Fully responsive.
- **Supabase backend**: Auth, Postgres, RLS, and Edge Functions.

### Tech stack

- **Frontend**: Vite, React, TypeScript, shadcn-ui, Tailwind CSS, TanStack Query, React Router
- **Backend**: Supabase (Auth, Postgres, RLS, Edge Functions)
- **Email**: Resend

### Getting started

Prerequisites:
- Node.js 18+ and npm
- A Supabase project and the Supabase CLI (optional but recommended)
- Resend account (for email invites)

1) Install dependencies

```bash
npm i
```

2) Configure environment variables (frontend)

Create `.env.local` in the repo root:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

3) Initialize Supabase (database + functions)

```bash
# Link your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the schema
supabase db push

# Set Edge Function secrets in Supabase Dashboard
#   RESEND_API_KEY  (from resend.com)
#   FROM_EMAIL      (e.g., noreply@yourdomain.com)
#   APP_BASE_URL    (your deployed app URL)

# Deploy edge functions
supabase functions deploy
```

4) Start the app

```bash
npm run dev
```

### Available scripts

- `npm run dev`: Start the Vite dev server
- `npm run build`: Production build
- `npm run preview`: Preview the production build locally
- `npm run lint`: Run ESLint

### Deploy

The frontend is a static site and can be deployed to any static host (e.g., Vercel, Netlify, Cloudflare Pages). Ensure you:
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider’s environment variables
- Deploy Supabase Edge Functions and set required secrets in the Supabase Dashboard

Example (Vercel):
1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables
2. `supabase functions deploy` for server functions and set `RESEND_API_KEY`, `FROM_EMAIL`, `APP_BASE_URL` in Supabase
3. Trigger a Vercel deployment

### Documentation

- `QUICK_START.md`: Fast setup checklist
- `ENVIRONMENT_VARIABLES.md`: All env vars explained
- `SUPABASE_MIGRATION_GUIDE.md`: Detailed Supabase notes and troubleshooting
- `MIGRATION_SUMMARY.md`: Summary of database and policy changes

### Directory overview

- `src/pages`: App routes (auth, groups, wishlists, admin, etc.)
- `src/components`: UI and feature components (dialogs, tables, forms)
- `src/integrations/supabase`: Supabase client and generated types
- `supabase/functions`: Edge Functions (invitations, wishlist actions, metadata fetch, etc.)
- `supabase/migrations`: Database schema and RLS policies
