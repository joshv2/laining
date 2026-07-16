# Laining Collaborative

Pasuk-level collaborative laining platform with:
- learner playback and sing-along mode
- teacher invites and assignments
- moderation queue for recording approval
- role-based auth (Google + NextAuth)
- optional AssemblyAI alignment for word timings

## 1. Local Setup

### Prerequisites
- Node 20+
- PostgreSQL 15+
- Google OAuth credentials

### Install
```bash
npm install
```

### Environment
Copy .env.example to .env and set values:
- DATABASE_URL
- AUTH_SECRET
- AUTH_GOOGLE_ID
- AUTH_GOOGLE_SECRET
- NEXTAUTH_URL
- ASSEMBLY_API_KEY (optional, required for auto-alignment)
- NEXT_PUBLIC_GA_MEASUREMENT_ID (optional, for analytics)
- TEACHER_FEATURE_PRICE_CENTS (optional, defaults to 0; set teacher feature price in cents)

### Database
```bash
npx prisma generate
npx prisma migrate deploy
```

For local development with a fresh DB:
```bash
npx prisma migrate dev
```

### Seed text (basic)
```bash
npm run seed:text
```

### Refresh Hebrew text with cantillation marks (taamim)
```bash
npm run refresh:text:taamim
```

### Run app
```bash
npm run dev
```

## 2. Production Deployment (Detailed)

This section assumes Vercel + managed Postgres. A VPS flow is similar, but you run build/start yourself.

### Step A: Prepare managed Postgres
1. Create a production Postgres database.
2. Copy its connection string.
3. Ensure SSL is enabled if your provider requires it.

### Step B: Create Google OAuth production credentials
1. In Google Cloud Console, create OAuth client credentials for web.
2. Add authorized redirect URI:
	- https://YOUR_DOMAIN/api/auth/callback/google
3. Save client ID and client secret.

### Step C: Create project in Vercel
1. Import this repo into Vercel.
2. Framework preset: Next.js.
3. Node version: 20+.

### Step D: Set production environment variables in Vercel
Set all variables from .env.example:
- DATABASE_URL
- AUTH_SECRET (generate a strong random value)
- AUTH_GOOGLE_ID
- AUTH_GOOGLE_SECRET
- NEXTAUTH_URL=https://YOUR_DOMAIN
- ASSEMBLY_API_KEY (if using alignment)
- NEXT_PUBLIC_GA_MEASUREMENT_ID (optional)

### Step E: Run DB migrations on production DB
From your local machine (or CI) with production DATABASE_URL:
```bash
npx prisma migrate deploy
```

### Step F: Deploy
1. Trigger a production deployment from Vercel.
2. Confirm build passes.
3. Open the production URL and sign in.

### Step G: Post-deploy checks
1. Authentication
	- Google sign-in works
	- user session persists
2. Learner flow
	- select pasuk
	- play recordings
	- sing-along highlights and clickable seek
3. Teacher flow
	- create invite
	- accept invite
	- assign recording
4. Moderation flow
	- pending approval appears
	- approve/reject updates status
5. Upload flow
	- submission stores file under public/uploads
6. Optional integrations
	- AssemblyAI alignment works when API key is set
	- GA events visible in Google Analytics Realtime report

## 3. Soft Launch Notes

- Terms page is available at /terms.
- Footer now includes copyright and licensing language.
- Navigation/header is now global and role-aware.
- Assignment count badge appears in the top nav for signed-in users.

## 4. Useful Commands

```bash
npm run dev
npm run lint
npm run build
npm run seed:text
npm run refresh:text:taamim
```
