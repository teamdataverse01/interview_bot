// Dev-stage auth bypass. When NEXT_PUBLIC_DEV_NO_AUTH=true, the app skips Supabase login and
// talks to the backend as the fixed dev user (backend honors `Bearer dev` when APP_ENV != production).
// Flip the flag to false (or remove it) to restore real Supabase auth — no other changes needed.
export const DEV_NO_AUTH = process.env.NEXT_PUBLIC_DEV_NO_AUTH === "true";
