import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sanitizeProxyResponseHeaders(headers: Headers): Headers {
  const out = new Headers(headers);

  // Remove headers that can become invalid after proxy/body transformations.
  out.delete("content-encoding");
  out.delete("content-length");
  out.delete("transfer-encoding");
  out.delete("connection");

  return out;
}

function backendBaseUrl(): string {
  const backend = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

  if (!backend) {
    throw new Error("Missing API_URL for frontend proxy");
  }

  return backend.replace(/\/+$/, "");
}

async function proxy(request: NextRequest, path: string[]) {
  let target: URL;

  try {
    const pathname = path.length ? `/${path.join("/")}` : "";
    target = new URL(`${backendBaseUrl()}${pathname}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid API_URL";
    return NextResponse.json({ detail }, { status: 500 });
  }

  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  // Avoid compressed upstream payloads that can break browser decoding after proxying.
  headers.delete("accept-encoding");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(target, init);
    const headers = sanitizeProxyResponseHeaders(response.headers);
    headers.set("x-proxy-target", target.origin);
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    const unavailable = NextResponse.json(
      { detail: `Backend unavailable at ${target.origin}` },
      { status: 502 },
    );
    unavailable.headers.set("x-proxy-target", target.origin);
    return unavailable;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}