/* ── Hub IRP — Transforme le hub en mode IRP ── */
/* Exécuté après hub-core.js et irp-mode.js */
/* Fixes: perso IRP actif, Jahartites, slots IRP, onglets custom, gacha IRP */
(function () {
  'use strict';

  if (!window._irpMode) return;

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 1 — Override loadCharacter pour charger le perso IRP
     ══════════════════════════════════════════════════════════════════════════ */

  /* On doit intercepter le chargement du personnage AVANT qu'il ne se fasse.
     Le hub charge le perso dans loadCharacter() appelé depuis afterLogin().
     On override les collections source. */

  var _origLoadCharacter = null;

  function overrideCollections() {
    /* Si hub-core a exposé C, on peut le modifier */
    if (typeof C !== 'undefined') {
      /* Remplacer les collections pour pointer vers IRP */
      C.ACTIVE = 'irp_active_characters';
      C.CHARS = 'irp_characters';
      /* L'inventaire IRP utilise la même structure mais pourrait être dans une collection différente */
      /* Pour l'instant on garde C.INV = 'inventories' car le lien IRP partage l'inventaire */
    }
  }

  /* On essaie d'overrider dès que possible */
  function tryOverride() {
    if (typeof C !== 'undefined') {
      overrideCollections();
      return;
    }
    setTimeout(tryOverride, 20);
  }
  tryOverride();

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 2 — Attendre que le hub soit visible, transformer les onglets
     ══════════════════════════════════════════════════════════════════════════ */

  async function _resolveIRPInventoryKey(uid, irpCharId, irpCharData) {
    try {
      var fdb = window._db || db;
      var linkSnap = await fdb.collection('irp_links').doc(String(uid)).get();
      if (linkSnap.exists) {
        var linkData = linkSnap.data() || {};
        if ((!linkData.irp_char_id || linkData.irp_char_id === String(irpCharId)) && linkData.main_char_id) {
          return String(uid) + '_' + String(linkData.main_char_id);
        }
      }
      var charData = irpCharData || {};
      var fallback = charData.linked_to || charData.synced_from || null;
      if (!fallback) {
        try {
          var charSnap = await fdb.collection('irp_characters').doc(String(irpCharId)).get();
          if (charSnap.exists) {
            var c = charSnap.data() || {};
            fallback = c.linked_to || c.synced_from || null;
          }
        } catch (_) {}
      }
      return String(uid) + '_' + String(fallback || irpCharId);
    } catch (e) {
      return String(uid) + '_' + String(irpCharId);
    }
  }
  window._resolveIRPInventoryKey = _resolveIRPInventoryKey;
  window._getInventoryKey = function () {
    if (window._irpMode && window._inventoryKeyResolved) return window._inventoryKeyResolved;
    return String(UID) + '_' + String(CHAR_ID);
  };

  function waitForHub() {
    if (!document.getElementById('hub-main')) {
      setTimeout(waitForHub, 50);
      return;
    }
    initIRPHub();
  }

  function initIRPHub() {
    /* Titres */
    document.title = 'JAHARTA IRP — Hub';
    var gateLogo = document.querySelector('.gate-logo');
    if (gateLogo) gateLogo.textContent = 'JAHARTA IRP';
    var gateSub = document.querySelector('.gate-sub');
    if (gateSub) gateSub.textContent = '// IRP NEXUS HUB ACCESS //';

    /* ── Remplacer la barre d'onglets ── */
    var hubTabs = document.querySelector('.hub-tabs');
    if (!hubTabs) return;

    var IRP_TABS = [
      { id: 'dashboard',   emoji: '🏠', label: 'Dashboard' },
      { id: 'personnage',  emoji: '👤', label: 'Personnage' },
      { id: 'inventaire',  emoji: '🎒', label: 'Inventaire' },
      { id: 'gacha',       emoji: '🎰', label: 'Gacha IRP' },
      { id: 'liens',       emoji: '⛓️', label: 'Liens' },
      { id: 'corruption',  emoji: '☠️', label: 'Corruption' },
      { id: 'seal',        emoji: '👁️', label: 'Seal' },
      { id: 'cour',        emoji: '👑', label: 'Cour' },
      { id: 'succes_irp',  emoji: '🏆', label: 'Succès IRP' },
      { id: 'ushop',       emoji: '🛒', label: 'IRP Shop' },
      { id: 'parametres',  emoji: '⚙️', label: 'Paramètres' },
    ];

    var tabsHTML = '<a href="index.html" class="tab-btn" style="text-decoration:none;border-bottom:none;opacity:.55" title="Retour au site">← <span class="tab-text">Site</span></a>';
    tabsHTML += '<div style="width:1px;background:var(--border);margin:10px 0;flex-shrink:0"></div>';
    IRP_TABS.forEach(function (t, i) {
      var active = i === 0 ? ' active' : '';
      tabsHTML += '<button class="tab-btn' + active + '" onclick="showTab(\'' + t.id + '\')" id="tab-' + t.id + '">' +
        t.emoji + ' <span class="tab-text">' + t.label + '</span></button>';
    });
    hubTabs.innerHTML = tabsHTML;

    /* Cacher les panels normaux qui n'existent pas en IRP */
    ['party', 'progression', 'titres', 'compagnons', 'monshop', 'shops', 'succes'].forEach(function (id) {
      var panel = document.getElementById('panel-' + id);
      if (panel) panel.style.display = 'none';
    });

    /* Créer les panels IRP manquants */
    var hubMain = document.getElementById('hub-main');
    var newPanels = [
      { id: 'liens', num: '05', title: 'Liens IRP' },
      { id: 'corruption', num: '06', title: 'Corruption' },
      { id: 'seal', num: '07', title: 'Seal of Dominion' },
      { id: 'cour', num: '08', title: 'Cour' },
      { id: 'succes_irp', num: '09', title: 'Succès IRP' },
    ];
    newPanels.forEach(function (p) {
      if (document.getElementById('panel-' + p.id)) return;
      var div = document.createElement('div');
      div.className = 'tab-panel';
      div.id = 'panel-' + p.id;
      div.innerHTML = '<div class="sh"><span class="sh-num">' + p.num + '</span><span class="sh-title">' + p.title + '</span><div class="sh-line"></div></div>' +
        '<div id="' + (p.id === 'succes_irp' ? 'irp-succes-container' : ('irp-' + p.id + '-container')) + '" style="padding:12px"><div class="empty-state" style="text-align:center;padding:40px;color:var(--text2)">Chargement...</div></div>';
      hubMain.appendChild(div);
    });

    /* Modifier le titre du Universal Shop */
    var ushopTitle = document.querySelector('#panel-ushop .sh-title');
    if (ushopTitle) ushopTitle.textContent = 'Universal IRP Shop';

    /* ── Override showTab ── */
    overrideShowTab();

    /* ── Override renderGacha pour IRP ── */
    overrideGacha();

    /* ── Navarites → Jahartites (mutation observer) ── */
    startJahartitesObserver();

    /* ── IRP Slots dans l'inventaire ── */
    injectIRPSlots();

    /* ── Charger les données IRP après login ── */
    observeLogin();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 3 — Override showTab pour les onglets IRP
     ══════════════════════════════════════════════════════════════════════════ */

  function overrideShowTab() {
    var _orig = window.showTab;
    window.showTab = function (id) {
      /* Render IRP custom tabs before switching */
      if (id === 'liens') renderIRPLiens();
      else if (id === 'corruption') renderIRPCorruption();
      else if (id === 'seal') renderIRPSeal();
      else if (id === 'cour') renderIRPCour();
      else if (id === 'succes_irp') { if (window._renderAchievements) window._renderAchievements(); }

      /* IRP-only tabs don't exist in LAZY — use fallback directly */
      var irpOnlyTabs = ['liens', 'corruption', 'seal', 'cour', 'succes_irp'];
      if (irpOnlyTabs.indexOf(id) !== -1) {
        fallbackShowTab(id);
        window.CURRENT_TAB = id;
        return;
      }

      /* Call original for panel switching + lazy loading */
      if (typeof _orig === 'function') {
        try { _orig(id); } catch (e) {
          window._dbg?.warn('[HUB-IRP] showTab fallback for', id, e);
          fallbackShowTab(id);
        }
      } else {
        fallbackShowTab(id);
      }

      /* Re-render ciblé après le switch pour écraser les contenus RP tardifs */
      setTimeout(function () {
        if (id === 'gacha') renderIRPGacha();
        if (id === 'dashboard' && typeof window.renderPlayerWidgets === 'function') {
          try { window.renderPlayerWidgets(); } catch (_) {}
        }
      }, 0);
    };
  }

  function fallbackShowTab(id) {
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    var target = document.getElementById('panel-' + id);
    if (target) target.classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    var btn = document.getElementById('tab-' + id);
    if (btn) btn.classList.add('active');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 4 — Navarites → Jahartites (global replace via MutationObserver)
     ══════════════════════════════════════════════════════════════════════════ */

  function startJahartitesObserver() {
    var processed = new WeakSet();

    function replaceNavarites(root) {
      if (!root) return;
      var base = root.nodeType === 1 || root.nodeType === 9 ? root : document.body;
      var walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        var node = walker.currentNode;
        if (node.textContent.match(/Navarites?/i)) {
          node.textContent = node.textContent.replace(/Navarites?/gi, function (m) {
            return m.endsWith('s') ? 'Jahartites' : 'Jahartite';
          });
        }
      }
      base.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach(function (el) {
        ['alt', 'title', 'placeholder', 'aria-label'].forEach(function (attr) {
          var val = el.getAttribute(attr);
          if (val && /Navarites?/i.test(val)) {
            el.setAttribute(attr, val.replace(/Navarites?/gi, function (m) {
              return m.endsWith('s') ? 'Jahartites' : 'Jahartite';
            }));
          }
        });
      });
    }

    /* Replace the wallet value with real Jahartites balance */
    function injectJahartiteBalance() {
      if (!window._irpPlayer) return;
      var jah = window._irpPlayer.jahartites || 0;
      [
        '.wi-navarite .wi-val',
        '.wallet-item:first-child .wi-val',
        '#gacha-nav-val',
        '#pnv',
        '#nv-c'
      ].forEach(function (selector) {
        var el = document.querySelector(selector);
        if (el) el.textContent = jah.toLocaleString();
      });
      /* Also fix the wallet label */
      var walletLabel = document.querySelector('.wi-navarite .wi-label');
      if (!walletLabel) walletLabel = document.querySelector('.wallet-item:first-child .wi-label');
      if (walletLabel && walletLabel.textContent.match(/Navarites?/i)) {
        walletLabel.textContent = 'Jahartites';
      }
      /* Fix dashboard nav val */
      var dashNavVal = document.getElementById('dash-nav-val');
      if (dashNavVal) {
        var unit = dashNavVal.querySelector('.nav-unit');
        var valSpan = dashNavVal.querySelector('span:first-child');
        if (valSpan) valSpan.textContent = jah.toLocaleString();
        if (unit && unit.textContent === 'NAV') unit.textContent = 'JAH';
      }
      /* Also force PLAYER.navarites to reflect jahartites */
      if (window.PLAYER) {
        window.PLAYER.navarites = jah;
      }
    }

    replaceNavarites(document.body);

    /* Expose to window so loadIRPData can call them */
    window._irpInjectJahartiteBalance = injectJahartiteBalance;
    window._irpReplaceNavarites = replaceNavarites;

    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && !processed.has(n)) {
            processed.add(n);
            replaceNavarites(n);
          }
        });
        if (m.type === 'characterData' && m.target.textContent.match(/Navarites?/i)) {
          m.target.textContent = m.target.textContent.replace(/Navarites?/gi, function (match) {
            return match.endsWith('s') ? 'Jahartites' : 'Jahartite';
          });
        }
      });
      /* After any DOM change, try to inject the real balance */
      injectJahartiteBalance();
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });

    /* Also check periodically for the first few seconds */
    var attempts = 0;
    var iv = setInterval(function () {
      injectJahartiteBalance();
      replaceNavarites(document.body);
      if (++attempts > 30) clearInterval(iv);
    }, 500);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 5 — IRP Slots dans l'inventaire (après les slots normaux)
     ══════════════════════════════════════════════════════════════════════════ */

  function injectIRPSlots() {
    var invPanel = document.getElementById('panel-inventaire');
    if (!invPanel) return;

    var obs = new MutationObserver(function () {
      if (invPanel.querySelector('.irp-slots-section')) return;

      /* Cibler directement equip-bonus-grid — c'est l'élément fiable */
      var bonusGrid = invPanel.querySelector('#equip-bonus-grid');
      if (!bonusGrid) return;

      /* ── Wrapper : englobe les stats bonus existantes + IRP slots ── */
      var wrapper = document.createElement('div');
      wrapper.className = 'irp-bonus-wrapper';
      wrapper.style.cssText = 'border:1px solid rgba(220,20,60,0.15);border-radius:12px;overflow:hidden;margin:16px 0;background:rgba(220,20,60,0.02);';

      /* ── Bloc 1 : Stats Bonus Équipement (encapsulé) ── */
      var statsBonusBlock = document.createElement('div');
      statsBonusBlock.className = 'irp-stats-bonus-block';
      statsBonusBlock.style.cssText = 'padding:14px;border-bottom:1px solid rgba(220,20,60,0.1);';
      var bonusLabel = bonusGrid.previousElementSibling;
      /* Cloner le header des bonus s'il y en a un (sh / section-head) */
      var bonusHeaderClone = null;
      if (bonusLabel && (bonusLabel.classList.contains('sh') || bonusLabel.tagName === 'H3' || bonusLabel.tagName === 'H4')) {
        bonusHeaderClone = bonusLabel.cloneNode(true);
      }
      if (bonusHeaderClone) {
        statsBonusBlock.appendChild(bonusHeaderClone);
        bonusLabel.style.display = 'none';
      }
      /* Déplacer equip-bonus-grid dans le wrapper */
      var bonusGridParent = bonusGrid.parentElement;
      statsBonusBlock.appendChild(bonusGrid);
      wrapper.appendChild(statsBonusBlock);

      /* ── Bloc 2 : IRP Slots ── */
      var irpSection = document.createElement('div');
      irpSection.className = 'irp-slots-section';
      irpSection.style.cssText = 'padding:16px;';

      var header = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(220,20,60,0.12)">' +
        '<span style="color:#dc143c;font-size:0.7rem">◆</span>' +
        '<span style="font-family:var(--font-h);font-size:0.6rem;letter-spacing:0.15em;color:#dc143c;font-weight:800">SLOTS BONUS IRP</span>' +
        '<span style="color:#dc143c;font-size:0.7rem">◆</span>' +
      '</div>';

      var IRP_SLOT_CATS = [
        { id: 'erp', label: 'EMPREINTE RITUELLE', tag: 'ERP', count: 3, color: '#dc143c', desc: 'Slots liés aux rituels de domination' },
        { id: 'dom', label: 'DOMINION', tag: 'DOM', count: 3, color: '#8B008B', desc: 'Slots de contrôle et d\'emprise' },
        { id: 'lord', label: 'SEIGNEURIE', tag: 'LORD', count: 4, color: '#6A0DAD', desc: 'Slots de souveraineté IRP' }
      ];

      var slotsHTML = '';
      IRP_SLOT_CATS.forEach(function (cat) {
        slotsHTML += '<div class="irp-slot-category" data-irp-cat="' + cat.id + '" style="margin-bottom:12px;padding:10px;border:1px solid ' + cat.color + '18;border-radius:8px;background:rgba(10,4,16,0.5)">';
        slotsHTML += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
        slotsHTML += '<div style="display:flex;align-items:center;gap:6px">';
        slotsHTML += '<span style="font-family:var(--font-h);font-size:0.45rem;letter-spacing:0.12em;color:' + cat.color + ';font-weight:700">' + cat.label + '</span>';
        slotsHTML += '<span style="font-family:var(--font-m);font-size:0.35rem;letter-spacing:0.08em;color:' + cat.color + '88;background:' + cat.color + '12;border:1px solid ' + cat.color + '25;border-radius:3px;padding:1px 5px">' + cat.tag + '</span>';
        slotsHTML += '</div>';
        slotsHTML += '<span style="font-family:var(--font-m);font-size:0.38rem;color:' + cat.color + '66">0 / ' + cat.count + '</span>';
        slotsHTML += '</div>';
        slotsHTML += '<div style="font-family:var(--font-m);font-size:0.35rem;color:var(--text3);letter-spacing:0.04em;margin-bottom:8px;opacity:0.7">' + cat.desc + '</div>';
        slotsHTML += '<div style="display:grid;grid-template-columns:repeat(' + cat.count + ',1fr);gap:6px">';
        for (var i = 0; i < cat.count; i++) {
          slotsHTML += '<div class="irp-slot-cell" data-irp-slot="' + cat.id + '-' + i + '" style="aspect-ratio:1;border:1px dashed ' + cat.color + '40;border-radius:6px;display:flex;align-items:center;justify-content:center;background:rgba(10,4,16,0.7);transition:border-color 0.2s,background 0.2s;min-height:48px;cursor:default">';
          slotsHTML += '<span style="font-family:var(--font-h);font-size:0.35rem;color:' + cat.color + '44;letter-spacing:0.05em">' + cat.tag + '</span>';
          slotsHTML += '</div>';
        }
        slotsHTML += '</div>';
        slotsHTML += '</div>';
      });

      irpSection.innerHTML = header + slotsHTML;
      wrapper.appendChild(irpSection);

      /* Insérer le wrapper là où était le bonus grid */
      bonusGridParent.appendChild(wrapper);
    });
    obs.observe(invPanel, { childList: true, subtree: true });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 6 — Chargement données IRP après login
     ══════════════════════════════════════════════════════════════════════════ */

  function observeLogin() {
    var hubMain = document.getElementById('hub-main');
    if (!hubMain) return;

    var _irpDataLoaded = false;

    function tryLoadIRP() {
      if (_irpDataLoaded) return;
      if (!hubMain.classList.contains('active')) return;
      if (!window.UID) return;
      _irpDataLoaded = true;
      setTimeout(loadIRPData, 300);
    }

    /* Watch class changes (hub-core uses classList.add('active')) */
    var loginObs = new MutationObserver(function () {
      tryLoadIRP();
    });
    loginObs.observe(hubMain, { attributes: true, attributeFilter: ['class'] });

    /* Also check immediately in case already logged in */
    tryLoadIRP();

    /* Fallback poll for edge cases (class already set before observer) */
    var pollCount = 0;
    var pollIv = setInterval(function () {
      tryLoadIRP();
      if (_irpDataLoaded || ++pollCount > 60) clearInterval(pollIv);
    }, 500);
  }

  async function loadIRPData() {
    if (!window._db && !db) return;
    var fdb = window._db || db;
    var discordId = window.UID || window.DISCORD_ID || window._discordId;
    if (!discordId) return;

    try {
      /* Jahartites / streak dispo même si le perso n'est pas encore hydraté */
      var playerSnap = await fdb.collection('irp_players').doc(discordId).get();
      if (playerSnap.exists) {
        window._irpPlayer = playerSnap.data();
      } else {
        window._irpPlayer = { jahartites: 0, consecutive_days: 0 };
      }
      var pitySnap = await fdb.collection('irp_gacha_pity').doc(discordId).get();
      window._irpGachaPity = pitySnap.exists ? pitySnap.data() : { jahartites_spent_leg: 0, jahartites_spent_myth: 0 };
      if (window.PLAYER) {
        window.PLAYER.navarites = window._irpPlayer.jahartites || 0;
        window.PLAYER.consecutive_days = window._irpPlayer.consecutive_days || 0;
      }

      /* Charger bonds */
      var charId = window.CHAR_ID || (window.CHAR && window.CHAR._id);
      if (!charId) {
        if(typeof window._irpInjectJahartiteBalance==='function') window._irpInjectJahartiteBalance();
        if (typeof window.renderPlayerWidgets === 'function') {
          try { window.renderPlayerWidgets(); } catch (_) {}
        }
        if (typeof window.loadWallet === 'function') {
          try { window.loadWallet(); } catch (_) {}
        }
        if (typeof window._refreshCurrentTab === 'function') {
          try { window._refreshCurrentTab(); } catch (_) {}
        }
        return;
      }

      var bondsSnap = await fdb.collection('irp_bonds').where('source_char_id', '==', charId).get();
      window._irpBonds = [];
      bondsSnap.forEach(function (d) { window._irpBonds.push({ _id: d.id, ...d.data() }); });

      /* Seal */
      var sealSnap = await fdb.collection('irp_seals').doc(charId).get();
      window._irpSeal = sealSnap.exists ? { _id: sealSnap.id, ...sealSnap.data() } : null;

      /* Seal targets */
      if (window._irpSeal) {
        var tgtSnap = await fdb.collection('irp_seal_targets').where('owner_char_id', '==', charId).get();
        window._irpSealTargets = [];
        tgtSnap.forEach(function (d) { window._irpSealTargets.push({ _id: d.id, ...d.data() }); });
      }

      /* Court */
      var courtSnap = await fdb.collection('irp_courts').doc(charId).get();
      window._irpCourt = courtSnap.exists ? { _id: courtSnap.id, ...courtSnap.data() } : null;

      /* Flesh marks on me */
      var marksSnap = await fdb.collection('irp_flesh_marks').doc(charId).get();
      window._irpFleshMarks = marksSnap.exists ? (marksSnap.data().marks || []) : [];

      /* Jahartites déjà chargées plus haut pour éviter les retours précoces. */

      /* Resolve character names for bonds */
      window._irpCharNames = {};
      var allBondTargets = (window._irpBonds || []).map(function (b) { return b.target_char_id; }).filter(Boolean);
      var courtMembers = (window._irpCourt || {}).members || [];
      var allIds = [...new Set([...allBondTargets, ...courtMembers])];
      for (var cid of allIds) {
        try {
          var snap = await fdb.collection('irp_characters').doc(cid).get();
          if (snap.exists) {
            var d = snap.data();
            window._irpCharNames[cid] = ((d.first_name || '') + ' ' + (d.last_name || '')).trim() || cid.substring(0, 8);
          } else {
            /* Try normal characters */
            var snap2 = await fdb.collection('characters').doc(cid).get();
            if (snap2.exists) {
              var d2 = snap2.data();
              window._irpCharNames[cid] = ((d2.first_name || '') + ' ' + (d2.last_name || '')).trim() || cid.substring(0, 8);
            }
          }
        } catch (e) { /* skip */ }
      }

      if(typeof window._irpInjectJahartiteBalance==='function') window._irpInjectJahartiteBalance();
      if(typeof window._irpReplaceNavarites==='function') window._irpReplaceNavarites(document.body);
      /* Force re-render of dashboard widgets with correct Jahartites data */
      if (typeof window.renderPlayerWidgets === 'function') {
        try { window.renderPlayerWidgets(); } catch (_) {}
      }
      if (typeof window.loadWallet === 'function') {
        try { window.loadWallet(); } catch (_) {}
      }
      /* Re-render dashboard char to update stats with bonuses */
      if (typeof window.renderDashChar === 'function' && window.CHAR) {
        try { window.renderDashChar(); } catch (_) {}
      }
      if (typeof window._refreshCurrentTab === 'function') {
        try { window._refreshCurrentTab(); } catch (_) {}
      }
    } catch (e) {
      window._dbg?.warn('[IRP HUB] data load:', e.message);
    }
  }

  function _charName(cid) {
    return (window._irpCharNames || {})[cid] || cid.substring(0, 10) + '…';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PHASE 7 — Override Gacha pour IRP (Jahartites + bannières IRP only)
     ══════════════════════════════════════════════════════════════════════════ */

  function overrideGacha() {
    /* Override renderGacha globale */
    window.renderGacha = function () {
      renderIRPGacha();
    };
  }

  async function loadIRPBanners() {
    if (window._irpBanners) return window._irpBanners;
    try {
      var fdb = window._db || db;
      var snap = await fdb.collection('irp_gacha_banners').get();
      window._irpBanners = [];
      snap.forEach(function (d) {
        var data = d.data();
        if (data.active !== false) { /* include if not explicitly disabled */
          window._irpBanners.push({ _id: d.id, ...data });
        }
      });
    } catch (e) {
      window._dbg?.warn('[IRP GACHA] load banners:', e.message);
      window._irpBanners = [];
    }
    return window._irpBanners;
  }

  async function renderIRPGacha() {
    var panel = document.getElementById('panel-gacha');
    if (!panel) return;

    var jah = (window._irpPlayer || {}).jahartites || 0;
    var banners = await loadIRPBanners();

    var h = '';

    /* ── Wallet Jahartites ── */
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;padding:16px;background:var(--surface);border:1px solid rgba(220,20,60,0.15);border-radius:12px;flex-wrap:wrap">';
    h += '<div style="display:flex;align-items:center;gap:12px"><div><img src="https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/icons%2FChatGPT%20Image%2013%20avr.%202026%2C%2018_19_29.png?alt=media&token=ac0476c3-965f-4806-aad0-ee6c917e02cd" alt="Jahartite" style="width:32px;height:32px;object-fit:contain;filter:drop-shadow(0 0 6px rgba(220,20,60,0.4))"></div>';
    h += '<div><div style="font-family:var(--font-h);font-size:1.4rem;color:var(--text)">' + jah.toLocaleString() + '</div>';
    h += '<div style="font-family:var(--font-m);font-size:0.55rem;color:var(--text3);letter-spacing:0.08em">JAHARTITES</div></div></div>';
    h += '<button onclick="localStorage.setItem(&quot;jaharta_irp_mode&quot;,&quot;true&quot;);window.location.href=&quot;gacha-irp.html&quot;" style="padding:10px 14px;border-radius:10px;border:1px solid rgba(220,20,60,.25);background:linear-gradient(135deg,rgba(220,20,60,.18),rgba(139,0,0,.18));color:#fff;font-family:var(--font-h);font-size:.55rem;letter-spacing:.1em;cursor:pointer">OUVRIR LE GACHA IRP</button>';
    h += '</div>';

    /* ── Bannières IRP ── */
    if (banners.length === 0) {
      h += '<div style="text-align:center;padding:60px 20px">';
      h += '<div style="font-size:2.5rem;margin-bottom:16px;opacity:0.3">🎰</div>';
      h += '<div style="font-family:var(--font-h);font-size:0.8rem;color:var(--text3);letter-spacing:0.12em">AUCUNE BANNIÈRE IRP ACTIVE</div>';
      h += '<div style="font-family:var(--font-m);font-size:0.65rem;color:var(--text3);margin-top:8px;opacity:0.6">Les bannières IRP exclusives apparaîtront ici.</div>';
      h += '</div>';
    } else {
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
      banners.forEach(function (b) {
        var name = b.name || 'Bannière IRP';
        var desc = b.description || '';
        var cost = b.cost || 0;
        var img = b.image_url || '';
        var rarity = (b.featured_rarity || 'epic').toLowerCase();
        var rarityColors = {
          common: '#888', uncommon: '#22c55e', rare: '#3b82f6',
          epic: '#a855f7', legendary: '#f59e0b', mythic: '#ef4444',
          unique: '#00bcd4', artifact: '#ff6b35', mastercraft: '#e91e63',
        };
        var color = rarityColors[rarity] || '#dc143c';

        h += '<div style="background:var(--surface);border:1px solid ' + color + '33;border-radius:12px;overflow:hidden">';
        if (img) {
          h += '<div style="height:140px;background:url(' + img + ') center/cover;border-bottom:1px solid ' + color + '22"></div>';
        } else {
          h += '<div style="height:140px;background:linear-gradient(135deg,' + color + '11,' + color + '05);display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:0.3">🎰</div>';
        }
        h += '<div style="padding:16px">';
        h += '<div style="font-family:var(--font-h);font-size:0.75rem;color:var(--text);letter-spacing:0.06em;margin-bottom:4px">' + name + '</div>';
        if (desc) h += '<div style="font-family:var(--font-m);font-size:0.55rem;color:var(--text3);margin-bottom:8px">' + desc + '</div>';
        /* Featured items */
        var featured = b.featured || [];
        if (featured.length > 0) {
          var featHTML = featured.map(function(fid) {
            var fi = (window.ALL_ITEMS_DATA || {})[fid] || {};
            return '<span style="font-size:.5rem;color:' + color + ';background:' + color + '15;border:1px solid ' + color + '30;border-radius:4px;padding:2px 6px;white-space:nowrap">⭐ ' + (fi.name || fid) + '</span>';
          }).join(' ');
          h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">' + featHTML + '</div>';
        }
        /* Item count */
        var totalItems = 0;
        Object.values(b.rarities || {}).forEach(function(rd) { totalItems += (rd.items || []).length; });
        h += '<div style="font-family:var(--font-m);font-size:0.45rem;color:var(--text3);margin-bottom:8px">' + totalItems + ' items dans cette bannière</div>';
        h += '<div style="display:flex;align-items:center;justify-content:space-between">';
        h += '<div style="font-family:var(--font-m);font-size:0.6rem;color:' + color + '"><img src="https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/icons%2FChatGPT%20Image%2013%20avr.%202026%2C%2018_19_29.png?alt=media&token=ac0476c3-965f-4806-aad0-ee6c917e02cd" alt="" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;margin-right:3px"> ' + cost + ' Jahartite</div>';
        h += '<div style="font-family:var(--font-h);font-size:0.4rem;letter-spacing:0.1em;color:' + color + ';text-transform:uppercase;padding:4px 10px;border:1px solid ' + color + '44;border-radius:4px">' + rarity + '</div>';
        h += '</div></div></div>';
      });
      h += '</div>';
    }

    /* ── Pity IRP ── */
    var pity = window._irpGachaPity || { jahartites_spent_leg: 0, jahartites_spent_myth: 0 };
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:24px">';
    h += '<div style="padding:14px;border:1px solid rgba(220,20,60,.15);border-radius:12px;background:var(--surface)"><div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3);letter-spacing:.08em">PITY LEG+</div><div style="font-family:var(--font-h);font-size:1rem;color:var(--text);margin-top:6px">' + Math.floor(pity.jahartites_spent_leg || 0) + ' / 60</div></div>';
    h += '<div style="padding:14px;border:1px solid rgba(220,20,60,.15);border-radius:12px;background:var(--surface)"><div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3);letter-spacing:.08em">PITY MYTH+</div><div style="font-family:var(--font-h);font-size:1rem;color:var(--text);margin-top:6px">' + Math.floor(pity.jahartites_spent_myth || 0) + ' / 180</div></div>';
    h += '<div style="padding:14px;border:1px solid rgba(220,20,60,.15);border-radius:12px;background:var(--surface)"><div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3);letter-spacing:.08em">STREAK</div><div style="font-family:var(--font-h);font-size:1rem;color:var(--text);margin-top:6px">' + (((window._irpPlayer || {}).consecutive_days) || 0) + ' jour(s)</div></div>';
    h += '</div>';

    /* Replace panel content but keep the section header */
    var sh = panel.querySelector('.sh');
    var shHTML = sh ? sh.outerHTML : '<div class="sh"><span class="sh-num">04</span><span class="sh-title">Gacha IRP</span><div class="sh-line"></div></div>';
    panel.innerHTML = shHTML + '<div style="padding:0 4px">' + h + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDERERS
     ══════════════════════════════════════════════════════════════════════════ */

  var GL = { affection: 'Affection', desire: 'Désir', hostility: 'Hostilité', ascendant: 'Ascendant', fixation: 'Fixation' };
  var GC = { affection: '#44BB77', desire: '#E91E8C', hostility: '#CC2222', ascendant: '#8A2E8D', fixation: '#3B3B98' };
  var GS = ['affection', 'desire', 'hostility', 'ascendant', 'fixation'];

  function renderIRPLiens() {
    var c = document.getElementById('irp-liens-container');
    if (!c) return;
    var bonds = window._irpBonds || [];
    if (!bonds.length) { c.innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px">Aucun lien. Utilise le bot IRP.</p>'; return; }

    var h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">';
    bonds.forEach(function (b) {
      var tn = _charName(b.target_char_id);
      h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">';
      h += '<div style="font-family:var(--font-h);font-size:0.7rem;letter-spacing:0.08em;color:var(--text);margin-bottom:12px">→ ' + tn + '</div>';
      GS.forEach(function (g) {
        var v = b[g] || 0; var pct = Math.min(100, v / 10);
        var lk = (b.locks || {})[g] ? ' 🔒' : '';
        h += '<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:0.55rem;color:var(--text2);margin-bottom:2px"><span>' + GL[g] + lk + '</span><span>' + v + '/1000</span></div>';
        h += '<div style="height:4px;background:var(--bg2);border-radius:2px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + GC[g] + ';border-radius:2px;transition:width .3s"></div></div></div>';
      });
      var jc = b.jealousy_context;
      if (jc && (jc.tension || 0) >= 50) h += '<div style="margin-top:8px;font-size:0.5rem;color:#dc143c">⚠️ Tension triangulaire</div>';
      if ((b.corruption || 0) > 0) h += '<div style="margin-top:4px;font-size:0.5rem;color:#8B008B">☠️ Corruption: ' + b.corruption + '</div>';
      h += '</div>';
    });
    h += '</div>';
    c.innerHTML = h;
  }

  function renderIRPCorruption() {
    var c = document.getElementById('irp-corruption-container');
    if (!c) return;
    var bonds = window._irpBonds || [];
    var maxCorr = 0;
    bonds.forEach(function (b) { maxCorr = Math.max(maxCorr, b.corruption || 0); });
    var pct = Math.min(100, maxCorr / 10);
    var TRAITS = [
      { t: 200, n: 'Impitoyable', c: '#cc5555' }, { t: 400, n: 'Cruel', c: '#aa2222' },
      { t: 600, n: 'Obsédé par le contrôle', c: '#8B008B' }, { t: 800, n: 'Dépravé', c: '#4B0000' },
    ];
    var h = '<div style="max-width:600px;margin:24px auto;padding:24px">';
    h += '<div style="text-align:center;margin-bottom:24px"><div style="font-family:var(--font-h);font-size:1.2rem;color:#dc143c;letter-spacing:0.15em;margin-bottom:8px">☠️ CORRUPTION</div>';
    h += '<div style="font-family:var(--font-m);font-size:2rem;color:var(--text)">' + maxCorr + ' / 1000</div></div>';
    h += '<div style="height:12px;background:var(--bg2);border-radius:6px;overflow:hidden;margin-bottom:24px;border:1px solid rgba(220,20,60,0.15)"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#8B008B,#dc143c);border-radius:6px;transition:width .5s"></div></div>';
    TRAITS.forEach(function (t) {
      var on = maxCorr >= t.t;
      h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);opacity:' + (on ? '1' : '.3') + '"><span style="color:' + t.c + ';font-size:1rem">' + (on ? '◆' : '◇') + '</span><span style="font-family:var(--font-b);font-size:.85rem;color:var(--text)">' + t.n + '</span><span style="margin-left:auto;font-family:var(--font-m);font-size:.65rem;color:var(--text3)">' + t.t + '+</span></div>';
    });
    h += '</div>';
    c.innerHTML = h;
  }

  function renderIRPSeal() {
    var c = document.getElementById('irp-seal-container');
    if (!c) return;
    var seal = window._irpSeal;
    var targets = window._irpSealTargets || [];
    var marks = window._irpFleshMarks || [];
    var level = (window.CHAR || {}).level || 0;

    var h = '<div style="max-width:700px;margin:24px auto;padding:16px">';
    if (level < 50) {
      h += '<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:2rem;margin-bottom:12px">👁️</div><div style="font-family:var(--font-h);font-size:.8rem;letter-spacing:.12em">SEAL OF DOMINION</div><div style="font-family:var(--font-m);font-size:.7rem;margin-top:8px">Niveau 50 requis · Actuellement niveau ' + level + '</div></div>';
    } else if (!seal) {
      h += '<div style="text-align:center;padding:40px"><div style="font-size:2rem;margin-bottom:12px">👁️</div><div style="font-family:var(--font-h);font-size:.8rem;color:#dc143c;letter-spacing:.12em">SEAL OF DOMINION</div><div style="font-family:var(--font-m);font-size:.7rem;color:var(--text2);margin-top:8px">Aucun sceau créé. Utilise le bot IRP.</div></div>';
    } else {
      h += '<div style="text-align:center;margin-bottom:24px"><div style="font-family:var(--font-h);font-size:1rem;color:#dc143c;letter-spacing:.12em">👁️ ' + (seal.name || 'Sceau') + '</div>';
      if (seal.description) h += '<div style="font-family:var(--font-body);font-size:.7rem;color:var(--text2);margin-top:4px;font-style:italic">' + seal.description + '</div>';
      h += '</div>';
      if (targets.length > 0) {
        h += '<div style="font-family:var(--font-b);font-size:.75rem;color:var(--text);margin-bottom:12px;letter-spacing:.08em">CIBLES MARQUÉES</div>';
        targets.forEach(function (t) {
          var se = { active: '🟢', inactive: '🟡', revoked: '🔴' }[t.state] || '⚪';
          h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><span>' + se + '</span><div style="flex:1"><div style="font-family:var(--font-b);font-size:.75rem;color:var(--text)">' + _charName(t.target_char_id) + '</div><div style="font-size:.6rem;color:var(--text3)">' + (t.state || '?') + '</div></div></div>';
        });
      }
    }
    if (marks.length > 0) {
      h += '<div style="margin-top:24px;font-family:var(--font-b);font-size:.75rem;color:#dc143c;margin-bottom:12px;letter-spacing:.08em">🔥 MARQUES SUR MOI</div>';
      marks.forEach(function (m) {
        h += '<div style="background:rgba(220,20,60,0.06);border:1px solid rgba(220,20,60,0.15);border-radius:8px;padding:10px;margin-bottom:6px"><span style="font-family:var(--font-b);color:var(--text);font-size:.7rem">🔥 ' + (m.name || '?') + '</span><span style="color:var(--text3);font-size:.6rem;margin-left:8px">' + (m.location || '') + ' — par ' + (m.owner_name || '?') + '</span></div>';
      });
    }
    h += '</div>';
    c.innerHTML = h;
  }

  function renderIRPCour() {
    var c = document.getElementById('irp-cour-container');
    if (!c) return;
    var court = window._irpCourt;
    var h = '<div style="max-width:600px;margin:24px auto;padding:16px">';
    if (!court) {
      h += '<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:2rem;margin-bottom:12px">👑</div><div style="font-family:var(--font-h);font-size:.8rem;letter-spacing:.12em">COUR</div><div style="font-family:var(--font-m);font-size:.7rem;margin-top:8px">Aucune cour. Ascendant ≥ 700 sur 3+ cibles requis.</div></div>';
    } else {
      h += '<div style="text-align:center;margin-bottom:24px"><div style="font-family:var(--font-h);font-size:1rem;color:#dc143c;letter-spacing:.12em">👑 ' + (court.name || 'Cour') + '</div></div>';
      (court.members || []).forEach(function (mcid, i) {
        var rank = ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
        var title = (court.titles || {})[mcid] || '';
        h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><span style="font-size:1.2rem">' + rank + '</span><div style="flex:1"><div style="font-family:var(--font-b);font-size:.75rem;color:var(--text)">' + _charName(mcid) + (title ? ' — ' + title : '') + '</div></div></div>';
      });
    }
    h += '</div>';
    c.innerHTML = h;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════════════ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForHub);
  } else {
    waitForHub();
  }
})();
