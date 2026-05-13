// db.js — Helpers D1 + sémantique Firestore (merge, query, batch).
// La D1 a UNE seule table `documents (collection, doc_id, data JSON, ...)`.

import { deepMerge, setDotted, resolveSentinels } from "./utils.js";

// ── Read ────────────────────────────────────────────────────────────────────

export async function getDoc(env, collection, docId) {
  // Shadow: la collection 'admins' est aussi servie par app_admins pour que
  // le pattern legacy `getDoc(doc(db,'admins',user.uid))` continue de fonctionner
  // après migration Firebase Auth -> Discord OAuth (les UIDs changent).
  if (collection === "admins") {
    const adminRow = await env.DB.prepare(
      "SELECT role FROM app_admins WHERE user_id = ?"
    )
      .bind(docId)
      .first();
    if (adminRow) {
      return { role: adminRow.role, _id: docId, _updated_at: 0 };
    }
  }

  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM documents WHERE collection = ? AND doc_id = ? LIMIT 1"
  )
    .bind(collection, docId)
    .first();
  if (!row) return null;
  try {
    const data = JSON.parse(row.data);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      data._id = docId;
      data._updated_at = row.updated_at;
    }
    return data;
  } catch {
    return null;
  }
}

export async function listDocs(env, collection, { limit = 1000, offset = 0 } = {}) {
  const rs = await env.DB.prepare(
    "SELECT doc_id, data, updated_at FROM documents WHERE collection = ? LIMIT ? OFFSET ?"
  )
    .bind(collection, Math.min(limit, 5000), offset)
    .all();
  return (rs.results || []).map(rowToDoc);
}

function rowToDoc(r) {
  try {
    const d = JSON.parse(r.data);
    if (d && typeof d === "object" && !Array.isArray(d)) {
      d._id = r.doc_id;
      d._updated_at = r.updated_at;
    }
    return d;
  } catch {
    return null;
  }
}

// ── Query (where) ───────────────────────────────────────────────────────────

const OPS = { "==": "=", "!=": "!=", "<": "<", "<=": "<=", ">": ">", ">=": ">=" };

/**
 * conditions: [{field, op, value}, ...]
 * Returns array of docs.
 */
