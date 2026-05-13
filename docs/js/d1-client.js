/* ── d1-client.js ──────────────────────────────────────────────────────────
   Client navigateur drop-in compatible avec firebase-firestore modular SDK.

   Migration Firestore -> Cloudflare D1 (via Worker https://jahartarp-api.workers.dev).
   La plupart des fichiers JS du site importent les fonctions Firebase comme
   `doc`, `getDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`,
   `collection`, `query`, `where`, `serverTimestamp`. Ce fichier expose la
   MÊME API (signatures identiques) backée par le Worker D1.

   Remplace l'import :
     - import { ... } from "https://www.gstatic.com/firebasejs/.../firebase-firestore.js"
     + import { ... } from "./d1-client.js"

   Auth :
     - Le JWT est stocké dans localStorage["d1_jwt"].
     - Toutes les requêtes envoient Authorization: Bearer <jwt> si présent.

   Real-time :
     - onSnapshot() utilise du polling (intervalle 3 s par défaut, ETag pour
       skip les renders inutiles). Adaptable via window.__D1_POLL_MS.
   ────────────────────────────────────────────────────────────────────────── */

/* ── Config ─────────────────────────────────────────────────────────────── */

export const API_BASE =
  window.__D1_API_BASE__ || "https://jahartarp-api.jahartarp.workers.dev/api";

const POLL_MS_DEFAULT = window.__D1_POLL_MS__ || 3000;

/* ── Auth helpers ───────────────────────────────────────────────────────── */

const JWT_KEY = "d1_jwt";

export function setJWT(token) {
  if (token) localStorage.setItem(JWT_KEY, token);
  else localStorage.removeItem(JWT_KEY);
}
export function getJWT() {
  return localStorage.getItem(JWT_KEY) || "";
}
export function clearJWT() {
  localStorage.removeItem(JWT_KEY);
}

/* Si l'URL contient #jwt=... (callback OAuth), récupère-le et nettoie l'URL. */
(function consumeJWTFromHash() {
  if (typeof location === "undefined") return;
  const h = location.hash || "";
  const m = h.match(/jwt=([^&]+)/);
  if (m) {
    setJWT(m[1]);
    history.replaceState(null, "", location.pathname + location.search);
  }
})();

async function fetchAPI(path, { method = "GET", body, headers = {}, etag } = {}) {
  const h = new Headers(headers);
  const jwt = getJWT();
  if (jwt) h.set("Authorization", `Bearer ${jwt}`);
  if (body !== undefined && !(body instanceof FormData)) {
    h.set("Content-Type", "application/json");
  }
  if (etag) h.set("If-None-Match", etag);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : (body instanceof FormData ? body : JSON.stringify(body)),
  });
  return res;
}

/* ── Fake "Firestore" namespace ─────────────────────────────────────────── */

export function getFirestore() {
  return { _kind: "d1" };
}
export function initializeFirestore() {
  return { _kind: "d1" };
}
export function persistentLocalCache() {
  return { _kind: "d1-cache" }; // no-op, on a déjà ETag côté HTTP
}

/* ── References ─────────────────────────────────────────────────────────── */

class CollectionRef {
  constructor(name) {
    this.id = name;
    this.path = name;
    this._kind = "collection";
  }
}
class DocRef {
  constructor(collection, id) {
    this.id = id;
    this.path = `${collection}/${id}`;
    this._collection = collection;
    this._kind = "doc";
  }
}
class QueryRef {
  constructor(collection, constraints = [], lim = null) {
    this._collection = collection;
    this._constraints = constraints;
    this._limit = lim;
    this._kind = "query";
  }
}

export function collection(db, name, ...rest) {
  // Firebase supporte collection(db, 'a', 'doc', 'b') -> sous-coll, on n'en a pas.
  if (rest.length > 0) {
    console.warn("[d1-client] subcollections non supportées:", name, rest);
  }
  return new CollectionRef(name);
}

export function doc(dbOrColl, ...args) {
  // doc(db, "players", "123") ou doc(colRef, "123")
  if (dbOrColl && dbOrColl._kind === "collection") {
    return new DocRef(dbOrColl.id, args[0]);
  }
  if (typeof args[0] === "string" && typeof args[1] === "string") {
    return new DocRef(args[0], args[1]);
  }
  // doc(colRef) sans id => auto-id
  if (dbOrColl && dbOrColl._kind === "collection" && args.length === 0) {
    return new DocRef(dbOrColl.id, randomId());
  }
  throw new Error("[d1-client] doc(): signature invalide");
}

function randomId() {
  // 20-char base62 like Firestore
  const buf = new Uint8Array(15);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(36)).join("").slice(0, 20);
}

/* ── Query constraints ──────────────────────────────────────────────────── */

export function query(colRef, ...constraints) {
  const where = [];
  let lim = null;
  for (const c of constraints) {
    if (c && c._kind === "where") where.push({ field: c.field, op: c.op, value: c.value });
    else if (c && c._kind === "limit") lim = c.value;
  }
  return new QueryRef(colRef.id, where, lim);
}

