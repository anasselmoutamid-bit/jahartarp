/**
 * jaharta-cache.js — Système de cache Firestore partagé pour tout le site Jaharta.
 *
 * Usage (compat SDK — hub, gacha) :
 *   <script src="js/jaharta-cache.js"></script>
 *   const data = await JCache.get('players', userId, 30);
 *   JCache.invalidate('players', userId);
 *
 * Usage (modular SDK — fiches, pnj, racesjouables) :
 *   <script src="js/jaharta-cache.js"></script>
 *   // Utiliser window.JCache directement
 *
 * Le cache est en mémoire (JS) avec TTL configurable par collection.
 * Il évite les reads Firestore redondants quand on navigue entre onglets/pages
 * sans perdre la fraîcheur des données.
 */

(function(root){
  'use strict';

  var _store = {};

  // TTL par défaut par collection (secondes)
  var DEFAULT_TTLS = {
    'config':              600,   // 10 min — données statiques
    'gacha_config':        120,   // 2 min  — bannières
    'gacha_rotation':      120,
    'races_data':          600,
    'players':             30,
    'gacha_pity':          30,
    'characters':          30,
    'active_characters':   15,
    'inventories':         15,
    'economy':             15,
    'shops':               60,
    'companions_user':     60,
    'titles_user':         60,
    'parties':             60,
    'party_membership':    60,
    'buffs':               30,
    'pnj':                 120,
    'pnj_filters':         300,
    'fiches':              60,
    'admins':              300,
    'logs':                30,
    'moderation_warnings': 60,
    'moderation_mutes':    60,
  };

  function _key(collection, docId) {
    return docId ? collection + '/' + docId : '_col_' + collection;
  }

  function _ttl(collection, override) {
    if (override !== undefined && override !== null) return override * 1000;
    // Match by prefix
    var keys = Object.keys(DEFAULT_TTLS);
    for (var i = 0; i < keys.length; i++) {
      if (collection === keys[i] || collection.startsWith(keys[i])) {
        return DEFAULT_TTLS[keys[i]] * 1000;
      }
    }
    return 30000; // 30s default
  }

  var JCache = {
    /**
     * Get cached data. Returns null if expired or absent.
     */
    peek: function(collection, docId) {
      var k = _key(collection, docId);
      var entry = _store[k];
      if (!entry) return null;
      if (Date.now() > entry.exp) { delete _store[k]; return null; }
      return entry.data;
    },

    /**
     * Store data in cache.
     * @param {string} collection
     * @param {string} docId
     * @param {*} data
     * @param {number} [ttlSeconds] — override TTL
     */
    put: function(collection, docId, data, ttlSeconds) {
      var k = _key(collection, docId);
      _store[k] = { data: data, exp: Date.now() + _ttl(collection, ttlSeconds) };
    },

    /**
     * Invalidate a single cached entry.
     */
    invalidate: function(collection, docId) {
      var k = _key(collection, docId);
      delete _store[k];
    },

    /**
     * Invalidate all entries for a collection.
     */
    invalidateCollection: function(collection) {
      var prefix1 = collection + '/';
      var prefix2 = '_col_' + collection;
      Object.keys(_store).forEach(function(k) {
        if (k.startsWith(prefix1) || k === prefix2) delete _store[k];
      });
    },

    /**
     * Invalidate everything.
     */
    clear: function() {
      _store = {};
    },

    /**
     * Get a Firestore doc with cache (compat SDK — uses db.collection().doc().get()).
     * @param {object} db — Firestore instance
     * @param {string} collection
     * @param {string} docId
     * @param {number} [ttlSeconds]
     * @returns {Promise<object|null>}
     */
    get: async function(db, collection, docId, ttlSeconds) {
      var cached = this.peek(collection, docId);
      if (cached !== null) return cached;
      var snap = await db.collection(collection).doc(docId).get();
      var data = snap.exists ? snap.data() : null;
      this.put(collection, docId, data, ttlSeconds);
      return data;
    },

    /**
     * Get a Firestore doc with cache (modular SDK — uses getDoc(doc(db,...))).
     * @param {function} getDocFn — the getDoc function
     * @param {function} docFn — the doc function
     * @param {object} db — Firestore instance
     * @param {string} collection
     * @param {string} docId
     * @param {number} [ttlSeconds]
     * @returns {Promise<object|null>}
     */
    getModular: async function(getDocFn, docFn, db, collection, docId, ttlSeconds) {
      var cached = this.peek(collection, docId);
      if (cached !== null) return cached;
      var snap = await getDocFn(docFn(db, collection, docId));
      var data = snap.exists() ? snap.data() : null;
      this.put(collection, docId, data, ttlSeconds);
      return data;
    },

    /**
     * Get all docs in a collection with cache (compat SDK).
     * @param {object} db
     * @param {string} collection
     * @param {number} [ttlSeconds]
     * @returns {Promise<Array>}
     */
    getAll: async function(db, collection, ttlSeconds) {
      var k = '_col_' + collection;
      var cached = this.peek(collection, null);
      if (cached !== null) return cached;
      var snap = await db.collection(collection).get();
      var docs = [];
      snap.forEach(function(d) { docs.push({ _key: d.id, ...d.data() }); });
      this.put(collection, null, docs, ttlSeconds);
      return docs;
    },

    /**
     * Get all docs with cache (modular SDK).
     */
    getAllModular: async function(getDocsFn, collectionFn, db, collectionName, ttlSeconds) {
      var cached = this.peek(collectionName, null);
      if (cached !== null) return cached;
      var snap = await getDocsFn(collectionFn(db, collectionName));
      var docs = [];
      snap.forEach(function(d) { docs.push({ _key: d.id, id: d.id, ...d.data() }); });
      this.put(collectionName, null, docs, ttlSeconds);
      return docs;
    },

    /**
     * Wrap an onSnapshot listener so it only re-subscribes if the previous
     * subscription is stale (older than ttl). Useful for pages that reload.
     * Returns the unsubscribe function.
     */
    _snapSubs: {},
    onSnapshotCached: function(db, collectionRef, cacheKey, callback, ttlSeconds) {
      var existing = this._snapSubs[cacheKey];
      if (existing && Date.now() < existing.exp) {
        // Still active — just re-fire callback with cached data
        var cached = this.peek(cacheKey, null);
        if (cached !== null) { callback(cached); return existing.unsub; }
      }
      // New subscription
      if (existing && existing.unsub) { try { existing.unsub(); } catch(e){} }
      var self = this;
      var unsub = collectionRef.onSnapshot
        ? collectionRef.onSnapshot(function(snap) {
            var docs = [];
            snap.forEach(function(d) { docs.push({ id: d.id, ...d.data() }); });
            self.put(cacheKey, null, docs, ttlSeconds);
            callback(docs);
          })
        : function(){};  // fallback noop
      this._snapSubs[cacheKey] = {
        unsub: unsub,
        exp: Date.now() + _ttl(cacheKey, ttlSeconds)
      };
      return unsub;
    },

    /** Debug: show cache stats */
    stats: function() {
      var now = Date.now();
      var total = Object.keys(_store).length;
      var active = 0;
      Object.values(_store).forEach(function(e) { if (now < e.exp) active++; });
      return { total: total, active: active, expired: total - active };
    }
  };

  // Expose globally
  root.JCache = JCache;

})(typeof window !== 'undefined' ? window : this);
