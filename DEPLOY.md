# Deploying to Railway (two services, one project)

The repo is a monorepo: **`backend/`** (FastAPI) and **`frontend/`** (Next.js). On Railway you
create **two services in one project**, each pointing at its own folder. Secrets live as Railway
service variables — never committed (`.env` is git-ignored).

Order matters: **deploy the backend first**, grab its public URL, then build the frontend with that
URL baked in (Next.js `NEXT_PUBLIC_*` vars are build-time).

---

## 0. Push the repo to GitHub (one time)

```bash
git init
git add .
git commit -m "Dataverse AI Interview Coach — M1-M5"
gh repo create dataverse-interview-bot --private --source=. --push   # or create on github.com and push
```

`.env`, `frontend/.env.local`, `boss_doc.txt`, and `temp.wav` are git-ignored — they will NOT be
pushed. You'll re-enter the secrets as Railway variables below.

---

## 1. Backend service (FastAPI)

1. Railway → **New Project → Deploy from GitHub repo** → pick the repo.
2. On the created service → **Settings → Root Directory** = `backend`.
3. **Settings → Networking → Generate Domain** (note the URL, e.g. `https://api-xxxx.up.railway.app`).
4. **Variables** → add:

   ```
   APP_ENV=production
   LLM_PROVIDER=mistral
   MISTRAL_API_KEY=...
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   OPENROUTER_API_KEY=...
   SUPABASE_URL=https://ugdefuwhfhdpvppxltqc.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_KEY=sb_secret_...
   DATABASE_URL=postgresql://postgres.ugdefuwhfhdpvppxltqc:<password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres
   CORS_ORIGINS=https://<frontend-domain>.up.railway.app
   ```
   (Set `CORS_ORIGINS` after step 2 of the frontend, once you know its domain. Until then leave it `*`.)

   Railway auto-detects Python from `requirements.txt`; `backend/railway.toml` runs
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT` and health-checks `/health`.
5. Verify: open `https://<backend-domain>.up.railway.app/health` → `{"status":"ok","db":true,...}`.

> The DB schema is already applied (you ran `python -m db.migrate`). To re-run against a fresh DB,
> run that command locally once with `DATABASE_URL` set.

---

## 2. Frontend service (Next.js)

1. Same Railway project → **New → GitHub repo → same repo** (creates a second service).
2. **Settings → Root Directory** = `frontend`.
3. **Settings → Networking → Generate Domain** (note it, e.g. `https://app-xxxx.up.railway.app`).
4. **Variables** → add (these are baked at build, so set them BEFORE the first build):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ugdefuwhfhdpvppxltqc.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_API_URL=https://<backend-domain>.up.railway.app
   ```
5. Go back to the **backend** service and set `CORS_ORIGINS` to this frontend domain, then redeploy
   the backend.
6. Open the frontend domain → sign up → start an interview.

---

## 3. Supabase auth setting (important)

In Supabase → **Authentication → Sign In / Providers → Email**: turn **off "Confirm email"** for a
frictionless signup (otherwise users must click an email link before they can log in). Supabase also
rejects fake domains (`example.com`); use real-looking emails.

Add your Railway frontend domain under **Authentication → URL Configuration → Site URL / Redirect URLs**.

---

## Redeploys

Push to GitHub → Railway auto-rebuilds both services. If you change a `NEXT_PUBLIC_*` value, the
frontend must rebuild (Railway does this automatically on a variable change or new commit).
