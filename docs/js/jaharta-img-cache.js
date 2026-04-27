/* ═══════════════════════════════════════════════════════════════════════
   docs/js/jaharta-img-cache.js — Cache localStorage pour URLs d'images
   ═══════════════════════════════════════════════════════════════════════
   Persiste les URLs Firebase Storage entre les navigations de pages.
   Les URLs sont déjà stockées dans Firestore — ce cache évite d'attendre
   la réponse Firestore pour afficher les images (cache-first loading).

   Inclure après jaharta-cache.js :
     <script src="js/jaharta-cache.js"></script>
     <script src="js/jaharta-img-cache.js"></script>

   API :
     JImgCache.applyTo(imgEl, key, freshUrl)  — méthode principale
     JImgCache.get(key)                       → url | null
     JImgCache.set(key, url)
     JImgCache.invalidate(key)                — appelé quand photo changée
     JImgCache.stats()                        → debug
*/

(function(root) {
  'use strict';

  var PREFIX = 'jimg_';
  var TTL    = 24 * 60 * 60 * 1000; // 24h — URLs Firebase Storage très stables

  var JImgCache = {

    /* ── Lecture ── */
    get: function(key) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        var entry = JSON.parse(raw);
        if (Date.now() > entry.exp) { localStorage.removeItem(PREFIX + key); return null; }
        /* Re-valider l'URL au moment de la lecture — protège contre les
           modifications manuelles du localStorage entre les sessions. */
        if (!this._isSafeUrl(entry.url)) { localStorage.removeItem(PREFIX + key); return null; }
        return entry.url;
      } catch (e) {
        return null;
      }
    },

    /* ── Validation URL (anti-manipulation localStorage) ── */
    _isSafeUrl: function(url) {
      if (!url || typeof url !== 'string') return false;
      /* Accepte uniquement les URLs Firebase Storage et les data: images compressées */
      return url.startsWith('https://firebasestorage.googleapis.com/') ||
             url.startsWith('https://storage.googleapis.com/');
    },

    /* ── Écriture ── */
    set: function(key, url) {
      if (!url) return;
      /* Rejette silencieusement les URLs non-Firebase pour éviter l'injection */
      if (!this._isSafeUrl(url)) return;
      var payload = JSON.stringify({ url: url, exp: Date.now() + TTL });
      try {
        localStorage.setItem(PREFIX + key, payload);
      } catch (e) {
        // localStorage plein — purger les entrées expirées puis réessayer
        this._prune();
        try { localStorage.setItem(PREFIX + key, payload); } catch (e2) { /* silencieux */ }
      }
    },

    /* ── Méthode principale : applique l'URL à un <img> (cache-first) ── */
    applyTo: function(imgEl, key, freshUrl) {
      if (!imgEl) return;
      var cached = this.get(key);
      if (cached) {
        imgEl.src = cached;
        // URL mise à jour côté Firestore ? Actualiser cache + image
        if (freshUrl && freshUrl !== cached) {
          imgEl.src = freshUrl;
          this.set(key, freshUrl);
        }
      } else if (freshUrl) {
        imgEl.src = freshUrl;
        this.set(key, freshUrl);
      }
    },

    /* ── Invalidation (appelée quand le joueur change sa photo) ── */
    invalidate: function(key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    },

    /* ── Purge des entrées expirées (interne) ── */
    _prune: function() {
      var now = Date.now();
      try {
        Object.keys(localStorage)
          .filter(function(k) { return k.startsWith(PREFIX); })
          .forEach(function(k) {
            try {
              var e = JSON.parse(localStorage.getItem(k));
              if (now > e.exp) localStorage.removeItem(k);
            } catch (e2) { localStorage.removeItem(k); }
          });
      } catch (e) {}
    },

    /* ── Debug ── */
    stats: function() {
      var n = 0;
      try { Object.keys(localStorage).forEach(function(k) { if (k.startsWith(PREFIX)) n++; }); } catch (e) {}
      return { entries: n, prefix: PREFIX, ttlH: 24 };
    }
  };

  root.JImgCache = JImgCache;

})(typeof window !== 'undefined' ? window : this);
