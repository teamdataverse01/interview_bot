import { supabase } from "./supabase";
import { DEMO_MODE, DEV_NO_AUTH, getDemoToken } from "./devauth";

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/api${normalizedPath}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  // A redeemed demo token always wins (single-use, code-scoped identity).
  const demo = getDemoToken();
  if (demo) return { Authorization: `Bearer ${demo}` };
  // In demo mode there is no dev/anon fallback — access requires a demo token.
  if (DEMO_MODE) return {};
  if (DEV_NO_AUTH) return { Authorization: "Bearer dev" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Deployment-safe fallback: if there is no Supabase session token yet,
  // still send dev auth so no-auth environments keep working.
  return token ? { Authorization: `Bearer ${token}` } : { Authorization: "Bearer dev" };
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