export function where(field, op, value) {
  return { _kind: "where", field, op, value };
}
export function limit(n) {
  return { _kind: "limit", value: n };
}
// orderBy: D1 supporté via JSON1, mais notre API ne l'expose pas encore -> no-op
export function orderBy() {
  return { _kind: "orderby" };
}

/* ── Sentinels ──────────────────────────────────────────────────────────── */

export function serverTimestamp() {
  return { __op: "server_timestamp" };
}
export function increment(n) {
  return { __op: "increment", value: n };
}
export function arrayUnion(...vals) {
  // pas supporté nativement côté Worker pour l'instant
  console.warn("[d1-client] arrayUnion non supporté natif — passe la liste finale");
  return { __op: "array_union", values: vals };
}
export function arrayRemove(...vals) {
  console.warn("[d1-client] arrayRemove non supporté natif");
  return { __op: "array_remove", values: vals };
}
export function deleteField() {
  return { __op: "delete_field" };
}

/* ── DocumentSnapshot / QuerySnapshot ───────────────────────────────────── */

class DocSnapshot {
  constructor(id, data, ref) {
    this.id = id;
    this._data = data;
    this.exists = () => data !== null && data !== undefined;
    this.ref = ref;
  }
  data() {
    return this._data ? cloneNoMeta(this._data) : undefined;
  }
  get(field) {
    if (!this._data) return undefined;
    const parts = field.split(".");
    let cur = this._data;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return undefined;
    }
    return cur;
  }
}

class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
  forEach(cb) {
    this.docs.forEach(cb);
  }
}

function cloneNoMeta(d) {
  const c = JSON.parse(JSON.stringify(d));
  delete c._id;
  delete c._updated_at;
  return c;
}

/* ── CRUD ───────────────────────────────────────────────────────────────── */

export async function getDoc(docRef) {
  const r = await fetchAPI(`/docs/${docRef._collection}/${encodeURIComponent(docRef.id)}`);
  if (r.status === 404) return new DocSnapshot(docRef.id, null, docRef);
  if (!r.ok) throw apiError(r);
  const data = await r.json();
  return new DocSnapshot(docRef.id, data, docRef);
}

export async function getDocs(refOrQuery) {
  if (refOrQuery._kind === "query") {
    const q = btoa(JSON.stringify(refOrQuery._constraints));
    const params = new URLSearchParams({ q });
    if (refOrQuery._limit) params.set("limit", String(refOrQuery._limit));
    const r = await fetchAPI(`/docs/${refOrQuery._collection}?${params}`);
    if (!r.ok) throw apiError(r);
    const body = await r.json();
    const docs = (body.docs || []).map((d) => new DocSnapshot(d._id, d, new DocRef(refOrQuery._collection, d._id)));
    return new QuerySnapshot(docs);
  }
  // collection ref => list all
  const r = await fetchAPI(`/docs/${refOrQuery.id}`);
  if (!r.ok) throw apiError(r);
  const body = await r.json();
  const docs = (body.docs || []).map((d) => new DocSnapshot(d._id, d, new DocRef(refOrQuery.id, d._id)));
  return new QuerySnapshot(docs);
}

export async function setDoc(docRef, data, options = {}) {
  const merge = options.merge === true;
  const r = await fetchAPI(
    `/docs/${docRef._collection}/${encodeURIComponent(docRef.id)}?merge=${merge ? 1 : 0}`,
    { method: "POST", body: data }
  );
  if (!r.ok) throw apiError(r);
  return undefined; // Firestore-style
}

export async function updateDoc(docRef, dataOrField, value) {
  let body;
  if (typeof dataOrField === "string") {
    // updateDoc(ref, "field.path", value, "field2", value2, ...)
    body = { [dataOrField]: value };
    // Note: variadic form (field,value,field,value,...) not used in this codebase but supported
    const argsAll = arguments;
    for (let i = 2; i < argsAll.length - 1; i += 2) {
      body[argsAll[i]] = argsAll[i + 1];
    }
  } else {
    body = dataOrField;
  }
  const r = await fetchAPI(`/docs/${docRef._collection}/${encodeURIComponent(docRef.id)}`, {
    method: "PATCH",
    body,
  });
  if (!r.ok) throw apiError(r);
  return undefined;
}

