// index.js — Entry point + routing.
//
// Toutes les routes commencent par /api/* pour ne pas entrer en conflit
// avec un éventuel mapping sur jahartarp.fr/* à l'avenir.

import { json, err, corsHeaders, applyCors, parsePath } from "./utils.js";
import {
  readSession,
  handleAuthLink,
  handleAuthMe,
  handleAuthLogout,
  handleDiscordLogin,
  handleDiscordCallback,
} from "./auth.js";
import {
  getDoc,
  listDocs,
  queryDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  audit,
} from "./db.js";
import { checkAccess } from "./rules.js";
import { handleFileGet, handleFileDelete, handleUpload } from "./storage.js";

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";

    // ── Preflight CORS ─────────────────────────────────────────────────────
    if (req.method === "OPTIONS") {
      const h = corsHeaders(origin, env.ALLOWED_ORIGINS);
      return new Response(null, { status: 204, headers: h });
    }

    let res;
    try {
      res = await route(req, env, url);
    } catch (e) {
      console.error("Unhandled error:", e?.stack || e);
      res = err(500, "internal server error", e?.message);
    }
    return applyCors(res, origin, env.ALLOWED_ORIGINS);
  },
};

// ── Router ──────────────────────────────────────────────────────────────────

async function route(req, env, url) {
  const parts = parsePath(req.url);
  // parts: ["api", "docs", "players", "123"]
  if (parts[0] !== "api") return err(404, "use /api/* prefix");

  const [, kind, ...rest] = parts;

  // ── Health
  if (kind === "health") {
    return json({ ok: true, ts: new Date().toISOString() });
  }

  // ── Auth routes
  if (kind === "auth") {
    const sub = rest[0];
    if (sub === "link" && req.method === "POST") return handleAuthLink(req, env);
    if (sub === "me" && req.method === "GET") return handleAuthMe(req, env);
    if (sub === "logout" && req.method === "POST") return handleAuthLogout();
    if (sub === "discord") {
      if (rest[1] === "login") return handleDiscordLogin(req, env);
      if (rest[1] === "callback") return handleDiscordCallback(req, env);
    }
    return err(404, "auth route not found");
  }

  // ── Files (R2)
  if (kind === "files") {
    const key = rest.join("/");
    if (req.method === "GET") return handleFileGet(req, env, key);
    if (req.method === "DELETE") {
      const s = await readSession(req, env);
      return handleFileDelete(req, env, s, key);
    }
    return err(405, "method not allowed");
  }
  if (kind === "upload" && req.method === "POST") {
    const s = await readSession(req, env);
    return handleUpload(req, env, s);
  }

  // ── Documents CRUD
  if (kind === "docs") {
    const collection = rest[0];
    const docId = rest[1];
    if (!collection) return err(400, "collection required");

    const session = await readSession(req, env);

    // GET /api/docs/:coll/:id          -> read 1 doc
    // GET /api/docs/:coll              -> list (?limit=&offset=)
    // POST /api/docs/:coll/:id         -> set (body=data, ?merge=1)
    // PATCH /api/docs/:coll/:id        -> update partial
    // DELETE /api/docs/:coll/:id       -> delete

    if (req.method === "GET" && docId) {
      const access = checkAccess(session, collection, "read", { docId });
      if (!access.ok) return err(access.status, access.message);

      // ETag-based cache : si client envoie If-None-Match qui matche, 304
      const ifNone = req.headers.get("If-None-Match");
      const doc = await getDoc(env, collection, docId);
      if (!doc) return err(404, "not found");
      const etag = `"${doc._updated_at || 0}"`;
      if (ifNone && ifNone === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }
      const res = json(doc);
      res.headers.set("ETag", etag);
      res.headers.set("Cache-Control", "private, max-age=3");
      return res;
    }

    if (req.method === "GET" && !docId) {
      const access = checkAccess(session, collection, "list");
      if (!access.ok) return err(access.status, access.message);

      // Support ?q= for query (base64-encoded JSON of conditions array)
      const q = url.searchParams.get("q");
      if (q) {
        let conds;
        try { conds = JSON.parse(atob(q)); } catch { return err(400, "invalid q param"); }
        const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
        const docs = await queryDocs(env, collection, conds, { limit });
        return json({ collection, docs });
      }

      const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      const docs = await listDocs(env, collection, { limit, offset });
      return json({ collection, docs });
    }

    if (req.method === "POST" && docId) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return err(400, "JSON body required");
      const merge = url.searchParams.get("merge") === "1" || body.__merge === true;
      delete body.__merge;
      // Pour `update` rule : on a besoin de l'existing pour calculer le diff
      const existing = await getDoc(env, collection, docId);
      const isCreate = !existing;
      const op = isCreate ? "create" : "update";
      const access = checkAccess(session, collection, op, {
        docId, data: body, existing, merged: merge ? { ...(existing || {}), ...body } : body,
      });
      if (!access.ok) return err(access.status, access.message);
      const result = await setDoc(env, collection, docId, body, { merge });
      await audit(env, op, {
        user_id: session?.discord_id, collection, doc_id: docId, delta: body, source: "worker",
      });
      return json({ ok: true, doc: result });
    }

    if (req.method === "PATCH" && docId) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return err(400, "JSON body required");
      const existing = await getDoc(env, collection, docId);
      if (!existing) return err(404, "not found");
      const access = checkAccess(session, collection, "update", {
        docId, data: body, existing, merged: { ...existing, ...body },
      });
      if (!access.ok) return err(access.status, access.message);
      try {
        const result = await updateDoc(env, collection, docId, body);
        await audit(env, "update", {
          user_id: session?.discord_id, collection, doc_id: docId, delta: body, source: "worker",
        });
        return json({ ok: true, doc: result });
      } catch (e) {
        if (e.code === "not-found") return err(404, "not found");
        throw e;
      }
    }

    if (req.method === "DELETE" && docId) {
      const access = checkAccess(session, collection, "delete", { docId });
      if (!access.ok) return err(access.status, access.message);
      const ok = await deleteDoc(env, collection, docId);
      await audit(env, "delete", {
        user_id: session?.discord_id, collection, doc_id: docId, source: "worker",
      });
      return json({ ok });
    }

    return err(405, "method not allowed");
  }

  return err(404, "unknown route");
}
