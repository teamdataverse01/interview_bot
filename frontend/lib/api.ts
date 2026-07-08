import { supabase } from "./supabase";
import { DEMO_MODE, getDemoToken } from "./devauth";

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/api${normalizedPath}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  // 1) A redeemed demo token wins (single-use, code-scoped identity).
  const demo = getDemoToken();
  if (demo) return { Authorization: `Bearer ${demo}` };
  // 2) A real signed-in user (admin/team) — works even in demo mode.
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    /* ignore */
  }
  // 3) No session: in demo mode, access requires a code (no fallback).
  if (DEMO_MODE) return {};
  // 4) Dev/no-auth convenience for non-demo environments.
  return { Authorization: "Bearer dev" };
}

async function handle(res: Response) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function apiGet(path: string) {
  const res = await fetch(buildUrl(path), { headers: { ...(await authHeaders()) } });
  return handle(res);
}

export async function apiPost(path: string, body?: unknown) {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}

// Multipart upload (e.g. audio for /transcribe). Don't set Content-Type — the browser adds the
// multipart boundary automatically.
export async function apiUpload(path: string, form: FormData) {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { ...(await authHeaders()) },
    body: form,
  });
  return handle(res);
}
