/* ═══════════════════════════════════════════════════════════════════════
   shops-page.js — Bazaar Noir (page dédiée)
   • Liste de tous les shops ouverts (collection 'shops')
   • Détail d'un shop avec achat
   • Onglet "Mon Stall" : créer/fermer/ouvrir, ajouter/retirer items
   • Search live filtrant noms de stall, taglines, et items
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Firebase ─── */
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
    SHOPS:  'shops',
    CFG:    'config'
  };

  var $  = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return Array.from((p || document).querySelectorAll(s)); };

  var STAT_ICON = {
    strength: '⚔️', agility: '💨', speed: '🏃', intelligence: '🧠',
    mana: '✨', resistance: '🛡️', charisma: '👑', aura: '🌟'
  };
  var RARITY_COLOR = {
    common:'#a8a8a8', uncommon:'#40c886', rare:'#4090f0', epic:'#9b60f0',
    legendary:'#f0b040', mythic:'#e8508a', unique:'#ffdc64', artifact:'#dc5a46',
    mastercraft:'#78dcc8'
  };

  /* ─── State ─── */
  var STATE = {
    sess: null, uid: null, charId: null, charKey: null,
    inv: null, items: {}, shops: [], activeShop: null, myShop: null,
    tab: 'market', query: ''
  };

  /* ─── Session ─── */
  function getSess(){
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s._exp && Date.now() > s._exp) return null;
      return s;
    } catch (e) { return null; }
  }

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  async function init(){
    STATE.sess = getSess();
    if (!STATE.sess || !STATE.sess.id) {
      $('#bz-gate').hidden = false;
      return;
    }
    STATE.uid = STATE.sess.id;
    $('#bz-app').hidden = false;
    bindUI();

    try {
      var act = await db.collection(C.ACTIVE).doc(STATE.uid).get();
      if (act.exists) STATE.charId = (act.data() || {}).character_id;
      if (STATE.charId) STATE.charKey = STATE.uid + '_' + STATE.charId;
    } catch (e) { window._dbg && window._dbg.error('[BAZ] init', e); }

    /* Items catalogue pour les noms / emojis */
    await loadItemsCatalog();
    /* Inventaire pour Mon Stall */
    if (STATE.charKey) loadInventory();
    /* Shops temps réel */
    loadShops();
  }

  async function loadItemsCatalog(){
    try {
      var snap = await db.collection(C.CFG).doc('items').get();
      if (!snap.exists) return;
      var d = snap.data() || {};
      ['items','equipment','food_items','consumable_items'].forEach(function (sec) {
        if (d[sec] && typeof d[sec] === 'object') {
          Object.entries(d[sec]).forEach(function (kv) {
            STATE.items[kv[0]] = kv[1];
          });
        }
      });
    } catch (e) { window._dbg && window._dbg.error('[BAZ] items', e); }
  }

  function loadInventory(){
    db.collection(C.INV).doc(STATE.charKey).onSnapshot(function (s) {
      STATE.inv = s.exists ? s.data() : null;
      if (STATE.tab === 'mine') renderMine();
    });
  }

  function loadShops(){
    /* Pour rester compatible avec les regles existantes : get() complet puis filtre client.
       On fait également un onSnapshot pour la mise à jour temps réel. */
    db.collection(C.SHOPS).onSnapshot(function (snap) {
      var arr = [];
      snap.forEach(function (d) {
        var data = d.data() || {};
        if (data.open && data.items && Object.keys(data.items).length) {
          arr.push(Object.assign({ _key: d.id }, data));
        }
        if (d.id === STATE.charKey) STATE.myShop = Object.assign({ _key: d.id }, data);
      });
      arr.sort(function (a, b) {
        return ((b.updated_at || b.last_sale_at || 0) - (a.updated_at || a.last_sale_at || 0));
      });
      STATE.shops = arr;
      $('#bz-stat-shops').textContent = arr.length;
      var totalItems = arr.reduce(function (acc, s) { return acc + Object.keys(s.items || {}).length; }, 0);
      $('#bz-stat-items').textContent = totalItems;
      renderShopsList();
      renderMarquee();
      if (STATE.activeShop) {
        var refresh = arr.find(function (s) { return s._key === STATE.activeShop._key; });
        if (refresh) { STATE.activeShop = refresh; renderDetail(); }
        else STATE.activeShop = null;
      }
      if (STATE.tab === 'mine') renderMine();
    }, function (e) {
      window._dbg && window._dbg.error('[BAZ] shops', e);
      $('#bz-shops-list').innerHTML = '<div class="bz-empty">Erreur de chargement</div>';
    });
  }

  /* ═══════════════════════════════════════════════════════
     UI
     ═══════════════════════════════════════════════════════ */
  function bindUI(){
    $$('.bz-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.tab = b.getAttribute('data-tab');
        $$('.bz-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
        $('#bz-view-market').hidden = STATE.tab !== 'market';
        $('#bz-view-mine').hidden   = STATE.tab !== 'mine';
        if (STATE.tab === 'mine') renderMine();
      });
    });

    var inp = $('#bz-search-input');
    var clr = $('#bz-search-clear');
    inp.addEventListener('input', function () {
      STATE.query = (inp.value || '').trim().toLowerCase();
      clr.hidden = !STATE.query;
      renderShopsList();
      renderDetail();
    });
    clr.addEventListener('click', function () {
      inp.value = ''; STATE.query = ''; clr.hidden = true; inp.focus();
      renderShopsList(); renderDetail();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== inp && STATE.tab === 'market') {
        e.preventDefault(); inp.focus();
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     RENDER : Market — Shops list
     ═══════════════════════════════════════════════════════ */
  function shopMatches(s, q) {
    if (!q) return true;
    if ((s.name || '').toLowerCase().indexOf(q) >= 0) return true;
    if ((s.tagline || '').toLowerCase().indexOf(q) >= 0) return true;
    /* Item match */
    var items = s.items || {};
    var ids = Object.keys(items);
    for (var i = 0; i < ids.length; i++) {
      if (ids[i].toLowerCase().indexOf(q) >= 0) return true;
      var def = STATE.items[ids[i]] || {};
      if ((def.name || '').toLowerCase().indexOf(q) >= 0) return true;
    }
    return false;
  }

  function renderShopsList(){
    var listEl = $('#bz-shops-list');
    var filtered = STATE.shops.filter(function (s) { return shopMatches(s, STATE.query); });
    $('#bz-search-count').textContent = filtered.length + ' stall' + (filtered.length > 1 ? 's' : '');
    if (!filtered.length) {
      listEl.innerHTML = '<div class="bz-empty">Aucun stall pour cette recherche.</div>';
      return;
    }
    listEl.innerHTML = filtered.map(function (s) {
      var count = Object.keys(s.items || {}).length;
      var active = STATE.activeShop && STATE.activeShop._key === s._key;
      return '<div class="bz-shop' + (active ? ' active' : '') + '" data-key="' + esc(s._key) + '">' +
        '<span class="bz-shop-dot"></span>' +
        '<div class="bz-shop-info">' +
          '<div class="bz-shop-name">' + esc(s.name || s._key) + '</div>' +
          '<div class="bz-shop-tag">' + esc(s.tagline || '— Sans accroche —') + '</div>' +
        '</div>' +
        '<span class="bz-shop-count">×' + count + '</span>' +
      '</div>';
    }).join('');
    $$('.bz-shop', listEl).forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.getAttribute('data-key');
        STATE.activeShop = STATE.shops.find(function (s) { return s._key === key; });
        renderShopsList();
        renderDetail();
      });
    });
  }

  function itemMatches(itemId, q) {
    if (!q) return true;
    if (itemId.toLowerCase().indexOf(q) >= 0) return true;
    var def = STATE.items[itemId] || {};
    if ((def.name || '').toLowerCase().indexOf(q) >= 0) return true;
    if ((def.slot || '').toLowerCase().indexOf(q) >= 0) return true;
    if ((def.rarity || '').toLowerCase().indexOf(q) >= 0) return true;
    return false;
  }

  function renderDetail(){
    var el = $('#bz-detail');
    if (!STATE.activeShop) {
      el.innerHTML =
        '<div class="bz-detail-empty">' +
          '<div class="bz-detail-glyph">⛁</div>' +
          '<h2>Sélectionne un stall</h2>' +
          '<p>Choisis une boutique dans la colonne de gauche pour voir ses articles, ou tape ton mot-clé dans la barre de recherche en haut pour filtrer.</p>' +
        '</div>';
      return;
    }
    var s = STATE.activeShop;
    var entries = Object.entries(s.items || {}).filter(function (kv) {
      return itemMatches(kv[0], STATE.query);
    });
    var isMine = s._key === STATE.charKey;
    var head =
      '<div class="bz-detail-head">' +
        '<div class="bz-detail-name">' + esc(s.name || s._key) + '</div>' +
        (s.tagline ? '<div class="bz-detail-tag">« ' + esc(s.tagline) + ' »</div>' : '') +
        '<div class="bz-detail-meta">' + Object.keys(s.items || {}).length + ' article' +
          (Object.keys(s.items || {}).length > 1 ? 's' : '') +
          (isMine ? ' · TON STALL' : '') + '</div>' +
      '</div>';
    var grid;
    if (!entries.length) {
      grid = '<div class="bz-empty">Aucun article ne correspond à ta recherche.</div>';
    } else {
      grid = '<div class="bz-detail-grid">' + entries.map(function (kv) {
        return renderShopItemCard(s._key, kv[0], kv[1], isMine);
      }).join('') + '</div>';
    }
    el.innerHTML = head + grid;
  }

  function renderShopItemCard(shopKey, itemId, si, isMine) {
    var def = STATE.items[itemId] || {};
    var rarity = (def.rarity || 'common').toLowerCase();
    var rc = RARITY_COLOR[rarity] || '#a8a8a8';
    var effects = def.stat_effects || def.stats || {};
    var effStr = Object.entries(effects).slice(0, 3).map(function (kv) {
      return '+' + kv[1] + ' ' + (STAT_ICON[kv[0]] || kv[0]);
    }).join(' ');
    var qty = si.qty != null ? si.qty : si.quantity;
    var priceStr = formatPrice(si.price || {});
    var buyBtn = isMine
      ? '<button class="bz-item-buy" disabled><span>Ton stall</span><span>⚐</span></button>'
      : '<button class="bz-item-buy" data-buy-key="' + esc(shopKey) + '" data-buy-id="' + esc(itemId) + '">' +
        '<span>Acheter</span><span>⛁</span></button>';
    return '<div class="bz-item' + (isMine ? ' is-mine' : '') + '" data-rarity="' + rarity + '">' +
      '<span class="bz-item-rarity" style="color:' + rc + '">' + rarity + '</span>' +
      '<div class="bz-item-top">' +
        '<div class="bz-item-icon">' + (def.emoji || '📦') + '</div>' +
        '<div class="bz-item-info">' +
          '<div class="bz-item-name" style="color:' + rc + '">' + esc(def.name || itemId) + '</div>' +
          (effStr ? '<div class="bz-item-eff">' + effStr + '</div>' : '') +
          '<div class="bz-item-stock">×' + (qty != null ? qty : '?') + ' en stock</div>' +
        '</div>' +
      '</div>' +
      '<div class="bz-item-price">' + priceStr + '</div>' +
      buyBtn +
    '</div>';
  }

  /* Buy delegation */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-buy-id]');
    if (!btn) return;
    var shopKey = btn.getAttribute('data-buy-key');
    var itemId  = btn.getAttribute('data-buy-id');
    buyFromShop(shopKey, itemId, btn);
  });

  async function buyFromShop(shopKey, itemId, btn) {
    if (!STATE.charKey) { toast('Personnage actif introuvable', true); return; }
    if (shopKey === STATE.charKey) { toast('Tu ne peux pas acheter dans ton stall', true); return; }
    btn.disabled = true;
    var buyerEcoRef  = db.collection(C.ECONOMY).doc(STATE.charKey);
    var buyerInvRef  = db.collection(C.INV).doc(STATE.charKey);
    var sellerEcoRef = db.collection(C.ECONOMY).doc(shopKey);
    var shopRef     = db.collection(C.SHOPS).doc(shopKey);
    var charRef     = db.collection('characters').doc(String(STATE.charId));
    var _axDiscount = 0; /* pour le toast final */
    try {
      await db.runTransaction(async function (tx) {
        var shopSnap   = await tx.get(shopRef);
        var beSnap     = await tx.get(buyerEcoRef);
        var biSnap     = await tx.get(buyerInvRef);
        var seSnap     = await tx.get(sellerEcoRef);
        var charSnap   = await tx.get(charRef);
        if (!shopSnap.exists) throw new Error('Shop introuvable');
        var shopData   = shopSnap.data() || {};
        var liveItems  = Object.assign({}, shopData.items || {});
        var live       = liveItems[itemId];
        if (!live) throw new Error('Article épuisé');
        /* ── Axiome shop discount (Orateur / Manipulateur) ──
           Cumul -10% (Orateur Marchand Familier) + -10% (Manipulateur Maître
           du Marché) → -20% max. Appliqué au prix payé par l'acheteur
           ET reçu par le vendeur (négociation RP-cohérente). */
        var rawPrice = live.price || {};
        var charData = charSnap.exists ? (charSnap.data() || {}) : {};
        var price = (window.AxiomeSkills && window.AxiomeSkills.applyShopDiscount)
          ? window.AxiomeSkills.applyShopDiscount(rawPrice, charData)
          : rawPrice;
        _axDiscount = window.AxiomeSkills ? window.AxiomeSkills.getShopDiscount(charData) : 0;
        var buyerPersonal = Object.assign({}, (beSnap.exists ? (beSnap.data().personal || {}) : {}));
        var totalW = window.JKanite.totalInBronze(buyerPersonal);
        var totalC = window.JKanite.priceInBronze(price);
        if (totalW < totalC) throw new Error('Fonds insuffisants');
        var deducted = window.JKanite.deductWithAutoConversion(buyerPersonal, price);
        if (!deducted) throw new Error('Conversion impossible');
        var newBuyerPersonal = window.JKanite.autoConvertUp(deducted);
        var buyerItems = Object.assign({}, (biSnap.exists ? (biSnap.data().items || {}) : {}));
        buyerItems[itemId] = (buyerItems[itemId] || 0) + 1;
        /* ── Bug #1 fix : on doit utiliser des chemins pointés + FieldValue.delete()
              pour vraiment SUPPRIMER l'item du shop côté worker. Le worker
              `updateDoc` fait un deepMerge sur les sous-objets, donc passer
              `items: newMap` sans la clé supprimée garde l'ancienne entrée. ── */
        var sellerPersonalRaw = Object.assign({}, (seSnap.exists ? (seSnap.data().personal || {}) : {}));
        Object.entries(price).forEach(function (kv) {
          sellerPersonalRaw[kv[0]] = (sellerPersonalRaw[kv[0]] || 0) + (kv[1] || 0);
        });
        var newSellerPersonal = window.JKanite.autoConvertUp(sellerPersonalRaw);
        var saleEntry = {
          item_id: itemId,
          item_name: (STATE.items[itemId] && STATE.items[itemId].name) || itemId,
          price: price, buyer: STATE.charKey, at: new Date().toISOString()
        };
        tx.set(buyerEcoRef, { personal: newBuyerPersonal }, { merge: true });
        tx.set(buyerInvRef, { items: buyerItems }, { merge: true });
        tx.set(sellerEcoRef, { personal: newSellerPersonal }, { merge: true });

        var shopUpdates = {
          sales_log: firebase.firestore.FieldValue.arrayUnion(saleEntry),
          updated_at: Date.now(),
        };
        if (live.qty !== -1 && live.qty != null) {
          var nq = live.qty - 1;
          if (nq <= 0) {
            shopUpdates['items.' + itemId] = firebase.firestore.FieldValue.delete();
          } else {
            shopUpdates['items.' + itemId] = Object.assign({}, live, { qty: nq });
          }
        } else {
          shopUpdates['items.' + itemId] = firebase.firestore.FieldValue.delete();
        }
        tx.update(shopRef, shopUpdates);
      });
      var msg = '✓ Acheté !';
      if (_axDiscount < 0) msg += ' (Axiome : ' + Math.round(_axDiscount * -100) + '% réduction)';
      toast(msg);
    } catch (e) {
      toast('✕ ' + (e.message || 'Erreur'), true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ═══════════════════════════════════════════════════════
     MARQUEE — derniers items mis en vente
     ═══════════════════════════════════════════════════════ */
  function renderMarquee(){
    if (!STATE.shops.length) {
      $('#bz-marquee-inner').innerHTML = '<span>· Aucun stall ouvert pour l\'instant · Reviens plus tard pour les soldes ·</span>';
      return;
    }
    var bits = [];
    STATE.shops.slice(0, 12).forEach(function (s) {
      var first = Object.entries(s.items || {})[0];
      if (!first) return;
      var def = STATE.items[first[0]] || {};
      var price = formatPrice(first[1].price || {});
      bits.push('<span>◆ <b>' + esc(s.name || '?') + '</b> — ' + esc(def.name || first[0]) + ' · ' + price + '</span>');
    });
    if (!bits.length) bits.push('<span>· Aucun stall ouvert ·</span>');
    $('#bz-marquee-inner').innerHTML = bits.join('');
  }

  /* ═══════════════════════════════════════════════════════
     MINE VIEW (ton stall)
     ═══════════════════════════════════════════════════════ */
  function renderMine(){
    var wrap = $('#bz-mine-wrap');
    if (!STATE.charKey) {
      wrap.innerHTML = '<div class="bz-empty">Personnage actif introuvable.</div>';
      return;
    }
    var s = STATE.myShop;
    if (!s) {
      wrap.innerHTML =
        '<div class="bz-mine-section" style="text-align:center;padding:36px 24px">' +
          '<div class="bz-detail-glyph" style="margin-bottom:14px">⚐</div>' +
          '<div class="bz-mine-name" style="margin-bottom:10px">Aucun stall</div>' +
          '<div class="bz-mine-tag" style="margin-bottom:14px">Utilise <strong style="color:#4adbd6">/char_shop_create</strong> sur Discord pour créer ton premier stall.</div>' +
        '</div>';
      return;
    }
    var open = !!s.open;
    var stockEntries = Object.entries(s.items || {});
    var invItems  = (STATE.inv && STATE.inv.items) || {};
    var equipped  = (STATE.inv && STATE.inv.equipped_assets) || [];
    var sellable  = Object.entries(invItems).filter(function (kv) {
      var id = kv[0], q = kv[1];
      if (!q || q <= 0) return false;
      if (s.items && s.items[id]) return false;
      if (equipped.indexOf(id) >= 0) return false;
      return true;
    });

    var head =
      '<div class="bz-mine-head">' +
        '<div>' +
          '<div class="bz-mine-name">' + esc(s.name || 'Mon Stall') + '</div>' +
          '<div class="bz-mine-tag">' + esc(s.tagline || '« Pas d\'accroche »') + '</div>' +
          '<div class="bz-mine-status ' + (open ? 'open' : 'closed') + '">' +
            '<span class="bz-dot"></span>' +
            (open ? 'OUVERT · visible sur le marché' : 'FERMÉ · non visible') +
          '</div>' +
        '</div>' +
        '<button class="bz-mine-toggle ' + (open ? 'is-on' : '') + '" id="bz-toggle-shop">' +
          (open ? '⏸ Fermer le stall' : '▶ Ouvrir le stall') +
        '</button>' +
      '</div>';

    var stockBlock = '<div class="bz-mine-section">' +
      '<div class="bz-mine-section-head">' +
        '<span class="bz-mine-section-title">Articles en vente</span>' +
        '<span class="bz-mine-section-line"></span>' +
        '<span class="bz-mine-section-count">×' + stockEntries.length + '</span>' +
      '</div>';
    if (!stockEntries.length) {
      stockBlock += '<div class="bz-empty">Rien en vente — ajoute des articles ci-dessous.</div>';
    } else {
      stockBlock += '<div class="bz-mine-grid">' + stockEntries.map(function (kv) {
        var def = STATE.items[kv[0]] || {};
        var rarity = (def.rarity || 'common').toLowerCase();
        var rc = RARITY_COLOR[rarity] || '#a8a8a8';
        var priceStr = formatPrice(kv[1].price || {});
        return '<div class="bz-item" data-rarity="' + rarity + '">' +
          '<div class="bz-item-top">' +
            '<div class="bz-item-icon">' + (def.emoji || '📦') + '</div>' +
            '<div class="bz-item-info">' +
              '<div class="bz-item-name" style="color:' + rc + '">' + esc(def.name || kv[0]) + '</div>' +
              '<div class="bz-item-stock">×' + (kv[1].qty || 0) + ' en stock</div>' +
            '</div>' +
          '</div>' +
          '<div class="bz-item-price">' + priceStr + '</div>' +
          '<button class="bz-remove-btn" data-remove="' + esc(kv[0]) + '"><span>Retirer</span><span>✕</span></button>' +
        '</div>';
      }).join('') + '</div>';
    }
    stockBlock += '</div>';

    var sellBlock = '<div class="bz-mine-section">' +
      '<div class="bz-mine-section-head">' +
        '<span class="bz-mine-section-title">Mettre en vente depuis l\'inventaire</span>' +
        '<span class="bz-mine-section-line"></span>' +
        '<span class="bz-mine-section-count">×' + sellable.length + '</span>' +
      '</div>';
    if (!sellable.length) {
      sellBlock += '<div class="bz-empty">Aucun item disponible à la vente.</div>';
    } else {
      sellBlock += '<div class="bz-mine-grid">' + sellable.map(function (kv) {
        var id = kv[0], q = kv[1];
        var def = STATE.items[id] || {};
        var rarity = (def.rarity || 'common').toLowerCase();
        var rc = RARITY_COLOR[rarity] || '#a8a8a8';
        return '<div class="bz-item" data-rarity="' + rarity + '">' +
          '<div class="bz-item-top">' +
            '<div class="bz-item-icon">' + (def.emoji || '📦') + '</div>' +
            '<div class="bz-item-info">' +
              '<div class="bz-item-name" style="color:' + rc + '">' + esc(def.name || id) + '</div>' +
              '<div class="bz-item-stock">×' + q + ' en inventaire</div>' +
            '</div>' +
          '</div>' +
          /* Bug #7 — layout 2 rangées avec labels pour que le choix de
             monnaie soit visible et lisible (avant 86px → tronqué). */
          '<div class="bz-listing-controls">' +
            '<div class="bz-listing-row">' +
              '<label for="qty-' + esc(id) + '">Quantité (max ' + q + ')</label>' +
              '<input type="number" id="qty-' + esc(id) + '" min="1" max="' + q + '" value="1">' +
            '</div>' +
            '<div class="bz-listing-row">' +
              '<label for="price-' + esc(id) + '">Prix unitaire</label>' +
              '<input type="number" id="price-' + esc(id) + '" min="1" value="100" placeholder="Prix">' +
            '</div>' +
            '<div class="bz-listing-row full">' +
              '<label for="cur-' + esc(id) + '">Monnaie demandée</label>' +
              '<select id="cur-' + esc(id) + '">' +
                '<option value="bronze_kanite">Bronze Kanite</option>' +
                '<option value="silver_kanite">Silver Kanite</option>' +
                '<option value="gold_kanite">Gold Kanite</option>' +
                '<option value="platinum_kanite">Platinum Kanite</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<button class="bz-sell-btn" data-sell="' + esc(id) + '" data-max="' + q + '">' +
            '<span>Mettre en vente</span><span>⛁</span>' +
          '</button>' +
        '</div>';
      }).join('') + '</div>';
    }
    sellBlock += '</div>';

    wrap.innerHTML = head + stockBlock + sellBlock;

    /* Wire actions */
    $('#bz-toggle-shop').addEventListener('click', toggleShop);
    $$('[data-remove]', wrap).forEach(function (b) {
      b.addEventListener('click', function () { removeFromShop(b.getAttribute('data-remove'), b); });
    });
    $$('[data-sell]', wrap).forEach(function (b) {
      b.addEventListener('click', function () {
        addToShop(b.getAttribute('data-sell'), parseInt(b.getAttribute('data-max'), 10), b);
      });
    });
  }

  async function toggleShop(){
    if (!STATE.myShop || !STATE.charKey) return;
    var next = !STATE.myShop.open;
    try {
      /* Note: updated_at omis — pas dans la whitelist des champs shops (règles D1). */
      await db.collection(C.SHOPS).doc(STATE.charKey).set(
        { open: next }, { merge: true }
      );
      toast(next ? '✓ Stall ouvert' : '✓ Stall fermé');
    } catch (e) {
      toast('✕ ' + (e.message || 'Erreur'), true);
    }
  }

  async function addToShop(itemId, max, btn){
    if (!STATE.charKey) return;
    var q  = Math.max(1, Math.min(max, parseInt(($('#qty-' + itemId) || {}).value, 10) || 1));
    var p  = Math.max(1, parseInt(($('#price-' + itemId) || {}).value, 10) || 100);
    var cu = ($('#cur-' + itemId) || {}).value || 'bronze_kanite';

    /* ── Axiome Dompteur : +20% sur le prix de vente des Golden Eggs ──
       Détection par nom d'item (préfixe golden_egg) ou flag dans items catalog. */
    var _isGoldenEgg = false;
    try {
      var lid = String(itemId || '').toLowerCase();
      if (lid === 'golden_egg' || lid.indexOf('golden_egg') === 0) _isGoldenEgg = true;
      var meta = STATE.items && STATE.items[itemId];
      if (meta && (meta.type === 'golden_egg' || meta.category === 'golden_eggs')) _isGoldenEgg = true;
    } catch (_) {}

    var _eggBonusPct = 0;
    if (_isGoldenEgg && window.AxiomeSkills && STATE.charId) {
      try {
        var charSnap = await db.collection('characters').doc(String(STATE.charId)).get();
        var charData = charSnap.exists ? (charSnap.data() || {}) : {};
        _eggBonusPct = window.AxiomeSkills.getGoldenEggsBonus(charData) || 0;
        if (_eggBonusPct > 0) {
          p = Math.floor(p * (1 + _eggBonusPct));
        }
      } catch (_) {}
    }

    btn.disabled = true;
    var invRef  = db.collection(C.INV).doc(STATE.charKey);
    var shopRef = db.collection(C.SHOPS).doc(STATE.charKey);
    try {
      await db.runTransaction(async function (tx) {
        var iv = await tx.get(invRef);
        var sh = await tx.get(shopRef);

        /* ─ Vérifier le stock ─ */
        var invItemsAll = iv.exists ? ((iv.data() || {}).items || {}) : {};
        var current = Number(invItemsAll[itemId]) || 0;
        if (current < q) throw new Error('Pas assez en stock');

        /* ─ Inventaire : patch dotted pour éviter le deep-merge ─────────────
           Le setDoc avec merge:true fait un deepMerge qui conserve les clés
           supprimées dans les sous-objets. On passe par updateDoc (PATCH)
           avec un dotted-path pour que le Worker applique setDotted() →
           le FieldValue.delete() supprime vraiment la clé côté D1.          */
        var newQty = current - q;
        var invPatch = {};
        invPatch['items.' + itemId] = newQty > 0
          ? newQty
          : firebase.firestore.FieldValue.delete();
        tx.update(invRef, invPatch);

        /* ─ Shop : patch dotted (ne touche que cet item, preserve les autres) */
        var shopItemsAll = sh.exists ? ((sh.data() || {}).items || {}) : {};
        var prevShopEntry = shopItemsAll[itemId];
        var shopPatch = {};
        shopPatch['items.' + itemId] = {
          price: { [cu]: p },
          qty: prevShopEntry ? (Number(prevShopEntry.qty) || 0) + q : q
        };
        tx.update(shopRef, shopPatch);
      });
      if (_eggBonusPct > 0) {
        toast('✓ Mis en vente — bonus Dompteur +' + Math.round(_eggBonusPct * 100) + '%');
      } else {
        toast('✓ Mis en vente');
      }
    } catch (e) {
      toast('✕ ' + (e.message || 'Erreur'), true);
    } finally {
      btn.disabled = false;
    }
  }

  async function removeFromShop(itemId, btn){
    if (!STATE.charKey) return;
    btn.disabled = true;
    var invRef  = db.collection(C.INV).doc(STATE.charKey);
    var shopRef = db.collection(C.SHOPS).doc(STATE.charKey);
    try {
      await db.runTransaction(async function (tx) {
        var iv = await tx.get(invRef);
        var sh = await tx.get(shopRef);

        var shopItemsAll = sh.exists ? ((sh.data() || {}).items || {}) : {};
        var si = shopItemsAll[itemId];
        if (!si) throw new Error('Article introuvable');
        var q = Number(si.qty) || 0;

        /* ─ Shop : supprimer l'item via dotted-path delete ─────────────────
           tx.set avec merge:true + deepMerge conservait la clé supprimée.
           On passe par updateDoc (PATCH) + FieldValue.delete() → setDotted()
           met la valeur à undefined → JSON.stringify l'omet → clé supprimée. */
        var shopPatch = {};
        shopPatch['items.' + itemId] = firebase.firestore.FieldValue.delete();
        tx.update(shopRef, shopPatch);

        /* ─ Inventaire : remettre la quantité via dotted-path ─ */
        if (q > 0) {
          var currentInvQty = iv.exists
            ? (Number(((iv.data() || {}).items || {})[itemId]) || 0)
            : 0;
          if (iv.exists) {
            var invPatch = {};
            invPatch['items.' + itemId] = currentInvQty + q;
            tx.update(invRef, invPatch);
          } else {
            /* Inventaire absent — le créer avec juste cet item */
            tx.set(invRef, { items: { [itemId]: q } });
          }
        }
      });
      toast('✓ Article retiré');
    } catch (e) {
      toast('✕ ' + (e.message || 'Erreur'), true);
    } finally {
      btn.disabled = false;
    }
  }

  /* ─── Utils ─── */
  function formatPrice(price) {
    if (!price || !Object.keys(price).length) return 'Gratuit';
    return Object.entries(price).map(function (kv) {
      return kv[1] + ' ' + curLabel(kv[0]);
    }).join(' + ');
  }
  function curLabel(c) {
    var s = String(c || '').replace('_kanite', '');
    return s.charAt(0).toUpperCase() + s.slice(1) + ' K';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function toast(msg, err) {
    var t = $('#bz-toast');
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
