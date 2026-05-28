/* ── firebase-compat-shim.js ────────────────────────────────────────────────
   Shim global qui imite `window.firebase` (Firebase compat SDK) mais parle à
   Cloudflare D1 via le Worker. Remplace en 1 script les 3 imports compat :
     <script src="firebase-app-compat.js">
     <script src="firebase-auth-compat.js">
     <script src="firebase-firestore-compat.js">
   →
     <script src="js/firebase-compat-shim.js">

   API exposée (sous-ensemble compat utilisé par hub/gacha/casino/competences) :
     firebase.initializeApp(cfg)         no-op
     firebase.apps                       []
     firebase.firestore()                FSClient
     firebase.auth()                     AuthClient
     firebase.firestore.FieldValue.serverTimestamp()
     firebase.firestore.FieldValue.increment(n)
     firebase.firestore.Timestamp.now() / .fromDate()

   FSClient.collection(name) -> Coll
     .doc(id) -> DocRef
       .get() -> Promise<DocSnapshot>
       .set(data, {merge?}) -> Promise
       .update(data) -> Promise
       .delete() -> Promise
       .onSnapshot(onNext, onErr?) -> unsub
     .where(field, op, value) -> Query (chainable)
     .orderBy(field, dir?) -> Query
     .limit(n) -> Query
     .get() -> Promise<QuerySnapshot>
     .onSnapshot(onNext, onErr?) -> unsub
     .add(data) -> Promise<DocRef>
   FSClient.batch() -> WriteBatch
   FSClient.runTransaction(fn) -> Promise (best-effort optimistic)

   Auth :
     .currentUser
     .signOut()
     .onAuthStateChanged(cb)
     .signInWithPopup(provider)   -> redirige vers Discord OAuth
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  const API_BASE =
    window.__D1_API_BASE__ || "https://jahartarp-api.jahartarp.workers.dev/api";
  const POLL_MS = window.__D1_POLL_MS__ || 5000;     // 5s (avant 3s)
  const POLL_HIDDEN_MS = 60000;                       // 60s quand onglet en background
  const POLL_IDLE_MS = 30000;                         // 30s après 2 min sans interaction
  const IDLE_THRESHOLD = 2 * 60 * 1000;               // 2 minutes
  const JWT_KEY = "d1_jwt";

  /* Tracker d'interaction utilisateur (souris, clavier, touch). */
  let lastInteraction = Date.now();
  ["mousedown","keydown","touchstart","wheel"].forEach(ev =>
    addEventListener(ev, () => { lastInteraction = Date.now(); }, { passive: true, capture: true }));

  function currentPollMs() {
    if (typeof document !== "undefined" && document.hidden) return POLL_HIDDEN_MS;
    if (Date.now() - lastInteraction > IDLE_THRESHOLD) return POLL_IDLE_MS;
    return POLL_MS;
  }

  /* ── Auth helpers ──────────────────────────────────────────────────────── */
  function getJWT() { return localStorage.getItem(JWT_KEY) || ""; }
  function setJWT(t) { if (t) localStorage.setItem(JWT_KEY, t); else localStorage.removeItem(JWT_KEY); }

  // Récupère JWT depuis #jwt=... après callback OAuth
  (function consumeHash() {
    const m = (location.hash || "").match(/jwt=([^&]+)/);
    if (m) {
      setJWT(m[1]);
      history.replaceState(null, "", location.pathname + location.search);
    }
  })();

  async function fetchAPI(path, opts = {}) {
    const h = new Headers(opts.headers || {});
    const jwt = getJWT();
    if (jwt) h.set("Authorization", `Bearer ${jwt}`);
    if (opts.body !== undefined && !(opts.body instanceof FormData)) {
      h.set("Content-Type", "application/json");
    }
    if (opts.etag) h.set("If-None-Match", opts.etag);
    return fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers: h,
      body: opts.body === undefined ? undefined : (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)),
    });
  }

  /* ── Sentinels ─────────────────────────────────────────────────────────── */
  function serverTimestamp() { return { __op: "server_timestamp" }; }
  function increment(n) { return { __op: "increment", value: n }; }
  function arrayUnion(...v) { return { __op: "array_union", values: v }; }
  function arrayRemove(...v) { return { __op: "array_remove", values: v }; }
  function deleteField() { return { __op: "delete_field" }; }

  /* ── Timestamp (Firebase-like) ──────────────────────────────────────────── */
  class Timestamp {
    constructor(seconds, nanoseconds = 0) {
      this.seconds = seconds; this.nanoseconds = nanoseconds;
    }
    toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
    toDate() { return new Date(this.toMillis()); }
    static now() { return Timestamp.fromMillis(Date.now()); }
    static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
    static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  }

  /* ── DocSnapshot / QuerySnapshot ───────────────────────────────────────── */
  function makeDocSnapshot(id, data, ref) {
    return {
      id,
      ref,
      exists: data !== null && data !== undefined,
      data() {
        if (!data) return undefined;
        const c = JSON.parse(JSON.stringify(data));
        delete c._id; delete c._updated_at;
        return c;
      },
      get(fieldPath) {
        if (!data) return undefined;
        let cur = data;
        for (const p of String(fieldPath).split(".")) {
          if (cur && typeof cur === "object" && p in cur) cur = cur[p];
          else return undefined;
        }
        return cur;
      },
    };
  }

  function makeQuerySnapshot(docs) {
    return {
      docs, size: docs.length, empty: docs.length === 0,
      forEach(cb) { docs.forEach(cb); },
    };
  }

  /* ── DocRef ────────────────────────────────────────────────────────────── */
  function makeDocRef(collection, id) {
    const ref = {
      id, path: `${collection}/${id}`,
      _collection: collection,
      _isDocRef: true,

      async get() {
        const r = await fetchAPI(`/docs/${collection}/${encodeURIComponent(id)}`);
        if (r.status === 404) return makeDocSnapshot(id, null, ref);
        if (!r.ok) throw new Error(`API ${r.status}`);
        const data = await r.json();
        return makeDocSnapshot(id, data, ref);
      },

      async set(data, opts = {}) {
        const merge = opts.merge === true;
        const r = await fetchAPI(`/docs/${collection}/${encodeURIComponent(id)}?merge=${merge ? 1 : 0}`,
          { method: "POST", body: data });
        if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      },

      async update(...args) {
        let body;
        if (typeof args[0] === "string") {
          body = {};
          for (let i = 0; i < args.length - 1; i += 2) body[args[i]] = args[i + 1];
        } else {
          body = args[0];
        }
        const r = await fetchAPI(`/docs/${collection}/${encodeURIComponent(id)}`,
          { method: "PATCH", body });
        if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      },

      async delete() {
        const r = await fetchAPI(`/docs/${collection}/${encodeURIComponent(id)}`,
          { method: "DELETE" });
        if (!r.ok) throw new Error(`API ${r.status}`);
      },

      onSnapshot(onNext, onErr) {
        let stopped = false;
        let lastEtag = null;
        let lastDataKey = null;
        async function tick() {
          if (stopped) return;
          try {
            const r = await fetchAPI(`/docs/${collection}/${encodeURIComponent(id)}`,
              { etag: lastEtag });
            if (r.status === 304) {
              // no change
            } else if (r.status === 404) {
              if (lastDataKey !== "__none__") {
                lastDataKey = "__none__";
                onNext(makeDocSnapshot(id, null, ref));
              }
            } else if (r.ok) {
              lastEtag = r.headers.get("ETag");
              const data = await r.json();
              const key = JSON.stringify(data);
              if (key !== lastDataKey) {
                lastDataKey = key;
                onNext(makeDocSnapshot(id, data, ref));
              }
            } else {
              throw new Error(`API ${r.status}`);
            }
          } catch (e) {
            if (onErr) onErr(e);
            else console.error("[firebase-compat-shim] doc onSnapshot:", e);
          }
          if (!stopped) setTimeout(tick, currentPollMs());
        }
        tick();
        return () => { stopped = true; };
      },
    };
    return ref;
  }

  /* ── Query (where/limit/orderBy/get/onSnapshot) ────────────────────────── */
  function makeQuery(collection, conditions = [], lim = null, ord = null) {
    const q = {
      _collection: collection,
      _conditions: conditions,
      _limit: lim,
      _order: ord,

      where(field, op, value) {
        return makeQuery(collection, [...conditions, { field, op, value }], lim, ord);
      },
      limit(n) {
        return makeQuery(collection, conditions, Number(n), ord);
      },
      orderBy(field, dir = "asc") {
        return makeQuery(collection, conditions, lim, { field, dir });
      },

      async get(_opts = {}) {
        const params = new URLSearchParams();
        if (conditions.length) {
          params.set("q", btoa(JSON.stringify(conditions)));
        }
        if (lim) params.set("limit", String(lim));
        const r = await fetchAPI(`/docs/${collection}?${params}`, { etag: _opts.etag });
        if (r.status === 304) return null; // pas de changement
        if (!r.ok) throw new Error(`API ${r.status}`);
        const body = await r.json();
        const docs = (body.docs || []).map(d => makeDocSnapshot(d._id, d, makeDocRef(collection, d._id)));
        const snap = makeQuerySnapshot(docs);
        snap._etag = r.headers.get("ETag");
        return snap;
      },

      onSnapshot(onNext, onErr) {
        let stopped = false;
        let lastEtag = null;
        async function tick() {
          if (stopped) return;
          try {
            const snap = await q.get({ etag: lastEtag });
            if (snap !== null) {
              // Premier hit OU collection changée — push à l'app
              lastEtag = snap._etag || lastEtag;
              onNext(snap);
            }
          } catch (e) {
            if (onErr) onErr(e);
            else console.error("[firebase-compat-shim] query onSnapshot:", e);
          }
          if (!stopped) setTimeout(tick, currentPollMs());
        }
        tick();
        return () => { stopped = true; };
      },
    };
    return q;
  }

  /* ── Collection ────────────────────────────────────────────────────────── */
  function makeCollection(name) {
    const coll = {
      id: name, _isCollection: true,

      doc(id) {
        if (!id) {
          // Auto-id (≈ Firestore 20-char base62)
          const buf = new Uint8Array(15);
          crypto.getRandomValues(buf);
          id = [...buf].map(b => b.toString(36)).join("").slice(0, 20);
        }
        return makeDocRef(name, String(id));
      },
      where(field, op, value) {
        return makeQuery(name).where(field, op, value);
      },
      orderBy(field, dir) {
        return makeQuery(name).orderBy(field, dir);
      },
      limit(n) {
        return makeQuery(name).limit(n);
      },
      async get() {
        return makeQuery(name).get();
      },
      onSnapshot(onNext, onErr) {
        return makeQuery(name).onSnapshot(onNext, onErr);
      },
      async add(data) {
        const ref = coll.doc();
        await ref.set(data, { merge: false });
        return ref;
      },
    };
    return coll;
  }

  /* ── WriteBatch ────────────────────────────────────────────────────────── */
  function makeWriteBatch() {
    const ops = [];
    return {
      set(ref, data, opts) { ops.push(() => ref.set(data, opts || {})); return this; },
      update(ref, data) { ops.push(() => ref.update(data)); return this; },
      delete(ref) { ops.push(() => ref.delete()); return this; },
      async commit() {
        // Pas atomique sur D1 HTTP — séquentiel.
        for (const f of ops) await f();
        ops.length = 0;
      },
    };
  }

  /* ── Transaction (optimistic, single-try) ──────────────────────────────── */
  async function runTransaction(updateFn) {
    const txCache = new Map();
    const pendingOps = [];

    const tx = {
      async get(ref) {
        const snap = await ref.get();
        txCache.set(ref.path, snap);
        return snap;
      },
      set(ref, data, opts) { pendingOps.push(() => ref.set(data, opts || {})); return tx; },
      update(ref, data) { pendingOps.push(() => ref.update(data)); return tx; },
      delete(ref) { pendingOps.push(() => ref.delete()); return tx; },
    };

    const result = await updateFn(tx);
    // Commit séquentiel — best-effort, pas atomique strict.
    for (const f of pendingOps) await f();
    return result;
  }

  /* ── FSClient (firestore()) ───────────────────────────────────────────── */
  function makeFSClient() {
    const client = {
      collection(name) { return makeCollection(name); },
      doc(path) {
        const parts = String(path).split("/");
        if (parts.length !== 2) throw new Error(`doc() expects "collection/id", got ${path}`);
        return makeDocRef(parts[0], parts[1]);
      },
      batch() { return makeWriteBatch(); },
      runTransaction(fn) { return runTransaction(fn); },
      enablePersistence() { return Promise.resolve(); },          // no-op
      enableIndexedDbPersistence() { return Promise.resolve(); }, // no-op
      settings() {}, // no-op
    };
    return client;
  }

  /* ── Auth ──────────────────────────────────────────────────────────────── */
  const authListeners = [];
  let currentUser = null;
  let bootstrapping = false;

  function notifyAuthListeners() {
    authListeners.forEach(cb => { try { cb(currentUser); } catch (e) { console.error(e); } });
  }

  async function bootstrapAuth() {
    if (bootstrapping) return;
    bootstrapping = true;
    const jwt = getJWT();
    if (!jwt) {
      currentUser = null;
      notifyAuthListeners();
      return;
    }
    try {
      const r = await fetchAPI("/auth/me");
      if (r.ok) {
        const u = await r.json();
        currentUser = {
          uid: u.discord_id,
          discord_id: u.discord_id,
          is_admin: u.is_admin,
          role: u.role,
          displayName: u.username,
          photoURL: u.avatar_url,
          ...u,
        };
      } else {
        /* JWT invalide/expiré : effacer aussi les sessions hub/gacha pour que
           le joueur soit redirigé vers la page de connexion (et non bloqué en
           apparence connecté mais incapable d'écrire). */
        setJWT("");
        try { localStorage.removeItem("hub_session"); } catch(_) {}
        try { localStorage.removeItem("gacha_session"); } catch(_) {}
        currentUser = null;
      }
    } catch {
      currentUser = null;
    }
    notifyAuthListeners();
  }

  function makeAuthClient() {
    return {
      get currentUser() { return currentUser; },
      onAuthStateChanged(cb) {
        authListeners.push(cb);
        // bootstrap async + push current value asynchronously
        Promise.resolve().then(() => cb(currentUser));
        bootstrapAuth();
        return () => {
          const i = authListeners.indexOf(cb);
          if (i >= 0) authListeners.splice(i, 1);
        };
      },
      async signOut() {
        setJWT("");
        currentUser = null;
        notifyAuthListeners();
      },
      // Compat avec signInWithPopup(provider) — on redirige vers Discord OAuth
      signInWithPopup() {
        location.href = `${API_BASE}/auth/discord/login?return=${encodeURIComponent(location.pathname)}`;
        return new Promise(() => {}); // never resolves (page redirects)
      },
      signInWithRedirect() {
        return this.signInWithPopup();
      },
    };
  }

  /* ── window.firebase global ────────────────────────────────────────────── */
  const firestoreFn = function () { return makeFSClient(); };
  firestoreFn.FieldValue = { serverTimestamp, increment, arrayUnion, arrayRemove, delete: deleteField };
  firestoreFn.Timestamp = Timestamp;

  const authFn = function () { return makeAuthClient(); };
  authFn.GoogleAuthProvider = function () {}; // stub

  const firebase = {
    initializeApp(_cfg) {
      // no-op — D1 est déjà configuré via le Worker
      return { name: "[DEFAULT]" };
    },
    app() { return { name: "[DEFAULT]" }; },
    apps: [{ name: "[DEFAULT]" }],
    firestore: firestoreFn,
    auth: authFn,
  };

  window.firebase = firebase;

  /* ── Helpers pour browser code legacy ─────────────────────────────────── */
  // Login via code /link (utilisé par casino/hub/gacha)
  window.d1LinkSignIn = async function (code) {
    const r = await fetchAPI("/auth/link", { method: "POST", body: { code } });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Link auth failed: ${r.status} ${t}`);
    }
    const body = await r.json();
    setJWT(body.token);
    currentUser = {
      uid: body.user.discord_id,
      discord_id: body.user.discord_id,
      is_admin: body.user.is_admin,
      role: body.user.role,
      displayName: body.user.username,
      photoURL: body.user.avatar_url,
      ...body.user,
    };
    notifyAuthListeners();
    return currentUser;
  };

  // Discord OAuth direct
  window.d1DiscordSignIn = function (returnPath) {
    location.href = `${API_BASE}/auth/discord/login?return=${encodeURIComponent(returnPath || location.pathname)}`;
  };

  // Bootstrap dès le chargement
  bootstrapAuth();
})();
