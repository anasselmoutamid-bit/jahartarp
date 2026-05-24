/* ═══════════════════════════════════════════════════════════════════════
   messagerie.js — Protocole de messagerie Nexus (per-personnage)
   v2 — refonte 2026-05-21

   Modèle :
   • SESSION joueur (hub_session/gacha_session) → UID = discord_id
   • PERSO ACTIF (CURRENT_CHAR_ID) = perso sous lequel TOUTES les actions
     s'exécutent : envoi message, envoi argent (economy/{UID}_{charId}),
     envoi item (inventories/{UID}_{charId}).
   • AMITIÉS = liens PERSO ↔ PERSO (pas joueur ↔ joueur).
     Doc id = sorted([charA, charB]).join('__')
   • DEMANDES = friend_requests envoyées entre joueurs, choix du perso
     côté envoyeur ET côté receveur.

   Collections D1 (cf. worker/src/rules.js) :
     friend_requests, friendships, messages

   Auto-purge : cron Worker quotidien (cf. worker/src/cron.js) supprime les
   messages où important !== true ET read_at < now - 7j.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Sélecteurs raccourcis ── */
  var $  = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return Array.from((p || document).querySelectorAll(s)); };

  /* ── Constantes ── */
  var LS_ACTING_CHAR = 'mz_acting_char';
  var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  /* ── État global ── */
  var SESS = null;
  var UID = null;
  var DB = null;
  var MY_CHARS = [];               // [{id, firstname, lastname, photo, race, level, ...}]
  var CURRENT_CHAR_ID = null;      // perso actif (acting char)
  var CURRENT_CHAR = null;         // object du perso actif
  var FRIENDSHIPS = [];            // friendships impliquant CURRENT_CHAR_ID
  var PENDING_INCOMING = [];       // friend_requests vers UID, status=pending
  var PENDING_TAB_AUTO_SWITCHED = false; // évite re-bascule en boucle
  var ACTIVE_PEER = null;          // {friendshipId, char_id, player_id, name, avatar}
  var MESSAGES = [];               // messages de la conv ouverte
  var ITEMS = [];                  // items du perso actif
  var WALLET = 0;                  // economy.personal du perso actif
  var unsubs = [];
  var convoPollId = null;
  var msgsPollId = null;
  var CURRENT_TAB = 'friends';
  var ADD_FOUND_PLAYER = null;     // résultat lookup étape 1
  var ADD_PICKED_CHAR = null;      // perso choisi étape 2

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  /* Sanity check Discord snowflake — refuse les IDs lossy (Number ≠ string,
     ou string trop courte). Force re-login pour purger toute session héritée
     d'une ancienne version du shim qui aurait perdu la précision. */
  function _isValidSnowflake(idVal){
    if (idVal == null) return false;
    if (typeof idVal === 'number') return false;
    var s = String(idVal);
    return s.length >= 17 && s.length <= 20 && /^\d+$/.test(s);
  }

  function getSess(){
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      /* Cookie fallback (survie aux purges Safari ITP / mode privé) */
      if (!raw) {
        var m = document.cookie.match(/(?:^|;\s*)jh_sess=([^;]+)/);
        if (m) {
          raw = decodeURIComponent(m[1]);
          try {
            localStorage.setItem('hub_session', raw);
            localStorage.setItem('gacha_session', raw);
          } catch (_) {}
        }
      }
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s._exp && Date.now() > s._exp) return null;
      /* Rejette si l'ID Discord est lossy (snowflake parsé en Number à une
         époque où le pipeline n'était pas string-safe). Sans ça, le worker
         compare s.discord_id (exact) à un client lossy → 403 mismatch. */
      if (!_isValidSnowflake(s.id)) {
        console.warn('[msg] Discord ID lossy ou mal formé — purge session');
        try {
          localStorage.removeItem('hub_session');
          localStorage.removeItem('gacha_session');
          document.cookie = 'jh_sess=; max-age=0; path=/; SameSite=Strict';
        } catch (_) {}
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  async function init(){
    SESS = getSess();
    if (!SESS || !SESS.id) {
      $('#mz-gate').hidden = false;
      return;
    }
    UID = String(SESS.id);
    $('#mz-app').hidden = false;

    /* Firestore via shim D1 */
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        DB = firebase.firestore();
      }
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] init firebase', e);
    }

    /* ━━ AUTH VERIFY contre la SOURCE DE VÉRITÉ (/auth/me) ━━━━━━━━━━━━━
       Le JWT côté worker contient le discord_id EXACT (str-preserved).
       Si localStorage.id est lossy ("769...100" au lieu de "...131"), notre
       _isValidSnowflake() ne peut pas le détecter (string 18 chars). On
       demande au worker le vrai discord_id via /auth/me et on remplace
       UID. Subtilité : onAuthStateChanged callback est appelé 2× — d'abord
       avec null (avant bootstrap), puis avec le user post-fetch. On attend
       le 2e (ou 4s max). */
    try {
      var authClient = firebase.auth();
      await new Promise(function (resolve) {
        var unsub = null;
        var resolved = false;
        var done = function () {
          if (resolved) return;
          resolved = true;
          if (unsub) { try { unsub(); } catch (_) {} unsub = null; }
          resolve();
        };
        unsub = authClient.onAuthStateChanged(function (u) {
          if (u && u.discord_id) {
            /* User connu — on peut corriger l'UID local et finir */
            var trueUid = String(u.discord_id);
            if (trueUid !== UID) {
              console.warn('[msg] UID localStorage diverge du JWT — correction :', UID, '→', trueUid);
              UID = trueUid;
              try {
                SESS.id = trueUid;
                var json = JSON.stringify(SESS);
                localStorage.setItem('hub_session', json);
                localStorage.setItem('gacha_session', json);
                document.cookie = 'jh_sess=' + encodeURIComponent(json) + '; max-age=' + (7*24*60*60) + '; path=/; SameSite=Strict; Secure';
              } catch (_) {}
            }
            window.UID = UID;
            done();
          }
          /* Si u === null, on attend le 2e callback ou le timeout */
        });
        /* Timeout 4s : si /auth/me ne répond toujours pas, on continue
           avec l'UID localStorage (la règle worker fera le job). */
        setTimeout(done, 4000);
      });
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] auth verify failed', e);
    }

    bindUI();

    /* Charge persos du joueur, puis tout le reste */
    try {
      await loadMyChars();
      if (!MY_CHARS.length) {
        toast('Aucun personnage trouvé');
        $('#mz-me-name').textContent = SESS.username || '—';
        $('#mz-me-meta').textContent = '// AUCUN PERSO';
        return;
      }
      var initialCharId = pickInitialChar();
      setCurrentChar(initialCharId);
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] init load', e);
      toast('Erreur de chargement');
    }
  }

  /* ═══════════════════════════════════════════════════════
     PERSONNAGES DU JOUEUR
     ═══════════════════════════════════════════════════════ */
  async function loadMyChars(){
    if (!DB) { MY_CHARS = []; return; }
    var snap = await DB.collection('characters').where('user_id', '==', UID).get();
    MY_CHARS = snap.docs.map(function (d) {
      var data = d.data() || {};
      data._id = d.id;
      return data;
    });
    /* Tri : prénom ASC, puis nom */
    MY_CHARS.sort(function (a, b) {
      return formatCharName(a).localeCompare(formatCharName(b));
    });
  }

  function pickInitialChar(){
    /* 1. localStorage (préf utilisateur) */
    var saved = localStorage.getItem(LS_ACTING_CHAR);
    if (saved && MY_CHARS.find(function (c) { return c._id === saved; })) return saved;
    /* 2. active_characters/{UID}.character_id (cohérent avec le hub) */
    /* Cette lookup est async donc on prend le 1er perso par défaut et on tente d'override après. */
    /* Pour rester simple : on prend le premier. */
    return MY_CHARS[0]._id;
  }

  async function tryUseActiveChar(){
    /* Best-effort : si pas de localStorage, on essaie active_characters */
    if (localStorage.getItem(LS_ACTING_CHAR)) return;
    if (!DB) return;
    try {
      var snap = await DB.collection('active_characters').doc(UID).get();
      if (snap && snap.exists) {
        var d = snap.data() || {};
        var cid = d.character_id;
        if (cid && MY_CHARS.find(function (c) { return c._id === cid; }) && cid !== CURRENT_CHAR_ID) {
          setCurrentChar(cid);
        }
      }
    } catch (_) {}
  }

  function setCurrentChar(charId){
    if (!charId) return;
    var c = MY_CHARS.find(function (x) { return x._id === charId; });
    if (!c) return;
    CURRENT_CHAR_ID = charId;
    CURRENT_CHAR = c;
    localStorage.setItem(LS_ACTING_CHAR, charId);

    /* Reset UI */
    closeConversation();
    FRIENDSHIPS = []; PENDING_INCOMING = []; MESSAGES = []; ITEMS = []; WALLET = 0;

    /* Header */
    renderActingChar();
    closeCharPicker();

    /* Re-load les flux */
    cleanupSubs();
    loadFriendships();
    loadFriendRequests();
    loadWallet();

    /* Sync best-effort avec active_characters au 1er chargement */
    tryUseActiveChar();
  }

  function renderActingChar(){
    var c = CURRENT_CHAR;
    var av = $('#mz-me-avatar');
    var nm = $('#mz-me-name');
    var mt = $('#mz-me-meta');
    if (!c) {
      nm.textContent = '—'; mt.textContent = '// CHOISIR'; av.style.backgroundImage = ''; av.textContent = '⬢';
      return;
    }
    nm.textContent = formatCharName(c);
    mt.textContent = '// LV ' + (c.level || 0) + ' · ' + charRace(c).toUpperCase();
    var photo = charPhoto(c);
    if (photo) { av.style.backgroundImage = 'url(' + photo + ')'; av.textContent = ''; }
    else { av.style.backgroundImage = ''; av.textContent = charInitial(c); }
  }

  function formatCharName(c){
    if (!c) return '—';
    /* Schema characters (snake_case côté D1) avec fallback fiches (camelCase) */
    var fn = (c.first_name || c.firstname || '').trim();
    var ln = (c.last_name  || c.lastname  || '').trim();
    return (fn + ' ' + ln).trim() || c._id;
  }
  function charPhoto(c){
    if (!c) return '';
    return c.profile_image || c.photo || c.photoUrl || '';
  }
  function charRace(c){
    if (!c) return '—';
    return c.race_category || c.race || '—';
  }
  function charInitial(c){
    if (!c) return '?';
    var fn = c.first_name || c.firstname || '';
    return (fn.charAt(0) || '?').toUpperCase();
  }

  function renderCharPicker(){
    var list = $('#mz-char-pop-list');
    if (!MY_CHARS.length) { list.innerHTML = '<div class="mz-empty">Aucun personnage</div>'; return; }
    list.innerHTML = MY_CHARS.map(function (c) {
      var active = c._id === CURRENT_CHAR_ID ? ' active' : '';
      var photo = charPhoto(c);
      var bg = photo ? ' style="background-image:url(' + esc(photo) + ')"' : '';
      return '<button class="mz-char-pop-item' + active + '" type="button" data-id="' + esc(c._id) + '">' +
        '<div class="mz-char-pop-av"' + bg + '>' + (photo ? '' : charInitial(c)) + '</div>' +
        '<div class="mz-char-pop-body">' +
          '<div class="mz-char-pop-name">' + esc(formatCharName(c)) + '</div>' +
          '<div class="mz-char-pop-meta">LV ' + (c.level || 0) + ' · ' + esc(charRace(c)) + '</div>' +
        '</div>' +
      '</button>';
    }).join('');
    $$('.mz-char-pop-item', list).forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-id');
        if (id !== CURRENT_CHAR_ID) setCurrentChar(id);
        else closeCharPicker();
      });
    });
  }

  function openCharPicker(){
    renderCharPicker();
    $('#mz-char-pop').hidden = false;
    $('#mz-char-picker-btn').classList.add('is-open');
  }
  function closeCharPicker(){
    $('#mz-char-pop').hidden = true;
    var btn = $('#mz-char-picker-btn');
    if (btn) btn.classList.remove('is-open');
  }

  /* ═══════════════════════════════════════════════════════
     UI BINDING
     ═══════════════════════════════════════════════════════ */
  function bindUI(){
    /* Sélecteur perso */
    $('#mz-char-picker-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      if ($('#mz-char-pop').hidden) openCharPicker(); else closeCharPicker();
    });
    document.addEventListener('click', function (e) {
      if (!$('#mz-char-pop').hidden && !$('#mz-char-pop').contains(e.target) && e.target !== $('#mz-char-picker-btn')) {
        closeCharPicker();
      }
    });

    /* Tabs */
    $$('.mz-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        switchToTab(b.getAttribute('data-tab'));
      });
    });
    /* Banner cliquable "demandes en attente" — bascule sur l'onglet */
    var banner = $('#mz-pending-banner');
    if (banner) banner.addEventListener('click', function () { switchToTab('pending'); });

    /* Search */
    $('#mz-search').addEventListener('input', function (e) {
      renderFriendsList(e.target.value.trim().toLowerCase());
    });

    /* Add friend — flux 2 étapes */
    $('#mz-add-friend-btn').addEventListener('click', openAddFriendModal);
    $('#mz-add-next').addEventListener('click', addFriendStep1Next);
    $('#mz-add-back').addEventListener('click', function () { setAddStep(1); });
    $('#mz-add-confirm').addEventListener('click', confirmFriendRequest);

    /* Accept friend (modal char picker) */
    $('#mz-accept-confirm').addEventListener('click', confirmAcceptFriend);

    /* Chat actions */
    $('#mz-send-money-btn').addEventListener('click', openMoneyModal);
    $('#mz-money-confirm').addEventListener('click', confirmSendMoney);
    $('#mz-send-item-btn').addEventListener('click', openItemModal);
    $('#mz-item-confirm').addEventListener('click', confirmSendItem);
    $('#mz-remove-friend-btn').addEventListener('click', removeFriendCurrent);

    /* Compose */
    var input = $('#mz-compose-input');
    $('#mz-compose-send').addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    /* Attach menu */
    var attBtn = $('#mz-compose-attach');
    var attMenu = $('#mz-attach-menu');
    attBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = attMenu.hidden;
      attMenu.hidden = !open;
      attBtn.classList.toggle('is-open', open);
    });
    document.addEventListener('click', function (e) {
      if (!attMenu.hidden && !attMenu.contains(e.target) && e.target !== attBtn) {
        attMenu.hidden = true; attBtn.classList.remove('is-open');
      }
    });
    $('#mz-attach-money').addEventListener('click', function () {
      attMenu.hidden = true; attBtn.classList.remove('is-open'); openMoneyModal();
    });
    $('#mz-attach-item').addEventListener('click', function () {
      attMenu.hidden = true; attBtn.classList.remove('is-open'); openItemModal();
    });

    /* Modals close */
    $$('.mz-modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        var t = e.target;
        if (t && (t.dataset.close !== undefined || t.classList.contains('mz-modal-bg') || t.classList.contains('mz-modal-close'))) {
          m.hidden = true;
        }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        $$('.mz-modal').forEach(function (m) { m.hidden = true; });
        closeCtx(); closeCharPicker();
      }
    });

    /* Context menu — clic-droit / long-press sur message */
    $('#mz-ctx-important').addEventListener('click', ctxToggleImportant);
    $('#mz-ctx-delete').addEventListener('click', ctxDeleteMessage);
    document.addEventListener('click', function (e) {
      if (!$('#mz-ctx').hidden && !$('#mz-ctx').contains(e.target)) closeCtx();
    });
    /* Empêche le menu natif sur les messages */
    $('#mz-chat-feed').addEventListener('contextmenu', function (e) {
      var msg = e.target.closest('.mz-msg');
      if (msg) { e.preventDefault(); openCtx(msg, e.clientX, e.clientY); }
    });
    /* Long-press tactile */
    var lpTimer = null;
    $('#mz-chat-feed').addEventListener('touchstart', function (e) {
      var msg = e.target.closest('.mz-msg');
      if (!msg) return;
      var t = e.touches[0];
      lpTimer = setTimeout(function () {
        openCtx(msg, t.clientX, t.clientY);
      }, 450);
    });
    var clearLp = function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    $('#mz-chat-feed').addEventListener('touchend', clearLp);
    $('#mz-chat-feed').addEventListener('touchmove', clearLp);
  }

  /* ═══════════════════════════════════════════════════════
     FRIENDSHIPS — chargement filtré par CURRENT_CHAR_ID
     ═══════════════════════════════════════════════════════ */
  function loadFriendships(){
    if (!DB || !CURRENT_CHAR_ID) return;
    /* Requêtes 'OR' impossibles dans Firestore-like : 2 onSnapshot, on merge. */
    var combined = {};
    function digest(){
      FRIENDSHIPS = Object.values(combined);
      FRIENDSHIPS.sort(function (a, b) { return (b.last_at || 0) - (a.last_at || 0); });
      renderFriendsList();
    }
    try {
      var u1 = DB.collection('friendships').where('char_a', '==', CURRENT_CHAR_ID)
        .onSnapshot(function (snap) {
          snap.docs.forEach(function (d) { combined[d.id] = Object.assign({}, d.data(), { _id: d.id }); });
          digest();
        }, function (e) { window._dbg && window._dbg.error('[MSG] friendships A', e); });
      var u2 = DB.collection('friendships').where('char_b', '==', CURRENT_CHAR_ID)
        .onSnapshot(function (snap) {
          snap.docs.forEach(function (d) { combined[d.id] = Object.assign({}, d.data(), { _id: d.id }); });
          digest();
        }, function (e) { window._dbg && window._dbg.error('[MSG] friendships B', e); });
      unsubs.push(u1); unsubs.push(u2);
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] loadFriendships', e);
    }
  }

  function loadFriendRequests(){
    if (!DB) return;
    try {
      var u = DB.collection('friend_requests')
        .where('to_player_id', '==', UID)
        .onSnapshot(function (snap) {
          PENDING_INCOMING = snap.docs
            .map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); })
            .filter(function (r) { return r.status === 'pending'; });
          renderPendingList();
        }, function (e) { window._dbg && window._dbg.error('[MSG] requests', e); });
      unsubs.push(u);
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] loadFriendRequests', e);
    }
  }

  /* ═══════════════════════════════════════════════════════
     RENDER LISTS
     ═══════════════════════════════════════════════════════ */
  function peerOf(f){
    /* Retourne les champs côté "l'autre perso" dans une friendship. */
    var isA = f.char_a === CURRENT_CHAR_ID;
    var peerCharId = isA ? f.char_b : f.char_a;
    var peerPlayerId = isA ? f.player_b : f.player_a;
    return {
      friendshipId: f._id,
      char_id: peerCharId,
      player_id: peerPlayerId,
      name: f['name_' + peerCharId] || ('Perso ' + (peerCharId || '').slice(0, 6)),
      avatar: f['avatar_' + peerCharId] || '',
      last_message: f.last_message || '',
      last_at: f.last_at || 0,
      unread: f['unread_' + CURRENT_CHAR_ID] || 0,
    };
  }

  function renderFriendsList(filterQ){
    var list = $('#mz-friends-list');
    var entries = FRIENDSHIPS.map(peerOf);
    $('#mz-c-friends').textContent = String(entries.length);
    var visible = filterQ ? entries.filter(function (e) {
      return (e.name || '').toLowerCase().indexOf(filterQ) >= 0;
    }) : entries;
    if (!visible.length) {
      list.innerHTML = '<div class="mz-empty">Aucun contact pour l\'instant.<br>Ajoute un ami via le <strong>+</strong>.</div>';
      return;
    }
    list.innerHTML = visible.map(contactRow).join('');
    $$('.mz-contact', list).forEach(function (el) {
      el.addEventListener('click', function () {
        var fid = el.getAttribute('data-fid');
        var entry = entries.find(function (x) { return x.friendshipId === fid; });
        if (entry) openConversation(entry);
      });
    });
  }

  function contactRow(e){
    var initial = (e.name || '?').charAt(0).toUpperCase();
    var avHTML = e.avatar
      ? '<div class="mz-contact-avatar" style="background-image:url(' + esc(e.avatar) + ')"></div>'
      : '<div class="mz-contact-avatar">' + initial + '</div>';
    var unreadBadge = e.unread ? '<span class="mz-unread">' + e.unread + '</span>' : '';
    var when = e.last_at ? formatRelative(e.last_at) : '';
    return '<div class="mz-contact" data-fid="' + esc(e.friendshipId) + '">' +
        avHTML +
        '<div class="mz-contact-body">' +
          '<div class="mz-contact-name">' + esc(e.name) + '</div>' +
          '<div class="mz-contact-last">' + esc(e.last_message || '— Pas de message —') + '</div>' +
        '</div>' +
        '<div class="mz-contact-right">' +
          '<div class="mz-contact-meta">' + when + '</div>' +
          unreadBadge +
        '</div>' +
      '</div>';
  }

  /* Switch d'onglet utilitaire (utilisé par les boutons + le banner). */
  function switchToTab(tab) {
    if (!tab || CURRENT_TAB === tab) return;
    CURRENT_TAB = tab;
    $$('.mz-tab').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-tab') === tab);
    });
    var fl = $('#mz-friends-list'); if (fl) fl.hidden = (tab !== 'friends');
    var pl = $('#mz-pending-list'); if (pl) pl.hidden = (tab !== 'pending');
  }

  function renderPendingList(){
    var list = $('#mz-pending-list');
    var count = PENDING_INCOMING.length;
    $('#mz-c-pending').textContent = String(count);

    /* UX — Saillance forte quand il y a des demandes pending :
       1. Classe .has-pending sur le tab "Demandes" (pulse + badge rouge)
       2. Banner cliquable au-dessus de la liste (bascule sur l'onglet) */
    var tabBtn = document.querySelector('.mz-tab[data-tab="pending"]');
    if (tabBtn) tabBtn.classList.toggle('has-pending', count > 0);

    var banner = $('#mz-pending-banner');
    if (banner) {
      banner.hidden = (count === 0);
      if (count > 0) {
        $('#mz-pending-banner-count').textContent = String(count);
        $('#mz-pending-banner-label').textContent = count > 1
          ? 'demandes d\'ami en attente — tape ici pour répondre'
          : 'demande d\'ami en attente — tape ici pour répondre';
        /* Auto-switch sur Demandes au premier load si on a 0 amis +
           des pending (= forcément c'est ce que l'user voulait voir) */
        if (FRIENDSHIPS.length === 0 && CURRENT_TAB !== 'pending' && !PENDING_TAB_AUTO_SWITCHED) {
          PENDING_TAB_AUTO_SWITCHED = true;
          switchToTab('pending');
        }
      }
    }
    if (!count) {
      list.innerHTML = '<div class="mz-empty">Aucune demande en attente.</div>';
      return;
    }
    list.innerHTML = PENDING_INCOMING.map(function (r) {
      var fromName = r.from_char_name || 'Perso ' + (r.from_char_id || '').slice(0, 6);
      var fromPlayerName = r.from_player_name || ('@' + (r.from_player_id || '?').slice(0, 8));
      var initial = (fromName || '?').charAt(0).toUpperCase();
      var avHTML = r.from_char_avatar
        ? '<div class="mz-contact-avatar" style="background-image:url(' + esc(r.from_char_avatar) + ')"></div>'
        : '<div class="mz-contact-avatar">' + initial + '</div>';
      return '<div class="mz-pending-item" data-id="' + esc(r._id) + '">' +
        avHTML +
        '<div class="mz-contact-body">' +
          '<div class="mz-contact-name">' + esc(fromName) + '</div>' +
          '<div class="mz-contact-last">' + esc(fromPlayerName) + ' — veut être ton contact</div>' +
        '</div>' +
        '<div class="mz-pending-actions">' +
          '<button class="mz-accept">Accepter…</button>' +
          '<button class="mz-reject">Refuser</button>' +
        '</div>' +
      '</div>';
    }).join('');
    $$('.mz-pending-item', list).forEach(function (el) {
      var rid = el.getAttribute('data-id');
      el.querySelector('.mz-accept').addEventListener('click', function () { openAcceptModal(rid); });
      el.querySelector('.mz-reject').addEventListener('click', function () { rejectFriendRequest(rid); });
    });
  }

  /* ═══════════════════════════════════════════════════════
     CONVERSATION
     ═══════════════════════════════════════════════════════ */
  function openConversation(peer){
    ACTIVE_PEER = peer;

    $$('.mz-contact').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-fid') === peer.friendshipId);
    });

    $('#mz-chat-empty').hidden = true;
    $('#mz-chat-pane').hidden = false;
    $('#mz-peer-name').textContent = peer.name;
    $('#mz-peer-status').textContent = '// ' + (peer.player_id ? '@' + peer.player_id.slice(0, 8) : 'PERSO');

    var initial = (peer.name || '?').charAt(0).toUpperCase();
    var pa = $('#mz-peer-avatar');
    if (peer.avatar) { pa.style.backgroundImage = 'url(' + peer.avatar + ')'; pa.textContent = ''; }
    else { pa.style.backgroundImage = ''; pa.textContent = initial; }

    var feed = $('#mz-chat-feed');
    feed.innerHTML = '<div class="mz-empty">Chargement des messages…</div>';

    closeMsgsSub();
    if (!DB) { feed.innerHTML = '<div class="mz-empty">Hors-ligne.</div>'; return; }

    try {
      var u = DB.collection('messages')
        .where('friendship_id', '==', peer.friendshipId)
        .onSnapshot(function (snap) {
          MESSAGES = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
          MESSAGES.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
          renderMessages();
          markIncomingAsRead();
          /* Reset unread badge côté friendship pour mon perso */
          var fRef = DB.collection('friendships').doc(peer.friendshipId);
          var patch = {}; patch['unread_' + CURRENT_CHAR_ID] = 0;
          fRef.update(patch).catch(function () {});
        }, function (e) { window._dbg && window._dbg.error('[MSG] msgs', e); });
      msgsPollId = u;
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] open', e);
    }
  }

  function closeConversation(){
    closeMsgsSub();
    ACTIVE_PEER = null;
    MESSAGES = [];
    $('#mz-chat-pane').hidden = true;
    $('#mz-chat-empty').hidden = false;
  }

  function closeMsgsSub(){
    if (msgsPollId) { try { msgsPollId(); } catch (_) {} msgsPollId = null; }
  }

  function renderMessages(){
    var feed = $('#mz-chat-feed');
    if (!MESSAGES.length) {
      feed.innerHTML = '<div class="mz-empty">Pas encore de messages. Brise le silence.</div>';
      return;
    }
    feed.innerHTML = MESSAGES.map(function (m) {
      var mine = m.from_char_id === CURRENT_CHAR_ID;
      var imp = m.important === true || m.important === 1;
      var impHTML = imp ? '<span class="mz-msg-star" title="Important">★</span>' : '';
      var attrs = ' data-mid="' + esc(m._id) + '"' + ' data-mine="' + (mine ? '1' : '0') + '"' + ' data-imp="' + (imp ? '1' : '0') + '"';
      if (m.kind === 'transfer_money') {
        var lblM = mine ? 'Tu as envoyé' : 'Tu as reçu';
        return '<div class="mz-msg transfer ' + (mine ? 'mz-msg-me' : 'mz-msg-them') + (imp ? ' is-important' : '') + '"' + attrs + '>' +
          impHTML +
          '<div class="mz-transfer-icon">¤</div>' +
          '<div class="mz-transfer-label">' + lblM + ' des Kanites</div>' +
          '<div class="mz-transfer-amount">' + (m.amount || 0) + ' ¤</div>' +
          (m.note ? '<div class="mz-transfer-note">« ' + esc(m.note) + ' »</div>' : '') +
          '<span class="mz-msg-time">' + formatTime(m.at) + '</span>' +
        '</div>';
      }
      if (m.kind === 'transfer_item') {
        var lblI = mine ? 'Tu as envoyé' : 'Tu as reçu';
        return '<div class="mz-msg transfer ' + (mine ? 'mz-msg-me' : 'mz-msg-them') + (imp ? ' is-important' : '') + '"' + attrs + '>' +
          impHTML +
          '<div class="mz-transfer-icon">⛁</div>' +
          '<div class="mz-transfer-label">' + lblI + ' un item</div>' +
          '<div class="mz-transfer-amount">' + esc(m.item_name || '?') + ' ×' + (m.qty || 1) + '</div>' +
          '<span class="mz-msg-time">' + formatTime(m.at) + '</span>' +
        '</div>';
      }
      return '<div class="mz-msg ' + (mine ? 'mz-msg-me' : 'mz-msg-them') + (imp ? ' is-important' : '') + '"' + attrs + '>' +
        impHTML +
        '<span class="mz-msg-text">' + esc(m.text || '') + '</span>' +
        '<span class="mz-msg-time">' + formatTime(m.at) + '</span>' +
      '</div>';
    }).join('');
    feed.scrollTop = feed.scrollHeight;
  }

  function markIncomingAsRead(){
    /* Toutes les messages reçus (not mine) sans read_at → patch read_at = now */
    if (!DB || !MESSAGES.length) return;
    var now = Date.now();
    MESSAGES.forEach(function (m) {
      if (m.from_char_id !== CURRENT_CHAR_ID && !m.read_at) {
        DB.collection('messages').doc(m._id).update({ read_at: now }).catch(function () {});
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     ENVOI MESSAGE
     ═══════════════════════════════════════════════════════ */
  function sendMessage(){
    if (!ACTIVE_PEER || !DB) return;
    var input = $('#mz-compose-input');
    var text = (input.value || '').trim();
    if (!text) return;
    if (text.length > 2000) { toast('Message trop long (max 2000)'); return; }

    var msg = {
      friendship_id: ACTIVE_PEER.friendshipId,
      from_char_id: CURRENT_CHAR_ID,
      to_char_id: ACTIVE_PEER.char_id,
      from_player_id: UID,
      to_player_id: ACTIVE_PEER.player_id,
      text: text,
      kind: 'text',
      at: Date.now(),
      important: false,
    };
    input.value = '';
    DB.collection('messages').add(msg).then(function () {
      /* MAJ aperçu friendship + unread du destinataire */
      var fRef = DB.collection('friendships').doc(ACTIVE_PEER.friendshipId);
      var patch = { last_message: msg.text.slice(0, 120), last_at: msg.at };
      patch['unread_' + ACTIVE_PEER.char_id] = (firebase.firestore.FieldValue && firebase.firestore.FieldValue.increment)
        ? firebase.firestore.FieldValue.increment(1) : 1;
      fRef.update(patch).catch(function () {});
    }).catch(function (e) {
      window._dbg && window._dbg.error('[MSG] sendMessage', e);
      toast('Échec de l\'envoi'); input.value = text;
    });
  }

  /* ═══════════════════════════════════════════════════════
     CONTEXT MENU (clic-droit / long-press)
     ═══════════════════════════════════════════════════════ */
  var CTX_MSG_ID = null;
  function openCtx(msgEl, x, y){
    CTX_MSG_ID = msgEl.getAttribute('data-mid');
    var mine = msgEl.getAttribute('data-mine') === '1';
    var imp  = msgEl.getAttribute('data-imp') === '1';
    $('#mz-ctx-important-label').textContent = imp ? 'Retirer important' : 'Marquer important';
    $('#mz-ctx-delete').hidden = !mine; /* on supprime que ses propres messages */
    var ctx = $('#mz-ctx');
    ctx.hidden = false;
    /* Clamp dans la viewport */
    var rect = ctx.getBoundingClientRect();
    var maxX = window.innerWidth - 220;
    var maxY = window.innerHeight - 110;
    ctx.style.left = Math.min(x, maxX) + 'px';
    ctx.style.top  = Math.min(y, maxY) + 'px';
  }
  function closeCtx(){
    $('#mz-ctx').hidden = true;
    CTX_MSG_ID = null;
  }
  function ctxToggleImportant(){
    if (!CTX_MSG_ID || !DB) return;
    var m = MESSAGES.find(function (x) { return x._id === CTX_MSG_ID; });
    if (!m) { closeCtx(); return; }
    var newVal = !(m.important === true || m.important === 1);
    DB.collection('messages').doc(CTX_MSG_ID).update({ important: newVal })
      .then(function () { toast(newVal ? 'Marqué important' : 'Marque retirée'); })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
    closeCtx();
  }
  function ctxDeleteMessage(){
    if (!CTX_MSG_ID || !DB) return;
    if (!confirm('Supprimer ce message ?')) { closeCtx(); return; }
    DB.collection('messages').doc(CTX_MSG_ID).delete()
      .then(function () { toast('Message supprimé'); })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
    closeCtx();
  }

  /* ═══════════════════════════════════════════════════════
     ADD FRIEND — flux 2 étapes
     ═══════════════════════════════════════════════════════ */
  function openAddFriendModal(){
    ADD_FOUND_PLAYER = null;
    ADD_PICKED_CHAR = null;
    $('#mz-add-input').value = '';
    $('#mz-add-found').hidden = true;
    $('#mz-add-confirm').disabled = true;
    setAddStep(1);
    $('#mz-modal-add').hidden = false;
  }
  function setAddStep(n){
    $$('.mz-add-step', $('#mz-modal-add')).forEach(function (el) {
      el.hidden = String(el.getAttribute('data-step')) !== String(n);
    });
  }

  async function addFriendStep1Next(){
    var v = ($('#mz-add-input').value || '').trim();
    if (!v) { toast('Identifiant requis'); return; }
    if (!DB) { toast('Hors-ligne'); return; }
    /* Lookup player : 1) doc id direct (= discord_id) 2) where username == v */
    var found = null;
    try {
      var doc = await DB.collection('players').doc(v).get();
      if (doc && doc.exists) found = { id: doc.id, data: doc.data() || {} };
    } catch (_) {}
    if (!found) {
      try {
        var snap = await DB.collection('players').where('username', '==', v).limit(1).get();
        var d = snap.docs[0];
        if (d) found = { id: d.id, data: d.data() || {} };
      } catch (_) {}
    }
    if (!found) { toast('Joueur introuvable'); return; }
    if (found.id === UID) { toast('Tu ne peux pas t\'ajouter toi-même'); return; }

    ADD_FOUND_PLAYER = found;
    /* Affiche le résultat */
    var fn = found.data.display_name || found.data.username || ('@' + found.id.slice(0, 8));
    var av = found.data.avatar || '';
    $('#mz-add-found-name').textContent = fn;
    $('#mz-add-found-id').textContent = found.id;
    var avEl = $('#mz-add-found-avatar');
    if (av) { avEl.style.backgroundImage = 'url(' + av + ')'; avEl.textContent = ''; }
    else { avEl.style.backgroundImage = ''; avEl.textContent = (fn || '?').charAt(0).toUpperCase(); }
    $('#mz-add-found').hidden = false;

    /* Passe à l'étape 2 : choix du perso initiateur */
    renderAddCharChoices();
    setAddStep(2);
  }

  function renderAddCharChoices(){
    var list = $('#mz-add-char-list');
    if (!MY_CHARS.length) { list.innerHTML = '<div class="mz-empty">Aucun personnage</div>'; return; }
    /* Présélection : perso actif */
    ADD_PICKED_CHAR = CURRENT_CHAR_ID;
    $('#mz-add-confirm').disabled = !ADD_PICKED_CHAR;
    list.innerHTML = MY_CHARS.map(function (c) {
      var sel = c._id === ADD_PICKED_CHAR ? ' selected' : '';
      var photo = charPhoto(c);
      var bg = photo ? ' style="background-image:url(' + esc(photo) + ')"' : '';
      return '<button class="mz-char-choice' + sel + '" type="button" data-id="' + esc(c._id) + '">' +
        '<div class="mz-char-choice-av"' + bg + '>' + (photo ? '' : charInitial(c)) + '</div>' +
        '<div class="mz-char-choice-body">' +
          '<div class="mz-char-choice-name">' + esc(formatCharName(c)) + '</div>' +
          '<div class="mz-char-choice-meta">LV ' + (c.level || 0) + ' · ' + esc(charRace(c)) + '</div>' +
        '</div>' +
      '</button>';
    }).join('');
    $$('.mz-char-choice', list).forEach(function (el) {
      el.addEventListener('click', function () {
        $$('.mz-char-choice', list).forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        ADD_PICKED_CHAR = el.getAttribute('data-id');
        $('#mz-add-confirm').disabled = false;
      });
    });
  }

  async function confirmFriendRequest(){
    if (!ADD_FOUND_PLAYER || !ADD_PICKED_CHAR || !DB) return;
    var myChar = MY_CHARS.find(function (c) { return c._id === ADD_PICKED_CHAR; });
    if (!myChar) { toast('Personnage invalide'); return; }
    /* Empêche les doublons : déjà ami avec ce joueur ET ce perso ? Check léger côté client. */
    var dup = FRIENDSHIPS.find(function (f) {
      return (f.player_a === UID && f.player_b === ADD_FOUND_PLAYER.id) ||
             (f.player_b === UID && f.player_a === ADD_FOUND_PLAYER.id);
    });
    if (dup) {
      /* Soft warn — un joueur peut avoir 2 persos amis avec 2 persos du même joueur, donc on autorise mais on prévient */
      if (!confirm('Tu as déjà au moins une amitié avec ce joueur. Envoyer quand même ?')) return;
    }
    try {
      await DB.collection('friend_requests').add({
        from_char_id: myChar._id,
        from_player_id: UID,
        to_player_id: ADD_FOUND_PLAYER.id,
        status: 'pending',
        created_at: Date.now(),
        /* Champs d'affichage cachés (snapshot) — facilitent l'UI côté receveur */
        from_char_name: formatCharName(myChar),
        from_char_avatar: charPhoto(myChar),
        from_player_name: SESS.username || SESS.global_name || '',
      });
      $('#mz-modal-add').hidden = true;
      toast('Demande envoyée');
    } catch (e) {
      toast(e.message || 'Erreur d\'envoi');
    }
  }

  /* ═══════════════════════════════════════════════════════
     ACCEPT FRIEND — choix du perso côté receveur
     ═══════════════════════════════════════════════════════ */
  var ACCEPT_REQUEST_ID = null;
  var ACCEPT_PICKED_CHAR = null;
  function openAcceptModal(requestId){
    var r = PENDING_INCOMING.find(function (x) { return x._id === requestId; });
    if (!r) return;
    ACCEPT_REQUEST_ID = requestId;
    ACCEPT_PICKED_CHAR = CURRENT_CHAR_ID;
    $('#mz-accept-from-name').textContent = r.from_char_name || ('Perso ' + (r.from_char_id || '').slice(0, 6));
    $('#mz-accept-from-player').textContent = r.from_player_name || ('@' + (r.from_player_id || '?').slice(0, 8));
    renderAcceptCharChoices();
    $('#mz-modal-accept').hidden = false;
  }
  function renderAcceptCharChoices(){
    var list = $('#mz-accept-char-list');
    if (!MY_CHARS.length) { list.innerHTML = '<div class="mz-empty">Aucun personnage</div>'; return; }
    $('#mz-accept-confirm').disabled = !ACCEPT_PICKED_CHAR;
    list.innerHTML = MY_CHARS.map(function (c) {
      var sel = c._id === ACCEPT_PICKED_CHAR ? ' selected' : '';
      var photo = charPhoto(c);
      var bg = photo ? ' style="background-image:url(' + esc(photo) + ')"' : '';
      return '<button class="mz-char-choice' + sel + '" type="button" data-id="' + esc(c._id) + '">' +
        '<div class="mz-char-choice-av"' + bg + '>' + (photo ? '' : charInitial(c)) + '</div>' +
        '<div class="mz-char-choice-body">' +
          '<div class="mz-char-choice-name">' + esc(formatCharName(c)) + '</div>' +
          '<div class="mz-char-choice-meta">LV ' + (c.level || 0) + ' · ' + esc(charRace(c)) + '</div>' +
        '</div>' +
      '</button>';
    }).join('');
    $$('.mz-char-choice', list).forEach(function (el) {
      el.addEventListener('click', function () {
        $$('.mz-char-choice', list).forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        ACCEPT_PICKED_CHAR = el.getAttribute('data-id');
        $('#mz-accept-confirm').disabled = false;
      });
    });
  }

  async function confirmAcceptFriend(){
    if (!ACCEPT_REQUEST_ID || !ACCEPT_PICKED_CHAR || !DB) return;
    var r = PENDING_INCOMING.find(function (x) { return x._id === ACCEPT_REQUEST_ID; });
    if (!r) return;
    var myChar = MY_CHARS.find(function (c) { return c._id === ACCEPT_PICKED_CHAR; });
    if (!myChar) return;
    /* Création friendship perso↔perso */
    var charA = r.from_char_id; var charB = ACCEPT_PICKED_CHAR;
    var sorted = [charA, charB].sort();
    var pairId = sorted.join('__');
    var meta = {
      char_a: sorted[0], char_b: sorted[1],
      player_a: sorted[0] === charA ? r.from_player_id : UID,
      player_b: sorted[0] === charA ? UID : r.from_player_id,
      created_at: Date.now(),
      accepted_at: Date.now(),
      last_at: Date.now(),
    };
    meta['name_' + charA] = r.from_char_name || charA;
    meta['name_' + charB] = formatCharName(myChar);
    meta['avatar_' + charA] = r.from_char_avatar || '';
    meta['avatar_' + charB] = charPhoto(myChar);
    meta['unread_' + charA] = 0;
    meta['unread_' + charB] = 0;

    /* DEBUG : log exact des IDs envoyés au worker pour comparer avec le JWT
       côté worker (wrangler tail). Aide à isoler une session UID lossy ou
       autre divergence. À retirer une fois le bug 403 fix confirmé. */
    try {
      var jwtUid = (firebase.auth().currentUser || {}).discord_id || '(no current user)';
      console.log('[ACCEPT_FRIEND] pairId=', pairId);
      console.log('[ACCEPT_FRIEND] UID (local) =', UID, 'len=', String(UID).length);
      console.log('[ACCEPT_FRIEND] JWT discord_id =', jwtUid, 'len=', String(jwtUid).length);
      console.log('[ACCEPT_FRIEND] meta.player_a =', meta.player_a, 'len=', String(meta.player_a).length);
      console.log('[ACCEPT_FRIEND] meta.player_b =', meta.player_b, 'len=', String(meta.player_b).length);
      console.log('[ACCEPT_FRIEND] r.from_player_id =', r.from_player_id, 'len=', String(r.from_player_id).length);
    } catch (_) {}

    try {
      await DB.collection('friendships').doc(pairId).set(meta, { merge: true });
      await DB.collection('friend_requests').doc(ACCEPT_REQUEST_ID).delete();
      $('#mz-modal-accept').hidden = true;
      toast('Contact ajouté');
    } catch (e) {
      console.error('[ACCEPT_FRIEND] failed', e);
      toast(e.message || 'Erreur');
    }
  }

  function rejectFriendRequest(requestId){
    if (!DB) return;
    if (!confirm('Refuser cette demande ?')) return;
    DB.collection('friend_requests').doc(requestId).delete()
      .then(function () { toast('Demande refusée'); })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
  }

  function removeFriendCurrent(){
    if (!ACTIVE_PEER || !DB) return;
    if (!confirm('Retirer ' + ACTIVE_PEER.name + ' de tes contacts ?\n(Les messages associés seront supprimés)')) return;
    var fid = ACTIVE_PEER.friendshipId;
    /* Supprime tous les messages de la conversation + la friendship */
    DB.collection('messages').where('friendship_id', '==', fid).get()
      .then(function (snap) {
        var dels = snap.docs.map(function (d) { return d.ref.delete().catch(function(){}); });
        return Promise.all(dels);
      })
      .then(function () { return DB.collection('friendships').doc(fid).delete(); })
      .then(function () {
        toast('Contact retiré');
        closeConversation();
      })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
  }

  /* ═══════════════════════════════════════════════════════
     WALLET — 4 devises (bronze/silver/gold/platinum)
     economy/{UID_charId}.personal = { bronze_kanite, silver_kanite,
                                       gold_kanite, platinum_kanite }
     ═══════════════════════════════════════════════════════ */
  var CURRENCIES = ['bronze_kanite','silver_kanite','gold_kanite','platinum_kanite'];
  var CUR_LABEL  = { bronze_kanite:'Bronze', silver_kanite:'Silver',
                     gold_kanite:'Gold',     platinum_kanite:'Platinum' };
  var CUR_SHORT  = { bronze_kanite:'B', silver_kanite:'S', gold_kanite:'G', platinum_kanite:'P' };
  var WALLET_OBJ = { bronze_kanite:0, silver_kanite:0, gold_kanite:0, platinum_kanite:0 };

  function _walletShortString(p) {
    /* Compacte vers le haut puis affiche les devises non-nulles, du haut vers le bas. */
    var w = (window.JKanite && window.JKanite.autoConvertUp) ? window.JKanite.autoConvertUp(p) : p;
    var parts = [];
    for (var i = CURRENCIES.length - 1; i >= 0; i--) {
      var c = CURRENCIES[i], v = Number(w[c] || 0);
      if (v > 0) parts.push(v.toLocaleString('fr-FR') + ' ' + CUR_SHORT[c]);
    }
    return parts.length ? parts.join(' · ') : '0 B';
  }

  function loadWallet(){
    if (!DB || !CURRENT_CHAR_ID) { $('#mz-balance-kanite').textContent = '—'; return; }
    var docId = UID + '_' + CURRENT_CHAR_ID;
    var u = DB.collection('economy').doc(docId).onSnapshot(function (snap) {
      var d = (snap && snap.data && snap.data()) || {};
      var personal = (d.personal && typeof d.personal === 'object') ? d.personal : {};
      /* Normalise — tous les keys présents, valeurs numériques */
      WALLET_OBJ = {};
      CURRENCIES.forEach(function (c) {
        WALLET_OBJ[c] = Math.max(0, Math.floor(Number(personal[c] || 0)));
      });
      WALLET = WALLET_OBJ;  /* compat ancien code qui faisait `> WALLET` */
      $('#mz-balance-kanite').textContent = _walletShortString(WALLET_OBJ);
    }, function (e) { window._dbg && window._dbg.error('[MSG] wallet', e); });
    unsubs.push(u);
  }

  /* ═══════════════════════════════════════════════════════
     SEND MONEY — choix de la devise (B/S/G/P)
     ═══════════════════════════════════════════════════════ */
  function openMoneyModal(){
    if (!ACTIVE_PEER) { toast('Choisis d\'abord un contact'); return; }
    if (!CURRENT_CHAR_ID) { toast('Choisis d\'abord un perso'); return; }
    $('#mz-money-peer').textContent = ACTIVE_PEER.name;
    $('#mz-money-balance').textContent = _walletShortString(WALLET_OBJ);
    $('#mz-money-amount').value = '';
    $('#mz-money-note').value = '';

    /* Injecte un sélecteur de devise s'il n'existe pas déjà */
    var sel = document.getElementById('mz-money-currency');
    if (!sel) {
      sel = document.createElement('select');
      sel.id = 'mz-money-currency';
      sel.className = 'mz-input';
      sel.style.cssText = 'margin:8px 0; width:100%;';
      CURRENCIES.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = CUR_LABEL[c] + ' Kanite';
        sel.appendChild(opt);
      });
      /* Placer juste après le champ amount */
      var amtEl = document.getElementById('mz-money-amount');
      if (amtEl && amtEl.parentNode) amtEl.parentNode.insertBefore(sel, amtEl.nextSibling);
    }
    sel.value = 'bronze_kanite';
    $('#mz-modal-money').hidden = false;
  }
  async function confirmSendMoney(){
    var amount = parseInt($('#mz-money-amount').value, 10);
    var currency = ($('#mz-money-currency') || { value: 'bronze_kanite' }).value;
    if (!amount || amount < 1) { toast('Montant invalide'); return; }
    if (!CURRENCIES.includes(currency)) { toast('Devise invalide'); return; }
    if (!ACTIVE_PEER || !DB) return;
    var note = ($('#mz-money-note').value || '').trim().slice(0, 200);

    var myEcoId    = UID + '_' + CURRENT_CHAR_ID;
    var theirEcoId = ACTIVE_PEER.player_id + '_' + ACTIVE_PEER.char_id;
    var price = {}; price[currency] = amount;
    var K = window.JKanite;
    if (!K) { toast('Système de monnaie non chargé'); return; }

    try {
      await DB.runTransaction(function (tx) {
        return tx.get(DB.collection('economy').doc(myEcoId)).then(function (m) {
          var meD = (m.data && m.data()) || {};
          var personal = (meD.personal && typeof meD.personal === 'object') ? meD.personal : {};
          /* Débit avec conversion auto (casse silver→bronze si besoin) */
          var newMyPersonal = K.deductWithAutoConversion(personal, price);
          if (!newMyPersonal) throw new Error('Solde insuffisant');
          newMyPersonal = K.autoConvertUp(newMyPersonal);

          return tx.get(DB.collection('economy').doc(theirEcoId)).then(function (o) {
            var oD = (o.data && o.data()) || {};
            var theirPersonal = (oD.personal && typeof oD.personal === 'object') ? oD.personal : {};
            var newTheirPersonal = K.addWithAutoConvertUp(theirPersonal, currency, amount);

            tx.set(DB.collection('economy').doc(myEcoId),    { personal: newMyPersonal },    { merge: true });
            tx.set(DB.collection('economy').doc(theirEcoId), { personal: newTheirPersonal }, { merge: true });
          });
        });
      });

      var summary = amount + ' ' + CUR_SHORT[currency] + ' (' + CUR_LABEL[currency] + ')';
      await DB.collection('messages').add({
        friendship_id: ACTIVE_PEER.friendshipId,
        from_char_id: CURRENT_CHAR_ID, to_char_id: ACTIVE_PEER.char_id,
        from_player_id: UID, to_player_id: ACTIVE_PEER.player_id,
        kind: 'transfer_money',
        amount: amount, currency: currency, note: note,
        at: Date.now(), important: false,
      });
      var fRef = DB.collection('friendships').doc(ACTIVE_PEER.friendshipId);
      var patch = { last_message: '¤ ' + summary, last_at: Date.now() };
      patch['unread_' + ACTIVE_PEER.char_id] = (firebase.firestore.FieldValue && firebase.firestore.FieldValue.increment)
        ? firebase.firestore.FieldValue.increment(1) : 1;
      fRef.update(patch).catch(function () {});
      $('#mz-modal-money').hidden = true;
      toast('Transfert : ' + summary);
    } catch (e) {
      toast(e.message || 'Échec du transfert');
    }
  }

  /* ═══════════════════════════════════════════════════════
     SEND ITEM
     ═══════════════════════════════════════════════════════ */
  var SELECTED_ITEM_ID = null;
  function openItemModal(){
    if (!ACTIVE_PEER) { toast('Choisis d\'abord un contact'); return; }
    if (!CURRENT_CHAR_ID) { toast('Choisis d\'abord un perso'); return; }
    $('#mz-item-peer').textContent = ACTIVE_PEER.name;
    $('#mz-item-confirm').disabled = true;
    SELECTED_ITEM_ID = null;
    $('#mz-modal-item').hidden = false;
    loadItems();
  }
  async function loadItems(){
    var grid = $('#mz-item-grid');
    if (!DB) { grid.innerHTML = '<div class="mz-empty">Hors-ligne.</div>'; return; }
    grid.innerHTML = '<div class="mz-empty">Chargement…</div>';
    var invId = UID + '_' + CURRENT_CHAR_ID;
    try {
      var snap = await DB.collection('inventories').doc(invId).get();
      var data = (snap && snap.exists && snap.data()) || {};
      var raw = data.items || {};
      /* `items` est un objet { itemId: {name, qty, ...} } selon CLAUDE.md */
      ITEMS = Object.keys(raw).map(function (k) {
        var it = raw[k] || {};
        return Object.assign({}, it, { _id: k });
      }).filter(function (it) { return (it.qty || it.quantity || 1) > 0; });
      if (!ITEMS.length) { grid.innerHTML = '<div class="mz-empty">Inventaire vide.</div>'; return; }
      grid.innerHTML = ITEMS.map(function (it) {
        var qty = it.qty || it.quantity || 1;
        return '<div class="mz-item" data-id="' + esc(it._id) + '">' +
          '<div class="mz-item-name">' + esc(it.name || it._id) + '</div>' +
          '<div class="mz-item-qty">×' + qty + '</div>' +
        '</div>';
      }).join('');
      $$('.mz-item', grid).forEach(function (el) {
        el.addEventListener('click', function () {
          $$('.mz-item', grid).forEach(function (x) { x.classList.remove('selected'); });
          el.classList.add('selected');
          SELECTED_ITEM_ID = el.getAttribute('data-id');
          $('#mz-item-confirm').disabled = false;
        });
      });
    } catch (e) {
      grid.innerHTML = '<div class="mz-empty">Erreur de chargement.</div>';
      window._dbg && window._dbg.error('[MSG] items', e);
    }
  }
  async function confirmSendItem(){
    if (!SELECTED_ITEM_ID || !ACTIVE_PEER || !DB) return;
    var item = ITEMS.find(function (i) { return i._id === SELECTED_ITEM_ID; });
    if (!item) return;
    var qty = 1; /* TODO: support qty multiple — input à ajouter dans le modal */

    var myInvId    = UID + '_' + CURRENT_CHAR_ID;
    var theirInvId = ACTIVE_PEER.player_id + '_' + ACTIVE_PEER.char_id;
    try {
      await DB.runTransaction(function (tx) {
        return tx.get(DB.collection('inventories').doc(myInvId)).then(function (m) {
          var mD = (m.data && m.data()) || {};
          var mItems = mD.items || {};
          var mItem = mItems[SELECTED_ITEM_ID] || null;
          var mQty = Number((mItem && (mItem.qty || mItem.quantity)) || 0);
          if (mQty < qty) throw new Error('Quantité insuffisante');

          return tx.get(DB.collection('inventories').doc(theirInvId)).then(function (o) {
            var oD = (o.data && o.data()) || {};
            var oItems = oD.items || {};
            var oItem = oItems[SELECTED_ITEM_ID] || null;
            var oQty = Number((oItem && (oItem.qty || oItem.quantity)) || 0);

            /* Décrément côté moi */
            var newMItems = Object.assign({}, mItems);
            if (mQty - qty <= 0) delete newMItems[SELECTED_ITEM_ID];
            else newMItems[SELECTED_ITEM_ID] = Object.assign({}, mItem, { qty: mQty - qty });

            /* Incrément côté dest (copie le name etc. depuis l'item source) */
            var newOItems = Object.assign({}, oItems);
            var oNew = Object.assign({}, oItem || mItem, { qty: oQty + qty });
            newOItems[SELECTED_ITEM_ID] = oNew;

            tx.set(DB.collection('inventories').doc(myInvId),    { items: newMItems }, { merge: true });
            tx.set(DB.collection('inventories').doc(theirInvId), { items: newOItems }, { merge: true });
          });
        });
      });
      /* Trace */
      await DB.collection('messages').add({
        friendship_id: ACTIVE_PEER.friendshipId,
        from_char_id: CURRENT_CHAR_ID,
        to_char_id: ACTIVE_PEER.char_id,
        from_player_id: UID,
        to_player_id: ACTIVE_PEER.player_id,
        kind: 'transfer_item',
        item_id: SELECTED_ITEM_ID,
        item_name: item.name || SELECTED_ITEM_ID,
        qty: qty,
        at: Date.now(),
        important: false,
      });
      var fRef = DB.collection('friendships').doc(ACTIVE_PEER.friendshipId);
      var patch = { last_message: '⛁ ' + (item.name || 'item') + ' ×' + qty, last_at: Date.now() };
      patch['unread_' + ACTIVE_PEER.char_id] = (firebase.firestore.FieldValue && firebase.firestore.FieldValue.increment)
        ? firebase.firestore.FieldValue.increment(1) : 1;
      fRef.update(patch).catch(function () {});
      $('#mz-modal-item').hidden = true;
      toast('Item envoyé');
    } catch (e) {
      toast(e.message || 'Échec du transfert');
    }
  }

  /* ═══════════════════════════════════════════════════════
     UTILS
     ═══════════════════════════════════════════════════════ */
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function formatTime(t){
    if (!t) return '';
    var d = new Date(t);
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    var hh = String(d.getHours()).padStart(2,'0');
    var mm = String(d.getMinutes()).padStart(2,'0');
    if (sameDay) return hh + ':' + mm;
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) + ' ' + hh + ':' + mm;
  }
  function formatRelative(t){
    var diff = Date.now() - t;
    if (diff < 60000) return 'maintenant';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' h';
    if (diff < SEVEN_DAYS_MS) return Math.floor(diff / 86400000) + ' j';
    return new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
  function toast(msg){
    var el = $('#mz-toast');
    el.textContent = msg;
    el.classList.add('is-in');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('is-in'); }, 2800);
  }
  function cleanupSubs(){
    unsubs.forEach(function (u) { try { u && u(); } catch (_) {} });
    unsubs = [];
  }

  /* ── Go ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