export async function deleteDoc(docRef) {
  const r = await fetchAPI(`/docs/${docRef._collection}/${encodeURIComponent(docRef.id)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw apiError(r);
  return undefined;
}

export async function addDoc(colRef, data) {
  const id = randomId();
  const dr = new DocRef(colRef.id, id);
  await setDoc(dr, data, { merge: false });
  return dr;
}

/* ── onSnapshot (POLLING) ───────────────────────────────────────────────── */

/**
 * onSnapshot(docRefOrQuery, onNext, onError?)
 * Renvoie une fonction unsubscribe.
 *
 * Implémentation : polling fetchAPI tous les POLL_MS_DEFAULT ms.
 * Pour un doc unique, on utilise If-None-Match (ETag) côté Worker → 304
 * tant que le doc n'a pas changé (coût D1 minimal + bande passante zéro).
 */
export function onSnapshot(target, onNext, onError) {
  let stopped = false;
  let lastEtag = null;
  let lastSnap = null;
  const interval = (target && target._poll_ms) || POLL_MS_DEFAULT;

  async function tick() {
    if (stopped) return;
    try {
      if (target._kind === "doc") {
        const path = `/docs/${target._collection}/${encodeURIComponent(target.id)}`;
        const r = await fetchAPI(path, { etag: lastEtag });
        if (r.status === 304) {
          // pas de changement
        } else if (r.status === 404) {
          const snap = new DocSnapshot(target.id, null, target);
          if (!lastSnap || lastSnap.exists()) {
            lastSnap = snap;
            onNext(snap);
          }
        } else if (r.ok) {
          lastEtag = r.headers.get("ETag");
          const data = await r.json();
          const snap = new DocSnapshot(target.id, data, target);
          lastSnap = snap;
          onNext(snap);
        } else {
          throw apiError(r);
        }
      } else if (target._kind === "query" || target._kind === "collection") {
        const snap = await getDocs(target);
        // Compare hash to skip identical
        const hash = quickHash(snap.docs.map((d) => `${d.id}:${d._data?._updated_at || 0}`).join("|"));
        if (lastEtag !== hash) {
          lastEtag = hash;
          onNext(snap);
        }
      } else {
        throw new Error("[d1-client] onSnapshot target invalide");
      }
    } catch (e) {
      if (onError) onError(e);
      else console.error("[d1-client] onSnapshot error:", e);
    }
    if (!stopped) setTimeout(tick, interval);
  }
  tick();
  return () => {
    stopped = true;
  };
}

function quickHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

/* ── Auth (Firestore Auth shim) ─────────────────────────────────────────── */

let currentUser = null;
const authListeners = [];

export function getAuth() {
  return {
    currentUser,
    signOut: async () => {
      currentUser = null;
      clearJWT();
      authListeners.forEach((cb) => cb(null));
    },
  };
}

export function onAuthStateChanged(_auth, cb) {
  authListeners.push(cb);
  // bootstrap : si on a un JWT, on récupère /api/auth/me
  (async () => {
    const jwt = getJWT();
    if (!jwt) { cb(null); return; }
    try {
      const r = await fetchAPI("/auth/me");
      if (r.ok) {
        currentUser = await r.json();
        currentUser.uid = currentUser.discord_id; // Firebase compat
        cb(currentUser);
      } else {
        currentUser = null;
        clearJWT();
        cb(null);
      }
    } catch {
      cb(null);
    }
  })();
  return () => {
    const i = authListeners.indexOf(cb);
    if (i >= 0) authListeners.splice(i, 1);
  };
}

/* Connexion via /link code Discord (workflow bot). */
export async function signInWithLinkCode(code) {
  const r = await fetchAPI("/auth/link", { method: "POST", body: { code } });
  if (!r.ok) throw apiError(r);
  const body = await r.json();
  setJWT(body.token);
  currentUser = { ...body.user, uid: body.user.discord_id };
  authListeners.forEach((cb) => cb(currentUser));
  return currentUser;
}

/* Redirige vers /api/auth/discord/login (admin uniquement). */
export function signInWithDiscord(returnPath = "/admin.html") {
  location.href = `${API_BASE}/auth/discord/login?return=${encodeURIComponent(returnPath)}`;
}

/* ── Storage (R2 via Worker) ────────────────────────────────────────────── */

export function getStorage() {
  return { _kind: "r2" };
}

export function ref(_storage, path) {
  return { _kind: "r2-ref", path: String(path).replace(/^\/+/, "") };
}

export async function uploadBytes(refObj, file, metadata = {}) {
  const form = new FormData();
  form.append("file", file);
  // refObj.path is something like "fiches/abc123.png"
  // Split into folder + filename
  const parts = refObj.path.split("/");
  const fname = parts.pop();
  const folder = parts.join("/") || "uploads";
  form.append("folder", folder);
  form.append("key", refObj.path); // explicit key

  const r = await fetchAPI("/upload", { method: "POST", body: form });
  if (!r.ok) throw apiError(r);
  const data = await r.json();
  return { ref: refObj, metadata: { ...metadata, ...data } };
}

export async function getDownloadURL(refObj) {
  return `${API_BASE.replace(/\/api$/, "/api")}/files/${refObj.path}`;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

function apiError(res) {
  const e = new Error(`API ${res.status}`);
  e.status = res.status;
  e.statusText = res.statusText;
  return e;
}

/* ── Expose une compat globale window._db / window._doc / etc. ──────────── */

if (typeof window !== "undefined") {
  window._db = getFirestore();
  window._storage = getStorage();
  window._doc = doc;
  window._getDoc = getDoc;
  window._setDoc = setDoc;
  window._updateDoc = updateDoc;
  window._deleteDoc = deleteDoc;
  window._addDoc = addDoc;
  window._collection = collection;
  window._serverTimestamp = serverTimestamp;
  window._increment = increment;
  window._ref = ref;
  window._uploadBytes = uploadBytes;
  window._getDownloadURL = getDownloadURL;
  window._isAdmin = false; // mis à jour par onAuthStateChanged
}
