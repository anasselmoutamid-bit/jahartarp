/* ══════════════════════════════════════════════════════════════════════
   irp-whitelist.js — Vérification whitelist IRP côté frontend
   ══════════════════════════════════════════════════════════════════════

   Vérifie si l'utilisateur connecté (via /link) est dans la whitelist
   IRP (irp_whitelist/{discord_id} dans Firestore/D1).

   Expose :
     window._irpWhitelistCheck  → Promise<boolean>
     window._irpWhitelisted     → boolean (une fois résolu, false par défaut)

   Usage : attendre _irpWhitelistCheck avant d'afficher les liens IRP.
   ══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var API_BASE = window.__D1_API_BASE__ || 'https://jahartarp-api.jahartarp.workers.dev/api';
  var JWT_KEY  = 'd1_jwt';

  /* ── Helpers session ─────────────────────────────────────────────── */

  function getJWT() {
    return localStorage.getItem(JWT_KEY) || '';
  }

  function getDiscordId() {
    /* hub_session (hub-irp-core.js) : { id, username, avatar, _exp } */
    var keys = ['hub_session', 'gacha_session'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var s = JSON.parse(raw);
        if (s._exp && Date.now() > s._exp) continue;
        if (s.id)  return String(s.id);
        if (s.discord_id) return String(s.discord_id);
      } catch (_) {}
    }
    /* Fallback : décoder le JWT manuellement (payload base64) */
    var jwt = getJWT();
    if (jwt) {
      try {
        var parts  = jwt.split('.');
        var pad    = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        var json   = atob(pad + '==='.slice((pad.length + 3) % 4));
        var pl     = JSON.parse(json);
        if (pl.discord_id) return String(pl.discord_id);
        if (pl.sub)        return String(pl.sub);
      } catch (_) {}
    }
    return null;
  }

  /* ── Check principal ─────────────────────────────────────────────── */

  window._irpWhitelisted = false;

  window._irpWhitelistCheck = new Promise(function (resolve) {
    var jwt        = getJWT();
    var discordId  = getDiscordId();

    /* Pas de session → non whitelisté */
    if (!jwt || !discordId) {
      return resolve(false);
    }

    /* Appel worker : GET /api/docs/irp_whitelist/{discord_id} */
    fetch(API_BASE + '/docs/irp_whitelist/' + encodeURIComponent(discordId), {
      method:  'GET',
      headers: { 'Authorization': 'Bearer ' + jwt },
    })
      .then(function (r) {
        if (r.status === 304) return { active: true }; /* cache hit */
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (doc) {
        /* Le doc existe et active !== false → autorisé */
        var ok = !!(doc && doc.active !== false);
        window._irpWhitelisted = ok;
        resolve(ok);
      })
      .catch(function () {
        window._irpWhitelisted = false;
        resolve(false);
      });
  });

  /* ── Événement pratique pour les autres scripts ──────────────────── */
  window._irpWhitelistCheck.then(function (ok) {
    document.dispatchEvent(new CustomEvent('irp:whitelist', { detail: { ok: ok } }));
  });

})();
