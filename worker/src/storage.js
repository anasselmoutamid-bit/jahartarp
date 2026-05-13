// storage.js — Uploads R2 + accès aux fichiers via le Worker.
//
// Stratégie URLs : le bucket R2 n'est pas exposé publiquement.
// Le Worker proxy les GET via /api/files/:key. URLs caches via CDN.

import { json, err } from "./utils.js";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MiB
const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml",
]);

// ── GET /api/files/:key ─────────────────────────────────────────────────────
// Sert un fichier depuis R2 (avec cache CDN agressif).

export async function handleFileGet(req, env, key) {
  if (!key) return err(400, "key required");
  const obj = await env.ASSETS.get(key);
  if (!obj) return err(404, "not found");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { headers });
}

// ── POST /api/upload ────────────────────────────────────────────────────────
// Upload multipart. Authenticated only.
// Form fields: file (binary), folder (optional path prefix), key (optional)

export async function handleUpload(req, env, session) {
  if (!session) return err(401, "auth required");

  const form = await req.formData().catch(() => null);
  if (!form) return err(400, "multipart/form-data expected");

  const file = form.get("file");
  if (!file || typeof file === "string") return err(400, "file field missing");

  const size = file.size;
  if (size > MAX_UPLOAD_BYTES) return err(413, `file too large (max ${MAX_UPLOAD_BYTES} bytes)`);

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) return err(415, `mime not allowed: ${mime}`);

  // Build key: <folder>/<discord_id>/<timestamp>-<random>.<ext>
  const folder = sanitizeFolder(form.get("folder") || "uploads");
  const ext = pickExt(file.name || "", mime);
  const explicit = form.get("key");
  const key = explicit
    ? sanitizeKey(String(explicit))
    : `${folder}/${session.discord_id}/${Date.now()}-${rnd()}.${ext}`;

  await env.ASSETS.put(key, file.stream(), {
    httpMetadata: { contentType: mime },
    customMetadata: { uploaded_by: session.discord_id, uploaded_at: new Date().toISOString() },
  });

  return json({
    key,
    url: `${env.WORKER_PUBLIC_URL}/api/files/${key}`,
    size,
    mime,
  });
}

// ── DELETE /api/files/:key (admin) ──────────────────────────────────────────

export async function handleFileDelete(req, env, session, key) {
  if (!session?.is_admin) return err(403, "admin only");
  await env.ASSETS.delete(key);
  return json({ ok: true });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeFolder(s) {
  return String(s).replace(/[^a-zA-Z0-9/_-]/g, "").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "") || "uploads";
}
function sanitizeKey(s) {
  return String(s).replace(/[^a-zA-Z0-9./_-]/g, "").replace(/\/+/g, "/").replace(/^\/+/, "");
}
function pickExt(filename, mime) {
  const m = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (m) return m[1].toLowerCase();
  const map = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };
  return map[mime] || "bin";
}
function rnd() {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}
