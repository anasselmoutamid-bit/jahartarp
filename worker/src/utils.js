// utils.js — Helpers communs (JSON, CORS, JWT, deep-merge, etc.)

// ── JSON responses ──────────────────────────────────────────────────────────

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function err(status, message, details) {
  return json({ error: message, ...(details ? { details } : {}) }, { status });
}

// ── CORS ────────────────────────────────────────────────────────────────────

export function corsHeaders(origin, allowedOrigins) {
  const allowed = (allowedOrigins || "").split(",").map((s) => s.trim());
  const ok = origin && allowed.includes(origin);
  const headers = new Headers();
  if (ok) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,If-None-Match"
  );
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function applyCors(res, origin, allowedOrigins) {
  const ch = corsHeaders(origin, allowedOrigins);
  // Response.redirect() retourne une Response immuable -> on doit cloner.
  try {
    ch.forEach((v, k) => res.headers.set(k, v));
    return res;
  } catch {
    const headers = new Headers(res.headers);
    ch.forEach((v, k) => headers.set(k, v));
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

// ── JWT (HS256, no deps) ────────────────────────────────────────────────────

function b64urlEncode(buf) {
  let s = "";
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacSha256(key, data) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

export async function signJWT(payload, secret, ttlSeconds = 7 * 86400) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + ttlSeconds };
  const h = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const sig = await hmacSha256(secret, `${h}.${p}`);
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

export async function verifyJWT(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = b64urlEncode(await hmacSha256(secret, `${h}.${p}`));
  if (expected !== s) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Random secret generator (32 bytes hex) ──────────────────────────────────

export function randomSecret() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Deep merge (Firestore set+merge semantics) ──────────────────────────────

export function deepMerge(dst, src) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      dst[k] &&
      typeof dst[k] === "object" &&
      !Array.isArray(dst[k])
    ) {
      deepMerge(dst[k], v);
    } else {
      dst[k] = v;
    }
  }
  return dst;
}

// ── Set value at dotted path: setDotted(obj, "a.b.c", 42) ───────────────────

export function setDotted(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === null || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Resolve sentinels (serverTimestamp, increment) in a payload ─────────────

export function resolveSentinels(obj, currentObj = null) {
  if (obj == null) return obj;
  // Increment sentinel: { __op: "increment", value: n }
  if (obj && typeof obj === "object" && obj.__op === "increment") {
    const base = typeof currentObj === "number" ? currentObj : 0;
    return base + (Number(obj.value) || 0);
  }
  if (obj && typeof obj === "object" && obj.__op === "server_timestamp") {
    return new Date().toISOString();
  }
  // arrayUnion: ajoute les valeurs absentes du tableau courant (déduplication par JSON)
  if (obj && typeof obj === "object" && obj.__op === "array_union") {
    const base = Array.isArray(currentObj) ? currentObj.slice() : [];
    const seen = new Set(base.map((x) => JSON.stringify(x)));
    for (const v of obj.values || []) {
      const k = JSON.stringify(v);
      if (!seen.has(k)) { seen.add(k); base.push(v); }
    }
    return base;
  }
  // arrayRemove: retire les valeurs égales (par JSON.stringify) du tableau courant
  if (obj && typeof obj === "object" && obj.__op === "array_remove") {
    const base = Array.isArray(currentObj) ? currentObj.slice() : [];
    const toDrop = new Set((obj.values || []).map((v) => JSON.stringify(v)));
    return base.filter((x) => !toDrop.has(JSON.stringify(x)));
  }
  if (obj && typeof obj === "object" && obj.__op === "delete_field") {
    return undefined; // signale au caller de retirer la clé
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => resolveSentinels(v));
  }
  if (typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) {
      const cur = currentObj && typeof currentObj === "object" ? currentObj[k] : null;
      const resolved = resolveSentinels(obj[k], cur);
      if (resolved !== undefined) out[k] = resolved;  // delete_field → skip
    }
    return out;
  }
  return obj;
}

// ── Path / URL helpers ──────────────────────────────────────────────────────

export function parsePath(url) {
  return new URL(url).pathname.split("/").filter(Boolean);
}
