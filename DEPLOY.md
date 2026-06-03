# Deploying to Railway (No Sign-In Mode)

This repo is a monorepo with two services:

- `backend/` (FastAPI)
- `frontend/` (Next.js)

On Railway, create two services in one project, each with its own root directory.

Deploy order matters: deploy backend first, then frontend with `NEXT_PUBLIC_API_URL` set to backend URL.

---

## 1. Backend service (FastAPI)

1. Railway -> New Project -> Deploy from GitHub repo -> pick this repo.
2. Open backend service -> Settings -> Root Directory = `backend`.
3. Settings -> Networking -> Generate Domain (save it as `<backend-domain>`).
4. Variables -> add:

   ```
   APP_ENV=development
   LLM_PROVIDER=mistral
   MISTRAL_API_KEY=...
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   OPENROUTER_API_KEY=...
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_KEY=sb_secret_...
   DATABASE_URL=postgresql://postgres.<ref>:<password>@<host>:6543/postgres
   CORS_ORIGINS=https://<frontend-domain>.up.railway.app
   ```

   Notes:

   - `APP_ENV` must be non-production for no-sign-in mode (`Bearer dev`) to work.
   - If frontend domain is not known yet, temporarily set `CORS_ORIGINS=*`, then update later.

5. Verify backend health:
   - `https://<backend-domain>.up.railway.app/health` should return `{"status":"ok", ...}`.

---

## 2. Frontend service (Next.js)

1. In the same Railway project -> New -> GitHub repo -> select the same repo (creates second service).
2. Frontend service -> Settings -> Root Directory = `frontend`.
3. Settings -> Networking -> Generate Domain (save as `<frontend-domain>`).
4. Variables -> add BEFORE first build:

   ```
   NEXT_PUBLIC_API_URL=https://<backend-domain>.up.railway.app
   NEXT_PUBLIC_DEV_NO_AUTH=true
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NIXPACKS_NODE_VERSION=20
   ```

   Notes:

   - `NEXT_PUBLIC_DEV_NO_AUTH=true` skips login UI and routes users directly into the app.
   - Supabase public vars can stay configured even when sign-in is bypassed.
   - `NIXPACKS_NODE_VERSION=20` forces Railway/Nixpacks to build with Node 20+, which Next.js requires.

5. Go back to backend and set:

   ```
   CORS_ORIGINS=https://<frontend-domain>.up.railway.app
   ```

6. Redeploy backend.
7. Open frontend URL -> app should open without sign-in -> start interview from dashboard.

---

## 3. Optional: Re-enable Sign-In Later

If you want real auth again:

1. Frontend: set `NEXT_PUBLIC_DEV_NO_AUTH=false` and redeploy.
2. Backend: set `APP_ENV=production` and redeploy.
3. Configure Supabase Auth URL settings and providers.

---

## Redeploy Behavior

- New push to GitHub -> Railway auto-rebuilds services.
- Any change to `NEXT_PUBLIC_*` requires frontend rebuild (Railway does this automatically).

---

## Troubleshooting (Railway)

- If build fails with `UndefinedVar: Usage of undefined variable '$NIXPACKS_PATH'`:
   - Remove any custom Railway variable named `NIXPACKS_PATH`.
   - Keep only `NIXPACKS_NODE_VERSION=20` for Node selection.
   - Redeploy the frontend service.
   - If it still fails, switch frontend Builder to Dockerfile and set Dockerfile path to `frontend/Dockerfile`.

- If runtime says `Application failed to respond`:
   - Confirm frontend start command is `sh -c 'npm run start -- -H 0.0.0.0 -p ${PORT:-3000}'`.
   - Confirm backend `CORS_ORIGINS` exactly matches frontend domain.

### Dockerfile fallback (frontend)

This repo now includes `frontend/Dockerfile` and `frontend/.dockerignore`.

Use this when Nixpacks keeps failing with internal variable errors:

1. Frontend service -> Settings -> Build -> Builder = Dockerfile.
2. Dockerfile path = `frontend/Dockerfile`.
3. Keep frontend variables unchanged (`NEXT_PUBLIC_*` etc.), and do not hardcode a conflicting `PORT` value.
4. Redeploy frontend service.
