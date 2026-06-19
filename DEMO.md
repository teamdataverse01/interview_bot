# Demo Mode — gated student demos (single-use codes)

For the boss's student demo: each student enters a **one-time access code**, gets **exactly one
interview session**, and is then locked out. Abuse-resistant by design:

- Codes are **claimed atomically** on the server — a code can never be redeemed twice.
- The demo identity is granted **zero spare credits**, so it can't start a second session.
- The session token is **HMAC-signed** (can't be forged) and **scoped to that one code**.
- In demo mode the `Bearer dev` bypass is **disabled**, so nobody can skip the gate.

## 1. Turn it on (Railway env vars)

**Backend service** → Variables:
```
DEMO_MODE=true
# (DEMO_SECRET is optional; it defaults to your Supabase service key)
```

**Frontend service** → Variables (then redeploy frontend so it rebuilds):
```
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_DEV_NO_AUTH=false
```

With these set, the app opens on a **/demo** code-entry screen. No code = no access.

## 2. Generate codes

**Option A — locally (easiest):** with the backend `.env` (or `DATABASE_URL`) configured:
```bash
cd backend
python gen_demo_codes.py 30 "Unilag demo"
```
It prints 30 codes like `DV-7KQ4MP`. Hand out one per student.

**Option B — via the admin API** (needs an admin login / `Bearer dev` when not in demo mode):
```
POST /admin/demo-codes   { "count": 30, "note": "Unilag demo" }
GET  /admin/demo-codes    # list codes + which are used
```

## 3. Student flow

1. Student opens the site → **/demo** → types their code → **Start interview**.
2. They get one full mock interview (defaults to **Beginner**, General, Practice mode).
3. When done, the code is spent — re-entering it says *"Invalid or already-used access code."*

## 4. Turn it back off (return to team dev)

Set `DEMO_MODE=false` (backend) and `NEXT_PUBLIC_DEMO_MODE=false` (frontend), redeploy.
Used codes stay used; generate a fresh batch for the next demo.
