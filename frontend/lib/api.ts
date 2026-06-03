import { supabase } from "./supabase";
import { DEV_NO_AUTH } from "./devauth";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API}${normalizedPath}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (DEV_NO_AUTH) return { Authorization: "Bearer dev" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
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
