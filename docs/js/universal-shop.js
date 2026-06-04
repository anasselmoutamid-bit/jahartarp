/* ═══════════════════════════════════════════════════════════════════════
   universal-shop.js — Nexus Vault (page dédiée)
   Logique : session → active_characters → characters → config/items + economy
   Reproduit le comportement de hub-shops.js (loadUshop + renderUshop + buy)
   en s'exécutant en standalone, avec recherche live.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Firebase + Firestore ─── */
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",
      authDomain: "jahartarp.firebaseapp.com",
      projectId: "jahartarp",
      storageBucket: "jahartarp.firebasestorage.app",
      messagingSenderId: "834848086593",
      appId: "1:834848086593:web:c5cddc894f04feb61cc4c0"
    });
  }
  var db = firebase.firestore();

  var C = {
    ACTIVE: 'active_characters',
    CHARS:  'characters',
    INV:    'inventories',
    ECONOMY:'economy',
    CFG:    'config'
  };

  var $  = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return Array.from((p || document).querySelectorAll(s)); };

  /* Slot labels */
  var SLOTS = {
    tete: 'Tête', visage: 'Visage', cou: 'Cou', oreilles: 'Oreilles',
    torse: 'Torse', dos: 'Dos', bras: 'Bras', mains: 'Mains',
    poignets: 'Poignets', doigts: 'Doigts', jambes: 'Jambes', pieds: 'Pieds',
    armes_h: 'Armes H', armes_l: 'Armes L', special: 'Spécial'
  };
  var STAT_ICON = {
    strength: statIcon('strength'), dexterity: statIcon('dexterity'), speed: statIcon('speed'), intelligence: statIcon('intelligence'),
    mana: statIcon('mana'), resistance: statIcon('resistance'), charisma: statIcon('charisma'), aura: statIcon('aura')
  };
  var RARITY_COLOR = {
    common:'#a8a8a8', uncommon:'#40c886', rare:'#4090f0', epic:'#9b60f0',
    legendary:'#f0b040', mythic:'#e8508a', unique:'#ffdc64', artifact:'#dc5a46',
    mastercraft:'#78dcc8', signature:'#ff64c8'
  };
  var RORDER = ['common','uncommon','rare','epic','legendary','mythic','unique','artifact','mastercraft','signature'];
  var SECTIONS_BY_CAT = {
    equipment: ['equipment'], consumable: ['consumable_items'],
    food: ['food_items'], other: ['items']
  };

  /* ─── State ─── */
  var STATE = {
    sess: null,
    uid: null,
    charId: null,
    char: null,
    inv: null,
    economy: null,
    items: {},      // id → item
    cat: 'all',
    query: '',
    rarity: '',
    slot: '',
    sort: 'rarity-asc',
    maxRarityIdx: 3
  };

  /* ═══════════════════════════════════════════════════════
     SESSION
     ═══════════════════════════════════════════════════════ */
  function getSess() {
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s._exp && Date.now() > s._exp) return null;
      return s;
    } catch (e) { return null; }
  }

  /* ═══════════════════════════════════════════════════════
     LOAD
     ═══════════════════════════════════════════════════════ */
  async function init() {
    STATE.sess = getSess();
    if (!STATE.sess || !STATE.sess.id) {
      $('#us-gate').hidden = false;
      return;
    }
    STATE.uid = STATE.sess.id;
    $('#us-app').hidden = false;

    bindUI();

    try {
      var act = await db.collection(C.ACTIVE).doc(STATE.uid).get();
      if (act.exists) {
        STATE.charId = (act.data() || {}).character_id;
      }
      if (STATE.charId) {
        var ch = await db.collection(C.CHARS).doc(STATE.charId).get();
        STATE.char = ch.exists ? ch.data() : null;
      }
    } catch (e) { window._dbg && window._dbg.error('[USHOP] active', e); }

    computeRarityGate();
    await Promise.all([loadCatalog(), loadEconomy()]);
    render();
  }

  async function loadCatalog() {
    try {
      var snap = await db.collection(C.CFG).doc('items').get();
      if (!snap.exists) {
        STATE.items = {};
        return;
      }
      var d = snap.data() || {};
      STATE.items = {};
      ['items','equipment','food_items','consumable_items'].forEach(function (sec) {
        if (d[sec] && typeof d[sec] === 'object') {
          Object.entries(d[sec]).forEach(function (kv) {
            var id = kv[0], it = kv[1];
            if (!it || !it.price) return;
            if (it.rarity && String(it.rarity).toLowerCase() === 'forgeflamme') return;
            STATE.items[id] = Object.assign({}, it, { _section: sec });
          });
        }
      });
      /* Reclassement comme dans hub-shops */
      Object.entries(STATE.items).forEach(function (kv) {
        var it = kv[1];
        var t = (it.type || '').toLowerCase();
        var s = (it.slot || '').toLowerCase();
        if (t === 'equipment' || t === 'weapon' || s) it._section = 'equipment';
        else if (t === 'consumable' || t === 'usable') it._section = 'consumable_items';
        else if (t === 'food') it._section = 'food_items';
      });
    } catch (e) {
      window._dbg && window._dbg.error('[USHOP] catalog', e);
      STATE.items = {};
    }
  }

  async function loadEconomy() {
    if (!STATE.uid || !STATE.charId) { renderWallet({}); return; }
    var key = STATE.uid + '_' + STATE.charId;
    try {
      /* Live updates */
      db.collection(C.ECONOMY).doc(key).onSnapshot(function (snap) {
        var raw = snap.exists ? (snap.data().personal || {}) : {};
        STATE.economy = window.JKanite.autoConvertUp(raw);
        renderWallet(STATE.economy);
      });
    } catch (e) {
      window._dbg && window._dbg.error('[USHOP] eco', e);
      renderWallet({});
    }
  }

  /* ═══════════════════════════════════════════════════════
     LEVEL GATING (idem hub-shops)
     ═══════════════════════════════════════════════════════ */
  function levelFromXp(xp) {
    /* Approximation conservatrice — la valeur juste est dans le char doc. */
    if (!STATE.char) return 1;
    return Number(STATE.char.level || 1);
  }
  function computeRarityGate() {
    var lvl = levelFromXp(0);
    if      (lvl >= 350) STATE.maxRarityIdx = 99;
    else if (lvl >= 250) STATE.maxRarityIdx = 6;
    else if (lvl >= 100) STATE.maxRarityIdx = 5;
    else                 STATE.maxRarityIdx = 3;

    var notice = $('#us-gate-notice');
    if (!notice) return;
    if (lvl >= 350) { notice.hidden = true; return; }
    var msg = '';
    if (lvl < 100)      msg = 'Niv. <strong>' + lvl + '</strong> — Items jusqu\'à <strong>Epic</strong>. Niv. 100 pour Legendary+.';
    else if (lvl < 250) msg = 'Niv. <strong>' + lvl + '</strong> — Items jusqu\'à <strong>Mythic</strong>. Niv. 250 pour Artifacts.';
    else                msg = 'Niv. <strong>' + lvl + '</strong> — Items jusqu\'à <strong>Artifact</strong>. Niv. 350 pour tout débloquer.';
    notice.innerHTML = '<span class="gate-icon">🔒</span><span>' + msg + '</span>';
    notice.hidden = false;
  }

  /* ═══════════════════════════════════════════════════════
     UI BINDING
     ═══════════════════════════════════════════════════════ */
  function bindUI() {
    $$('.us-cat').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.cat = b.getAttribute('data-cat');
        $$('.us-cat').forEach(function (x) { x.classList.toggle('active', x === b); });
        render();
      });
    });

    var inp = $('#us-search-input');
    var clr = $('#us-search-clear');
    inp.addEventListener('input', function () {
      STATE.query = (inp.value || '').trim().toLowerCase();
      clr.hidden = !STATE.query;
      render();
    });
    clr.addEventListener('click', function () {
      inp.value = ''; STATE.query = ''; clr.hidden = true; inp.focus(); render();
    });
    /* Slash to focus */
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== inp) {
        e.preventDefault(); inp.focus();
      }
    });

    $('#us-filter-rarity').addEventListener('change', function (e) { STATE.rarity = e.target.value; render(); });
    $('#us-filter-slot').addEventListener('change', function (e) { STATE.slot = e.target.value; render(); });
    $('#us-filter-sort').addEventListener('change', function (e) { STATE.sort = e.target.value; render(); });
  }

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  function renderWallet(personal) {
    var chips = $('#us-wallet-chips');
    var order = ['platinum_kanite','gold_kanite','silver_kanite','bronze_kanite'];
    var has = order.filter(function (c) { return (personal[c] || 0) > 0; });
    if (!has.length) {
      chips.innerHTML = '<span class="us-wallet-chip empty">Solde vide</span>';
      return;
    }
    chips.innerHTML = has.map(function (c) {
      var label = c.replace('_kanite', '');
      label = label.charAt(0).toUpperCase() + label.slice(1) + ' K';
      return '<span class="us-wallet-chip">' + personal[c].toLocaleString('fr-FR') + ' ' + label + '</span>';
    }).join('');
  }

  function filterAndSort() {
    var entries = Object.entries(STATE.items);

    /* Catégorie */
    var allowed = STATE.cat === 'all' ? null : (SECTIONS_BY_CAT[STATE.cat] || null);
    if (allowed) entries = entries.filter(function (kv) { return allowed.indexOf(kv[1]._section) >= 0; });

    /* Rareté */
    if (STATE.rarity) entries = entries.filter(function (kv) { return (kv[1].rarity || '').toLowerCase() === STATE.rarity; });

    /* Slot */
    if (STATE.slot) entries = entries.filter(function (kv) { return (kv[1].slot || '').toLowerCase() === STATE.slot; });

    /* Rarity gate */
    entries = entries.filter(function (kv) {
      var r = (kv[1].rarity || 'common').toLowerCase();
      var idx = RORDER.indexOf(r);
      return idx === -1 || idx <= STATE.maxRarityIdx;
    });

    /* Search */
    if (STATE.query) {
      var q = STATE.query;
      entries = entries.filter(function (kv) {
        var it = kv[1];
        if ((it.name || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((kv[0] || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((it.slot || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((it.rarity || '').toLowerCase().indexOf(q) >= 0) return true;
        var effects = it.stat_effects || it.stats || {};
        var hit = false;
        Object.keys(effects).forEach(function (s) {
          if (s.toLowerCase().indexOf(q) >= 0) hit = true;
        });
        if (hit) return true;
        if ((it.description || '').toLowerCase().indexOf(q) >= 0) return true;
        return false;
      });
    }

    /* Sort */
    entries.sort(function (a, b) {
      var ai = RORDER.indexOf((a[1].rarity || '').toLowerCase());
      var bi = RORDER.indexOf((b[1].rarity || '').toLowerCase());
      var aPrice = window.JKanite.priceInBronze(a[1].price || {});
      var bPrice = window.JKanite.priceInBronze(b[1].price || {});
      var aName  = (a[1].name || '').toLowerCase();
      var bName  = (b[1].name || '').toLowerCase();
      switch (STATE.sort) {
        case 'rarity-desc': return bi - ai;
        case 'price-asc':   return aPrice - bPrice;
        case 'price-desc':  return bPrice - aPrice;
        case 'name-asc':    return aName.localeCompare(bName);
        case 'rarity-asc':
        default:            return ai - bi;
      }
    });

    return entries;
  }

  function render() {
    var entries = filterAndSort();
    $('#us-search-count').textContent = entries.length + ' article' + (entries.length > 1 ? 's' : '');

    var grid = $('#us-grid');
    if (!entries.length) {
      grid.innerHTML = '<div class="us-empty">Aucun article ne correspond à cette recherche.</div>';
      return;
    }

    /* Group by slot only when no filter is dominant. */
    var useGroups = (STATE.cat === 'all' || STATE.cat === 'equipment') && !STATE.query && !STATE.slot && !STATE.rarity;
    if (!useGroups) {
      grid.innerHTML = entries.map(renderCard).join('');
      return;
    }

    /* Groupage par slot, puis sections non-equipment. */
    var slotOrder = ['tete','visage','cou','oreilles','torse','dos','bras','mains','poignets','doigts','jambes','pieds','armes_h','armes_l','special'];
    var used = new Set();
    var groups = [];

    slotOrder.forEach(function (s) {
      var sub = entries.filter(function (kv) {
        var ok = !used.has(kv[0]) && kv[1]._section === 'equipment' && (kv[1].slot || '').toLowerCase() === s;
        if (ok) used.add(kv[0]);
        return ok;
      });
      if (sub.length) groups.push({ label: (SLOTS[s] || s).toUpperCase(), items: sub });
    });
    var leftovers = [
      ['ÉQUIPEMENT DIVERS', entries.filter(function (kv) { return !used.has(kv[0]) && kv[1]._section === 'equipment'; })],
      ['CONSOMMABLES',      entries.filter(function (kv) { return !used.has(kv[0]) && kv[1]._section === 'consumable_items'; })],
      ['NOURRITURE',        entries.filter(function (kv) { return !used.has(kv[0]) && kv[1]._section === 'food_items'; })],
      ['AUTRES',            entries.filter(function (kv) { return !used.has(kv[0]); })]
    ];
    leftovers.forEach(function (g) {
      if (!g[1].length) return;
      g[1].forEach(function (kv) { used.add(kv[0]); });
      groups.push({ label: g[0], items: g[1] });
    });

    grid.innerHTML = groups.map(function (g) {
      return '<div class="us-group-head">' +
        '<span class="us-group-label">' + g.label + '</span>' +
        '<span class="us-group-line"></span>' +
        '<span class="us-group-count">×' + g.items.length + '</span>' +
        '</div>' +
        g.items.map(renderCard).join('');
    }).join('');
  }

  function renderCard(kv) {
    var id = kv[0], it = kv[1];
    var rarity = (it.rarity || 'common').toLowerCase();
    var rc = RARITY_COLOR[rarity] || '#a8a8a8';

    var rawPrice = it.price || {};
    var priceStr;
    if (rawPrice.amount && rawPrice.currency) {
      priceStr = rawPrice.amount + ' ' + curLabel(rawPrice.currency);
    } else {
      priceStr = Object.entries(rawPrice)
        .filter(function (p) { return ['currency','amount','secondary_currency','secondary_amount'].indexOf(p[0]) < 0; })
        .map(function (p) { return p[1] + ' ' + curLabel(p[0]); })
        .join(' + ') || '—';
    }

    var effects = it.stat_effects || it.stats || {};
    var effStr = Object.entries(effects).slice(0, 3).map(function (kv) {
      return '+' + kv[1] + ' ' + (STAT_ICON[kv[0]] || kv[0]);
    }).join(' ');

    var slotLabel = it.slot ? (SLOTS[String(it.slot).toLowerCase()] || it.slot) : '';

    /* Bug #9 — Pour les noms longs (≥ 24 chars) on applique .is-long pour
       shrink le font-size encore plus, en plus du wrap 2 lignes CSS. */
    var nm = String(it.name || id);
    var nameCls = 'us-card-name' + (nm.length >= 24 ? ' is-long' : '');
    return '<div class="us-card" data-rarity="' + rarity + '" data-id="' + esc(id) + '">' +
      '<span class="us-card-rarity" style="color:' + rc + '">' + rarity + '</span>' +
      '<div class="us-card-top">' +
        '<div class="us-card-icon">' + (typeof getItemIcon==='function'?getItemIcon(it,32):(it.emoji||'📦')) + '</div>' +
        '<div class="us-card-titles">' +
          '<div class="' + nameCls + '" title="' + esc(nm) + '" style="color:' + rc + '">' + esc(nm) + '</div>' +
          (slotLabel ? '<div class="us-card-slot">' + esc(slotLabel) + '</div>' : '') +
        '</div>' +
      '</div>' +
      (effStr ? '<div class="us-card-effects">' + effStr + '</div>' : '') +
      '<div class="us-card-price">' + priceStr + '</div>' +
      '<button class="us-card-buy" type="button" data-buy="' + esc(id) + '">' +
        '<span>Acheter</span><span>⛬</span>' +
      '</button>' +
    '</div>';
  }

  /* Buy delegation */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-buy]');
    if (!btn) return;
    var id = btn.getAttribute('data-buy');
    buyItem(id, btn);
  });

  async function buyItem(itemId, btn) {
    if (!STATE.uid || !STATE.charId) { toast('Personnage actif introuvable', true); return; }
    var it = STATE.items[itemId];
    if (!it) return;
    btn.disabled = true;
    var rawPrice = it.price || {};
    var price = {};
    if (rawPrice.amount && rawPrice.currency) price[rawPrice.currency] = rawPrice.amount;
    else Object.entries(rawPrice).forEach(function (p) {
      if (['currency','amount','secondary_currency','secondary_amount'].indexOf(p[0]) < 0) price[p[0]] = p[1];
    });
    var key = STATE.uid + '_' + STATE.charId;
    var ecoRef = db.collection(C.ECONOMY).doc(key);
    var invRef = db.collection(C.INV).doc(key);
    var charRef = db.collection('characters').doc(String(STATE.charId));
    var _axDiscount = 0;
    try {
      await db.runTransaction(async function (tx) {
        var econ = await tx.get(ecoRef);
        var inv  = await tx.get(invRef);
        var charSnap = await tx.get(charRef);
        /* ── Axiome shop discount (Orateur / Manipulateur) ── */
        var charData = charSnap.exists ? (charSnap.data() || {}) : {};
        if (window.AxiomeSkills && window.AxiomeSkills.applyShopDiscount) {
          price = window.AxiomeSkills.applyShopDiscount(price, charData);
          _axDiscount = window.AxiomeSkills.getShopDiscount(charData);
        }
        var personal = Object.assign({}, (econ.exists ? (econ.data().personal || {}) : {}));
        var totW = window.JKanite.totalInBronze(personal);
        var totC = window.JKanite.priceInBronze(price);
        if (totW < totC) throw new Error('Fonds insuffisants (besoin de ' + totC.toLocaleString('fr-FR') + ' Bronze)');
        var deducted = window.JKanite.deductWithAutoConversion(personal, price);
        if (!deducted) throw new Error('Conversion impossible');
        var newPersonal = window.JKanite.autoConvertUp(deducted);
        var invItems = Object.assign({}, (inv.exists ? (inv.data().items || {}) : {}));
        invItems[itemId] = (invItems[itemId] || 0) + 1;
        tx.set(ecoRef, { personal: newPersonal }, { merge: true });
        tx.set(invRef, { items: invItems }, { merge: true });
      });
      var msg = '✓ ' + (it.name || itemId) + ' acheté';
      if (_axDiscount < 0) msg += ' (Axiome : ' + Math.round(_axDiscount * -100) + '% réduction)';
      toast(msg);
    } catch (e) {
      toast('✕ ' + (e.message || 'Erreur'), true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ─── Utils ─── */
  function curLabel(c) {
    var s = String(c || '').replace('_kanite', '');
    return s.charAt(0).toUpperCase() + s.slice(1) + ' K';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function toast(msg, err) {
    var t = $('#us-toast');
    t.textContent = msg;
    t.classList.toggle('is-err', !!err);
    t.classList.add('is-in');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('is-in'); }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
