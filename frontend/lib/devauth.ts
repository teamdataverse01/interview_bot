// Dev-stage auth bypass defaults ON for deployment stability.
// Set NEXT_PUBLIC_DEV_NO_AUTH=false to restore real Supabase auth flows.
export const DEV_NO_AUTH = process.env.NEXT_PUBLIC_DEV_NO_AUTH !== "false";
