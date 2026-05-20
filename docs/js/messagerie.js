/* ═══════════════════════════════════════════════════════════════════════
   messagerie.js — Protocole de messagerie Nexus
   • Récupère la session partagée (hub_session/gacha_session)
   • Liste de contacts (amis acceptés + demandes en attente) via Firestore shim
   • Conversations temps réel (onSnapshot) — collections friendships/{a_b}/messages
   • Envoi de Kanites & d'items (transactions atomiques côté worker D1)
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return Array.from((p || document).querySelectorAll(s)); };

  /* ── Session partagée (même clé que hub.html) ── */
  function getSess(){
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s._exp && Date.now() > s._exp) return null;
      return s;
    } catch (e) { return null; }
  }

  var SESS = null;
  var UID = null;
  var DB = null;
  var unsubs = [];   // pour cleanup
  var CURRENT_TAB = 'friends';
  var FRIENDS = [];
  var PENDING = [];
  var ACTIVE_PEER = null; // {id, name, avatar, online}
  var ITEMS = [];          // inventaire (utilisé pour modal item)
  var WALLET = 0;

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  function init(){
    SESS = getSess();
    if (!SESS || !SESS.id) {
      $('#mz-gate').hidden = false;
      return;
    }
    UID = SESS.id;
    $('#mz-app').hidden = false;

    /* En-tête utilisateur */
    $('#mz-me-name').textContent = SESS.username || '—';
    if (SESS.avatar) {
      var av = $('#mz-me-avatar');
      av.style.backgroundImage = 'url(' + SESS.avatar + ')';
      av.textContent = '';
    }

    /* Firebase shim → Firestore */
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        DB = firebase.firestore();
      }
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] init firebase', e);
    }

    bindUI();
    loadContacts();
    loadWallet();
  }

  /* ═══════════════════════════════════════════════════════
     UI BINDING
     ═══════════════════════════════════════════════════════ */
  function bindUI(){
    /* Tabs */
    $$('.mz-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        var tab = b.getAttribute('data-tab');
        if (CURRENT_TAB === tab) return;
        CURRENT_TAB = tab;
        $$('.mz-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
        $('#mz-friends-list').hidden = (tab !== 'friends');
        $('#mz-pending-list').hidden = (tab !== 'pending');
      });
    });

    /* Search */
    $('#mz-search').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      renderFriendsList(q);
    });

    /* Add friend */
    $('#mz-add-friend-btn').addEventListener('click', function () { openModal('mz-modal-add'); });
    $('#mz-add-confirm').addEventListener('click', sendFriendRequest);

    /* Send money */
    $('#mz-send-money-btn').addEventListener('click', openMoneyModal);
    $('#mz-money-confirm').addEventListener('click', confirmSendMoney);

    /* Send item */
    $('#mz-send-item-btn').addEventListener('click', openItemModal);
    $('#mz-item-confirm').addEventListener('click', confirmSendItem);

    /* Remove friend */
    $('#mz-remove-friend-btn').addEventListener('click', removePeer);

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

    /* Modals close handlers */
    $$('.mz-modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        var t = e.target;
        if (t && (t.dataset.close !== undefined || t.classList.contains('mz-modal-bg') || t.classList.contains('mz-modal-close'))) {
          m.hidden = true;
        }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') $$('.mz-modal').forEach(function (m) { m.hidden = true; });
    });
  }

  function openModal(id){
    var m = document.getElementById(id);
    if (m) m.hidden = false;
  }

  /* ═══════════════════════════════════════════════════════
     CONTACTS LOAD (friendships)
     friendships/{pair_id} where pair_id = sorted [a,b].join('_')
     fields: a, b, status: 'pending'|'accepted', requester
     ═══════════════════════════════════════════════════════ */
  function loadContacts(){
    if (!DB) {
      /* Fallback démo si DB indisponible — affiche des contacts factices. */
      injectDemoContacts();
      return;
    }
    cleanupSubs();
    try {
      var qA = DB.collection('friendships').where('a', '==', UID);
      var qB = DB.collection('friendships').where('b', '==', UID);

      var combined = {};
      function digest(){
        FRIENDS = []; PENDING = [];
        Object.keys(combined).forEach(function (k) {
          var d = combined[k];
          var otherId = (d.a === UID) ? d.b : d.a;
          var entry = {
            id: otherId,
            pairId: k,
            name: d['name_' + otherId] || ('Joueur ' + (otherId || '').slice(0, 6)),
            avatar: d['avatar_' + otherId] || '',
            online: !!d['online_' + otherId],
            last: d.last_message || '',
            lastAt: d.last_at || 0,
            unread: d['unread_' + UID] || 0,
            requester: d.requester
          };
          if (d.status === 'accepted') FRIENDS.push(entry);
          else if (d.status === 'pending' && d.requester !== UID) PENDING.push(entry);
        });
        FRIENDS.sort(function (a, b) { return (b.lastAt || 0) - (a.lastAt || 0); });
        renderFriendsList();
        renderPendingList();
      }

      unsubs.push(qA.onSnapshot(function (snap) {
        snap.docs.forEach(function (d) { combined[d.id] = Object.assign({}, d.data(), { _id: d.id }); });
        digest();
      }, function (e) { window._dbg && window._dbg.error('[MSG] qA', e); injectDemoContacts(); }));

      unsubs.push(qB.onSnapshot(function (snap) {
        snap.docs.forEach(function (d) { combined[d.id] = Object.assign({}, d.data(), { _id: d.id }); });
        digest();
      }, function (e) { window._dbg && window._dbg.error('[MSG] qB', e); }));
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] loadContacts', e);
      injectDemoContacts();
    }
  }

  function injectDemoContacts(){
    /* Mode démo (DB indisponible) — laisse la zone vide mais ne plante pas. */
    FRIENDS = [];
    PENDING = [];
    renderFriendsList();
    renderPendingList();
  }

  function renderFriendsList(filterQ){
    var list = $('#mz-friends-list');
    $('#mz-c-friends').textContent = String(FRIENDS.length);
    var visible = filterQ ? FRIENDS.filter(function (f) {
      return (f.name || '').toLowerCase().indexOf(filterQ) >= 0;
    }) : FRIENDS;
    if (!visible.length) {
      list.innerHTML = '<div class="mz-empty">Aucun contact pour l\'instant. Ajoute un ami via le <strong>+</strong>.</div>';
      return;
    }
    list.innerHTML = visible.map(function (f) {
      return contactRow(f);
    }).join('');
    $$('.mz-contact', list).forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-id');
        var f = FRIENDS.find(function (x) { return x.id === id; });
        if (f) openConversation(f);
      });
    });
  }

  function renderPendingList(){
    var list = $('#mz-pending-list');
    $('#mz-c-pending').textContent = String(PENDING.length);
    if (!PENDING.length) {
      list.innerHTML = '<div class="mz-empty">Aucune demande en attente.</div>';
      return;
    }
    list.innerHTML = PENDING.map(function (p) {
      var initial = (p.name || '?').charAt(0).toUpperCase();
      return '<div class="mz-pending-item" data-id="' + esc(p.id) + '" data-pair="' + esc(p.pairId) + '">' +
        '<div class="mz-contact-avatar">' + (p.avatar ? '' : initial) + '</div>' +
        '<div class="mz-contact-body">' +
          '<div class="mz-contact-name">' + esc(p.name) + '</div>' +
          '<div class="mz-contact-last">Veut être ton contact</div>' +
        '</div>' +
        '<div class="mz-pending-actions">' +
          '<button class="mz-accept">Accepter</button>' +
          '<button class="mz-reject">Refuser</button>' +
        '</div>' +
      '</div>';
    }).join('');
    $$('.mz-pending-item', list).forEach(function (el) {
      var pair = el.getAttribute('data-pair');
      el.querySelector('.mz-accept').addEventListener('click', function () { acceptFriend(pair); });
      el.querySelector('.mz-reject').addEventListener('click', function () { rejectFriend(pair); });
    });
  }

  function contactRow(f){
    var initial = (f.name || '?').charAt(0).toUpperCase();
    var avHTML = f.avatar
      ? '<div class="mz-contact-avatar" style="background-image:url(' + esc(f.avatar) + ')"></div>'
      : '<div class="mz-contact-avatar">' + initial + '</div>';
    var dot = '<span class="mz-online-dot ' + (f.online ? '' : 'off') + '"></span>';
    var unreadBadge = f.unread ? '<span class="mz-unread">' + f.unread + '</span>' : '';
    var when = f.lastAt ? formatRelative(f.lastAt) : '';
    return '<div class="mz-contact" data-id="' + esc(f.id) + '">' +
        avHTML.replace('</div>', dot + '</div>') +
        '<div class="mz-contact-body">' +
          '<div class="mz-contact-name">' + esc(f.name) + '</div>' +
          '<div class="mz-contact-last">' + esc(f.last || '— Pas de message —') + '</div>' +
        '</div>' +
        '<div class="mz-contact-right" style="text-align:right">' +
          '<div class="mz-contact-meta">' + when + '</div>' +
          unreadBadge +
        '</div>' +
      '</div>';
  }

  /* ═══════════════════════════════════════════════════════
     CONVERSATION (open + onSnapshot messages)
     ═══════════════════════════════════════════════════════ */
  var convoUnsub = null;
  function openConversation(friend){
    ACTIVE_PEER = friend;

    $$('.mz-contact').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-id') === friend.id);
    });

    $('#mz-chat-empty').hidden = true;
    $('#mz-chat-pane').hidden = false;
    $('#mz-peer-name').textContent = friend.name;
    $('#mz-peer-status').textContent = friend.online ? '// EN LIGNE' : '// HORS LIGNE';
    var initial = (friend.name || '?').charAt(0).toUpperCase();
    var pa = $('#mz-peer-avatar');
    if (friend.avatar) {
      pa.style.backgroundImage = 'url(' + friend.avatar + ')';
      pa.textContent = '';
    } else {
      pa.style.backgroundImage = '';
      pa.textContent = initial;
    }

    var feed = $('#mz-chat-feed');
    feed.innerHTML = '<div class="mz-empty">Chargement des messages…</div>';

    if (convoUnsub) { try { convoUnsub(); } catch (_) {} convoUnsub = null; }
    if (!DB) { feed.innerHTML = '<div class="mz-empty">Hors-ligne. Connecte-toi pour discuter.</div>'; return; }

    try {
      var col = DB.collection('friendships').doc(friend.pairId)
        .collection('messages').orderBy('at', 'asc').limit(200);
      convoUnsub = col.onSnapshot(function (snap) {
        var msgs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
        renderMessages(msgs);
      }, function (e) {
        window._dbg && window._dbg.error('[MSG] convo', e);
        feed.innerHTML = '<div class="mz-empty">Impossible de charger les messages.</div>';
      });
    } catch (e) {
      window._dbg && window._dbg.error('[MSG] open', e);
    }
  }

  function renderMessages(msgs){
    var feed = $('#mz-chat-feed');
    if (!msgs.length) {
      feed.innerHTML = '<div class="mz-empty">Pas encore de messages. Brise le silence.</div>';
      return;
    }
    feed.innerHTML = msgs.map(function (m) {
      var mine = m.from === UID;
      if (m.kind === 'transfer_money') {
        var lbl = mine ? 'Tu as envoyé' : 'Tu as reçu';
        return '<div class="mz-msg transfer ' + (mine ? 'mz-msg-me' : 'mz-msg-them') + '">' +
          '<div class="mz-transfer-icon">¤</div>' +
          '<div class="mz-transfer-label">' + lbl + ' des Kanites</div>' +
          '<div class="mz-transfer-amount">' + (m.amount || 0) + ' ¤</div>' +
          (m.note ? '<div class="mz-transfer-note">« ' + esc(m.note) + ' »</div>' : '') +
          '<span class="mz-msg-time">' + formatTime(m.at) + '</span>' +
        '</div>';
      }
      if (m.kind === 'transfer_item') {
        var lbl2 = mine ? 'Tu as envoyé' : 'Tu as reçu';
        return '<div class="mz-msg transfer ' + (mine ? 'mz-msg-me' : 'mz-msg-them') + '">' +
          '<div class="mz-transfer-icon">⛁</div>' +
          '<div class="mz-transfer-label">' + lbl2 + ' un item</div>' +
          '<div class="mz-transfer-amount">' + esc(m.item_name || '?') + ' ×' + (m.qty || 1) + '</div>' +
          '<span class="mz-msg-time">' + formatTime(m.at) + '</span>' +
        '</div>';
      }
      return '<div class="mz-msg ' + (mine ? 'mz-msg-me' : 'mz-msg-them') + '">' +
          esc(m.text || '') +
          '<span class="mz-msg-time">' + formatTime(m.at) + '</span>' +
        '</div>';
    }).join('');
    /* Auto-scroll vers le bas. */
    feed.scrollTop = feed.scrollHeight;
  }

  /* ═══════════════════════════════════════════════════════
     SEND MESSAGE
     ═══════════════════════════════════════════════════════ */
  function sendMessage(){
    if (!ACTIVE_PEER) return;
    var input = $('#mz-compose-input');
    var text = (input.value || '').trim();
    if (!text) return;
    if (!DB) { toast('Hors-ligne — message non envoyé'); return; }

    var pairRef = DB.collection('friendships').doc(ACTIVE_PEER.pairId);
    var msgsCol = pairRef.collection('messages');
    var payload = {
      from: UID, to: ACTIVE_PEER.id,
      text: text.slice(0, 1000), kind: 'text',
      at: Date.now()
    };
    input.value = '';
    msgsCol.add(payload).catch(function (e) {
      window._dbg && window._dbg.error('[MSG] send', e);
      toast('Échec de l\'envoi'); input.value = text;
    });
    /* Update aperçu sur le doc parent. */
    try {
      pairRef.update({
        last_message: payload.text, last_at: payload.at,
        ['unread_' + ACTIVE_PEER.id]: (firebase.firestore.FieldValue && firebase.firestore.FieldValue.increment)
          ? firebase.firestore.FieldValue.increment(1) : 1
      });
    } catch (_) {}
  }

  /* ═══════════════════════════════════════════════════════
     FRIEND REQUEST / ACCEPT / REJECT
     ═══════════════════════════════════════════════════════ */
  function sendFriendRequest(){
    var v = ($('#mz-add-input').value || '').trim();
    if (!v) return;
    if (!DB) { toast('Hors-ligne'); return; }
    /* Lookup user by username or discord id (simplifié). */
    DB.collection('users').where('username', '==', v).limit(1).get().then(function (snap) {
      var target = snap.docs[0];
      if (!target) {
        /* Fallback : essaie par doc id (Discord ID brut). */
        return DB.collection('users').doc(v).get().then(function (d) {
          if (d.exists) return { id: d.id, data: d.data() };
          throw new Error('Joueur introuvable');
        });
      }
      return { id: target.id, data: target.data() };
    }).then(function (res) {
      var otherId = res.id;
      if (otherId === UID) throw new Error('Tu ne peux pas t\'ajouter toi-même.');
      var pair = [UID, otherId].sort().join('_');
      var pairRef = DB.collection('friendships').doc(pair);
      var meta = {
        a: [UID, otherId].sort()[0],
        b: [UID, otherId].sort()[1],
        status: 'pending',
        requester: UID,
        ['name_' + UID]: SESS.username || '',
        ['name_' + otherId]: res.data.username || res.data.global_name || '',
        ['avatar_' + UID]: SESS.avatar || '',
        ['avatar_' + otherId]: res.data.avatar || '',
        created_at: Date.now()
      };
      return pairRef.set(meta, { merge: true });
    }).then(function () {
      $('#mz-modal-add').hidden = true;
      $('#mz-add-input').value = '';
      toast('Demande envoyée');
    }).catch(function (e) {
      toast(e.message || 'Erreur');
    });
  }

  function acceptFriend(pairId){
    if (!DB) return;
    DB.collection('friendships').doc(pairId).update({ status: 'accepted', accepted_at: Date.now() })
      .then(function () { toast('Contact ajouté'); })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
  }
  function rejectFriend(pairId){
    if (!DB) return;
    if (!confirm('Refuser cette demande ?')) return;
    DB.collection('friendships').doc(pairId).delete()
      .then(function () { toast('Demande refusée'); })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
  }
  function removePeer(){
    if (!ACTIVE_PEER || !DB) return;
    if (!confirm('Retirer ' + ACTIVE_PEER.name + ' de tes contacts ?')) return;
    DB.collection('friendships').doc(ACTIVE_PEER.pairId).delete()
      .then(function () {
        toast('Contact retiré');
        ACTIVE_PEER = null;
        $('#mz-chat-pane').hidden = true;
        $('#mz-chat-empty').hidden = false;
      })
      .catch(function (e) { toast('Erreur : ' + (e.message || e)); });
  }

  /* ═══════════════════════════════════════════════════════
     WALLET (lecture seule pour l'UI)
     ═══════════════════════════════════════════════════════ */
  function loadWallet(){
    if (!DB) { $('#mz-balance-kanite').textContent = '—'; return; }
    /* economy/{uid_charId} — ici on prend le doc le plus récent. */
    var uref = DB.collection('players').doc(UID);
    var unsub = uref.onSnapshot(function (snap) {
      var d = snap.data() || {};
      WALLET = Number(d.kanites || d.kanite || 0) || 0;
      $('#mz-balance-kanite').textContent = WALLET.toLocaleString('fr-FR');
    }, function (e) { window._dbg && window._dbg.error('[MSG] wallet', e); });
    unsubs.push(unsub);
  }

  /* ═══════════════════════════════════════════════════════
     SEND MONEY (modal + transaction)
     ═══════════════════════════════════════════════════════ */
  function openMoneyModal(){
    if (!ACTIVE_PEER) { toast('Choisis d\'abord un contact'); return; }
    $('#mz-money-peer').textContent = ACTIVE_PEER.name;
    $('#mz-money-balance').textContent = WALLET.toLocaleString('fr-FR');
    $('#mz-money-amount').value = '';
    $('#mz-money-note').value = '';
    openModal('mz-modal-money');
  }
  function confirmSendMoney(){
    var amount = parseInt($('#mz-money-amount').value, 10);
    if (!amount || amount < 1) { toast('Montant invalide'); return; }
    if (amount > WALLET) { toast('Solde insuffisant'); return; }
    if (!ACTIVE_PEER || !DB) return;
    var note = ($('#mz-money-note').value || '').trim().slice(0, 200);

    /* Transaction client-side (le shim implémente runTransaction best-effort).
       Le backend final devra valider via Cloud Function ou worker D1. */
    DB.runTransaction(function (tx) {
      var meRef    = DB.collection('players').doc(UID);
      var otherRef = DB.collection('players').doc(ACTIVE_PEER.id);
      return tx.get(meRef).then(function (meDoc) {
        var me = meDoc.data() || {};
        var bal = Number(me.kanites || me.kanite || 0);
        if (bal < amount) throw new Error('Solde insuffisant');
        return tx.get(otherRef).then(function (other) {
          var oth = other.data() || {};
          tx.update(meRef,    { kanites: bal - amount });
          tx.update(otherRef, { kanites: (Number(oth.kanites || oth.kanite || 0)) + amount });
        });
      });
    }).then(function () {
      /* Trace dans la conversation */
      var pairRef = DB.collection('friendships').doc(ACTIVE_PEER.pairId);
      return pairRef.collection('messages').add({
        from: UID, to: ACTIVE_PEER.id,
        kind: 'transfer_money', amount: amount, note: note, at: Date.now()
      }).then(function () {
        pairRef.update({ last_message: '¤ ' + amount + ' Kanites', last_at: Date.now() }).catch(function(){});
      });
    }).then(function () {
      $('#mz-modal-money').hidden = true;
      toast('Transfert effectué : ' + amount + ' ¤');
    }).catch(function (e) {
      toast(e.message || 'Échec du transfert');
    });
  }

  /* ═══════════════════════════════════════════════════════
     SEND ITEM (modal + transfer)
     ═══════════════════════════════════════════════════════ */
  var SELECTED_ITEM_ID = null;
  function openItemModal(){
    if (!ACTIVE_PEER) { toast('Choisis d\'abord un contact'); return; }
    $('#mz-item-peer').textContent = ACTIVE_PEER.name;
    $('#mz-item-confirm').disabled = true;
    SELECTED_ITEM_ID = null;
    openModal('mz-modal-item');
    loadItems();
  }
  function loadItems(){
    var grid = $('#mz-item-grid');
    if (!DB) { grid.innerHTML = '<div class="mz-empty">Hors-ligne.</div>'; return; }
    grid.innerHTML = '<div class="mz-empty">Chargement…</div>';
    DB.collection('inventories').doc(UID).collection('items').limit(80).get().then(function (snap) {
      ITEMS = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); }).filter(function (it) {
        return (it.qty || it.quantity || 1) > 0;
      });
      if (!ITEMS.length) {
        grid.innerHTML = '<div class="mz-empty">Inventaire vide.</div>';
        return;
      }
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
    }).catch(function (e) {
      grid.innerHTML = '<div class="mz-empty">Erreur de chargement.</div>';
      window._dbg && window._dbg.error('[MSG] items', e);
    });
  }
  function confirmSendItem(){
    if (!SELECTED_ITEM_ID || !ACTIVE_PEER || !DB) return;
    var item = ITEMS.find(function (i) { return i._id === SELECTED_ITEM_ID; });
    if (!item) return;
    var qty = 1;
    var myInv    = DB.collection('inventories').doc(UID).collection('items').doc(SELECTED_ITEM_ID);
    var theirInv = DB.collection('inventories').doc(ACTIVE_PEER.id).collection('items').doc(SELECTED_ITEM_ID);
    DB.runTransaction(function (tx) {
      return tx.get(myInv).then(function (d) {
        var data = d.data() || {};
        var have = Number(data.qty || data.quantity || 0);
        if (have < qty) throw new Error('Quantité insuffisante');
        return tx.get(theirInv).then(function (od) {
          var ohave = Number((od.data() || {}).qty || (od.data() || {}).quantity || 0);
          if (have - qty <= 0) tx.delete(myInv);
          else tx.update(myInv, { qty: have - qty });
          tx.set(theirInv, Object.assign({}, data, { qty: ohave + qty }), { merge: true });
        });
      });
    }).then(function () {
      var pairRef = DB.collection('friendships').doc(ACTIVE_PEER.pairId);
      return pairRef.collection('messages').add({
        from: UID, to: ACTIVE_PEER.id,
        kind: 'transfer_item', item_id: SELECTED_ITEM_ID,
        item_name: item.name || SELECTED_ITEM_ID, qty: qty, at: Date.now()
      }).then(function () {
        pairRef.update({ last_message: '⛁ ' + (item.name || 'item') + ' ×' + qty, last_at: Date.now() }).catch(function(){});
      });
    }).then(function () {
      $('#mz-modal-item').hidden = true;
      toast('Item envoyé');
    }).catch(function (e) {
      toast(e.message || 'Échec du transfert');
    });
  }

  /* ═══════════════════════════════════════════════════════
     UTILS
     ═══════════════════════════════════════════════════════ */
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function formatTime(t){
    if (!t) return '';
    var d = new Date(t);
    var hh = String(d.getHours()).padStart(2,'0');
    var mm = String(d.getMinutes()).padStart(2,'0');
    return hh + ':' + mm;
  }
  function formatRelative(t){
    var diff = Date.now() - t;
    if (diff < 60_000) return 'maintenant';
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' min';
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' h';
    if (diff < 604_800_000) return Math.floor(diff / 86_400_000) + ' j';
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