export async function queryDocs(env, collection, conditions = [], { limit = 1000 } = {}) {
  const where = ["collection = ?"];
  const params = [collection];
  for (const c of conditions) {
    const path = `'$.${c.field}'`;
    const extract = `json_extract(data, ${path})`;
    if (OPS[c.op]) {
      where.push(`${extract} ${OPS[c.op]} ?`);
      params.push(c.value);
    } else if (c.op === "in") {
      const arr = Array.isArray(c.value) ? c.value : [c.value];
      if (!arr.length) { where.push("0"); continue; }
      where.push(`${extract} IN (${arr.map(() => "?").join(",")})`);
      params.push(...arr);
    } else if (c.op === "not-in") {
      const arr = Array.isArray(c.value) ? c.value : [c.value];
      if (!arr.length) { where.push("1"); continue; }
      where.push(`${extract} NOT IN (${arr.map(() => "?").join(",")})`);
      params.push(...arr);
    } else if (c.op === "array-contains") {
      where.push(`EXISTS (SELECT 1 FROM json_each(${extract}) WHERE value = ?)`);
      params.push(c.value);
    } else if (c.op === "array-contains-any") {
      const arr = Array.isArray(c.value) ? c.value : [c.value];
      if (!arr.length) { where.push("0"); continue; }
      where.push(
        `EXISTS (SELECT 1 FROM json_each(${extract}) WHERE value IN (${arr.map(() => "?").join(",")}))`
      );
      params.push(...arr);
    } else {
      throw new Error(`Unknown operator: ${c.op}`);
    }
  }
  const sql = `SELECT doc_id, data, updated_at FROM documents WHERE ${where.join(
    " AND "
  )} LIMIT ?`;
  params.push(Math.min(limit, 5000));
  const rs = await env.DB.prepare(sql).bind(...params).all();
  return (rs.results || []).map(rowToDoc).filter(Boolean);
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * setDoc(env, "players", "123", {navarites: 50}, {merge: true})
 *  - merge=true  : lit l'existant, deep-merge, écrit
 *  - merge=false : remplace tout
 *  Résout aussi les sentinelles serverTimestamp/increment.
 */
export async function setDoc(env, collection, docId, data, { merge = false } = {}) {
  const payload = { ...data };
  delete payload._id;
  delete payload._updated_at;

  let final;
  if (merge) {
    const existing = (await getDoc(env, collection, docId)) || {};
    delete existing._id;
    delete existing._updated_at;
    const resolved = resolveSentinels(payload, existing);
    deepMerge(existing, resolved);
    final = existing;
  } else {
    final = resolveSentinels(payload, null);
  }

  const json = JSON.stringify(final);
  await env.DB.prepare(
    "INSERT INTO documents(collection, doc_id, data) VALUES (?, ?, ?) " +
      "ON CONFLICT(collection, doc_id) DO UPDATE " +
      "SET data = excluded.data, updated_at = unixepoch()"
  )
    .bind(collection, docId, json)
    .run();
  return final;
}

/**
 * updateDoc — partial update, doit exister, supporte les dotted paths.
 */
export async function updateDoc(env, collection, docId, updates) {
  const existing = await getDoc(env, collection, docId);
  if (existing === null) {
    const e = new Error(`Document ${collection}/${docId} not found`);
    e.code = "not-found";
    throw e;
  }
  delete existing._id;
  delete existing._updated_at;

  for (const k of Object.keys(updates)) {
    if (k === "_id" || k === "_updated_at") continue;
    const v = updates[k];
    if (k.includes(".")) {
      // get current value at path for sentinel resolution
      let cur = existing;
      const parts = k.split(".");
      for (const p of parts) {
        cur = cur && typeof cur === "object" ? cur[p] : undefined;
      }
      const resolved = resolveSentinels(v, cur);
      setDotted(existing, k, resolved);
    } else {
      const cur = existing[k];
      const resolved = resolveSentinels(v, cur);
      if (resolved && typeof resolved === "object" && !Array.isArray(resolved) &&
          cur && typeof cur === "object" && !Array.isArray(cur)) {
        deepMerge(cur, resolved);
      } else {
        existing[k] = resolved;
      }
    }
  }
  const json = JSON.stringify(existing);
  await env.DB.prepare(
    "UPDATE documents SET data = ?, updated_at = unixepoch() " +
      "WHERE collection = ? AND doc_id = ?"
  )
    .bind(json, collection, docId)
    .run();
  return existing;
}

export async function deleteDoc(env, collection, docId) {
  const r = await env.DB.prepare(
    "DELETE FROM documents WHERE collection = ? AND doc_id = ?"
  )
    .bind(collection, docId)
    .run();
  return r.meta?.changes > 0;
}

// ── Audit log (best-effort) ─────────────────────────────────────────────────

export async function audit(env, op, info = {}) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log(user_id, collection, doc_id, op, delta, source) " +
        "VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        info.user_id ? String(info.user_id) : null,
        info.collection || null,
        info.doc_id || null,
        op,
        info.delta ? JSON.stringify(info.delta) : null,
        info.source || "worker"
      )
      .run();
  } catch (_) {
    // silencieux — l'audit ne doit jamais bloquer
  }
}

// ── Admin check (table app_admins peuplée par la migration bot) ─────────────

export async function isAdmin(env, userId) {
  if (!userId) return false;
  const r = await env.DB.prepare(
    "SELECT role FROM app_admins WHERE user_id = ? LIMIT 1"
  )
    .bind(String(userId))
    .first();
  return !!r;
}

export async function getAdminRole(env, userId) {
  if (!userId) return null;
  const r = await env.DB.prepare(
    "SELECT role FROM app_admins WHERE user_id = ? LIMIT 1"
  )
    .bind(String(userId))
    .first();
  return r ? r.role : null;
}
