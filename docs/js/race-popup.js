/* ═══════════════════════════════════════════════════════════════
   js/race-popup.js — Race detail popups + admin CRUD
   Firestore collection: races_data
   ═══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── Default race data (fallback if Firestore empty) ── */
  var DEFAULT_FIELDS = {
    name: '', plural: '', category: '', longevity: '',
    affinity: '', access: 'Ouverte', description: '',
    baseStats: { str:0, agi:0, spd:0, int:0, mana:0, res:0, cha:0, aura:0 },
    basePowers: []
  };

  /* ── State ── */
  var racesData = {};      // { raceName: { ...fields } }
  var isAdmin = false;
  var db = null;
  var initialized = false;

  /* ── Init — called after Firebase is ready ── */
  window.initRacePopups = function(_db, _isAdmin) {
    db = _db;
    isAdmin = _isAdmin;
    if (!initialized) {
      loadRacesData();
      bindRaceCards();
      initialized = true;
    }
  };

  /* Update admin status (called on auth change) */
  window.updateRaceAdmin = function(v) { isAdmin = v; };

  /* ── Load from Firestore ── */
  function loadRacesData() {
    if (!db || !window._getDocs) return;
    try {
      var q = window._collection(db, 'races_data');
      window._getDocs(q).then(function(snap) {
        snap.forEach(function(d) {
          racesData[d.id] = d.data();
        });
      }).catch(function(e) { window._dbg?.warn('[races]', e.message); });
    } catch(e) { window._dbg?.warn('[races] no firebase'); }
  }

  /* ── Save to Firestore ── */
  function saveRaceData(raceName, data) {
    if (!db || !window._setDoc) return Promise.reject(new Error('No Firebase'));
    return window._setDoc(window._doc(db, 'races_data', raceName), data, { merge: true });
  }

  /* ── Bind click on race cards ── */
  function bindRaceCards() {
    document.querySelectorAll('.race-card').forEach(function(card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        var name = card.querySelector('.race-name')?.textContent?.trim();
        if (name) openRacePopup(name, card.style.getPropertyValue('--rc') || '#00f0ff');
      });
    });
  }

  /* Re-bind after dynamic content */
  window.rebindRaceCards = bindRaceCards;

  /* ── Link type detection helper (shared) ── */
  window.detectLinkType = function(url) {
    if (!url) return { type: 'Lien', icon: '🔗', color: '#8a8fa8' };
    var u = url.toLowerCase();
    if (u.includes('docs.google.com/document')) return { type: 'GDoc', icon: '📄', color: '#4285f4' };
    if (u.includes('docs.google.com/spreadsheet')) return { type: 'GSheet', icon: '📊', color: '#34a853' };
    if (u.includes('docs.google.com/presentation')) return { type: 'GSlide', icon: '📽️', color: '#fbbc04' };
    if (u.includes('sites.google.com')) return { type: 'GSite', icon: '🌐', color: '#ea4335' };
    if (u.includes('drive.google.com')) return { type: 'GDrive', icon: '📁', color: '#4285f4' };
    if (u.includes('notion.so') || u.includes('notion.site')) return { type: 'Notion', icon: '📝', color: '#fff' };
    if (u.endsWith('.pdf') || u.includes('/pdf')) return { type: 'PDF', icon: '📕', color: '#ff3030' };
    if (u.endsWith('.html') || u.endsWith('.htm')) return { type: 'HTML', icon: '🖥️', color: '#00f0ff' };
    if (u.includes('discord.gg') || u.includes('discord.com')) return { type: 'Discord', icon: '💬', color: '#7289da' };
    if (u.includes('imgur.com') || u.includes('.png') || u.includes('.jpg')) return { type: 'Image', icon: '🖼️', color: '#b44aff' };
    return { type: 'Web', icon: '🔗', color: '#00f0ff' };
  };

  /* ── Open Race Popup ── */
  function openRacePopup(raceName, accentColor) {
    var data = racesData[raceName] || {};
    var d = Object.assign({}, DEFAULT_FIELDS, data);
    var accent = accentColor || '#00f0ff';

    // Remove existing popup
    var old = document.getElementById('race-popup-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'race-popup-overlay';
    overlay.className = 'rp-overlay';
    overlay.innerHTML = buildPopupHTML(raceName, d, accent);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function() {
      overlay.classList.add('rp-open');
    });

    // Close handlers
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeRacePopup();
    });
    overlay.querySelector('.rp-close').addEventListener('click', closeRacePopup);

    // Admin save handler
    var saveBtn = overlay.querySelector('.rp-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveFromPopup(raceName, overlay, saveBtn);
      });
    }
  }

  function closeRacePopup() {
    var overlay = document.getElementById('race-popup-overlay');
    if (!overlay) return;
    overlay.classList.remove('rp-open');
    overlay.classList.add('rp-closing');
    setTimeout(function() { overlay.remove(); }, 350);
  }

  /* ── Build Popup HTML ── */
  function buildPopupHTML(name, d, accent) {
    var stats = d.baseStats || {};
    var powers = d.basePowers || [];
    var statNames = ['STR','AGI','SPD','INT','MNA','RES','CHA','AUR'];
    var statKeys = ['str','agi','spd','int','mana','res','cha','aura'];

    var statsHTML = statKeys.map(function(k, i) {
      var v = stats[k] || 0;
      return '<div class="rp-stat"><span class="rp-stat-lbl">' + statNames[i] + '</span><span class="rp-stat-val">' + v + '</span></div>';
    }).join('');

    var powersHTML = powers.length > 0 ?
      powers.map(function(p) {
        return '<div class="rp-power"><span class="rp-power-name" style="color:' + accent + '">' + (p.name||p) + '</span>' +
          (p.desc ? '<span class="rp-power-desc">' + p.desc + '</span>' : '') + '</div>';
      }).join('') : '<div class="rp-power"><span class="rp-power-desc">Aucun pouvoir de base défini</span></div>';

    var accessBadge = d.access === 'Ouverte' ?
      '<span class="rp-access rp-access--open">Ouverte</span>' :
      '<span class="rp-access rp-access--cond">Sous conditions</span>';

    var adminSection = '';
    if (isAdmin) {
      /* Build stat repeater rows */
      var statsRepHTML = '';
      var bs = d.baseStats || {};
      statKeys.forEach(function(k, i) {
        var v = bs[k] || 0;
        statsRepHTML += '<div class="rp-stat-row-ed" data-stat-key="' + k + '">' +
          '<span class="rp-stat-row-lbl">' + statNames[i] + '</span>' +
          '<input class="rp-fi rp-stat-input" type="number" value="' + v + '" data-stat="' + k + '" style="width:70px;text-align:center">' +
          '</div>';
      });

      /* Build power repeater rows */
      var powersRepHTML = '';
      var pw = d.basePowers || [];
      pw.forEach(function(p, i) {
        powersRepHTML += '<div class="rp-power-row-ed" data-power-idx="' + i + '">' +
          '<div class="rp-fg" style="flex:1;margin-bottom:0"><input class="rp-fi" placeholder="Nom du pouvoir" value="' + ((p.name||p||'').replace ? (p.name||p||'').replace(/"/g,'&quot;') : '') + '" data-pk="name"></div>' +
          '<div class="rp-fg" style="flex:2;margin-bottom:0"><input class="rp-fi" placeholder="Description" value="' + ((p.desc||'').replace ? (p.desc||'').replace(/"/g,'&quot;') : '') + '" data-pk="desc"></div>' +
          '<button type="button" class="rp-power-rm" onclick="this.parentElement.remove()" title="Supprimer">✕</button>' +
          '</div>';
      });

      adminSection = '<div class="rp-admin-section">' +
        '<div class="rp-admin-title">✎ Mode Admin</div>' +
        '<div class="rp-admin-grid">' +
          field('rp-ed-name', 'Nomination', d.name || name) +
          field('rp-ed-plural', 'Pluriel', d.plural || name + 's') +
          field('rp-ed-category', 'Catégorie', d.category || '') +
          field('rp-ed-longevity', 'Longévité', d.longevity || '') +
          field('rp-ed-affinity', 'Affinité', d.affinity || '') +
          '<div class="rp-fg"><label class="rp-fl">Accès</label><select class="rp-fi" id="rp-ed-access"><option value="Ouverte"' + (d.access==='Ouverte'?' selected':'') + '>Ouverte</option><option value="Sous conditions"' + (d.access!=='Ouverte'?' selected':'') + '>Sous conditions</option></select></div>' +
        '</div>' +
        '<div class="rp-fg"><label class="rp-fl">Description</label><textarea class="rp-fta" id="rp-ed-desc" rows="3" placeholder="Supporte le **markdown** Discord">' + sanitize(d.description||'') + '</textarea></div>' +
        '<div class="rp-fg"><label class="rp-fl">Stats de base</label><div class="rp-stats-edit-grid" id="rp-stats-edit">' + statsRepHTML + '</div></div>' +
        '<div class="rp-fg"><label class="rp-fl">Pouvoirs de base</label><div id="rp-powers-edit">' + powersRepHTML + '</div>' +
        '<button type="button" class="rp-power-add" onclick="window._addRacePower()">+ Ajouter un pouvoir</button></div>' +
        '<button class="rp-save-btn">▸ Sauvegarder</button>' +
      '</div>';
    }

    return '<div class="rp-popup">' +
      '<div class="rp-scanline"></div>' +
      '<button class="rp-close">✕</button>' +
      '<div class="rp-accent-bar" style="background:linear-gradient(90deg,' + accent + ',' + accent + '40,transparent)"></div>' +
      '<div class="rp-header">' +
        '<div class="rp-icon" style="color:' + accent + ';text-shadow:0 0 16px ' + accent + '">◈</div>' +
        '<div>' +
          '<h2 class="rp-name" style="color:' + accent + '">' + name + '</h2>' +
          '<div class="rp-meta">' + (d.category ? '<span>' + d.category + '</span>' : '') + accessBadge + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rp-body">' +
        '<div class="rp-info-grid">' +
          infoItem('Longévité', d.longevity || '—', accent) +
          infoItem('Affinité', d.affinity || '—', accent) +
          infoItem('Pluriel', d.plural || name + 's', accent) +
          infoItem('Accès', d.access || 'Ouverte', accent) +
        '</div>' +
        (d.description ? '<div class="rp-desc">' + (window.parseDiscordMarkdown ? window.parseDiscordMarkdown(d.description, accent) : d.description) + '</div>' : '') +
        '<div class="rp-section-title" style="border-color:' + accent + '30">Stats de base</div>' +
        '<div class="rp-stats-grid">' + statsHTML + '</div>' +
        '<div class="rp-section-title" style="border-color:' + accent + '30">Pouvoirs de base</div>' +
        '<div class="rp-powers">' + powersHTML + '</div>' +
      '</div>' +
      adminSection +
    '</div>';
  }

  function field(id, label, val) {
    return '<div class="rp-fg"><label class="rp-fl">' + label + '</label><input class="rp-fi" id="' + id + '" value="' + (val||'').replace(/"/g,'&quot;') + '"></div>';
  }
  function infoItem(label, val, accent) {
    return '<div class="rp-info"><span class="rp-info-lbl">' + label + '</span><span class="rp-info-val" style="color:' + accent + '">' + val + '</span></div>';
  }

  /* ── Save from popup ── */
  function saveFromPopup(raceName, overlay, btn) {
    btn.disabled = true;
    btn.textContent = '⟳ Sauvegarde...';

    var data = {
      name: (document.getElementById('rp-ed-name')?.value || raceName).trim(),
      plural: (document.getElementById('rp-ed-plural')?.value || '').trim(),
      category: (document.getElementById('rp-ed-category')?.value || '').trim(),
      longevity: (document.getElementById('rp-ed-longevity')?.value || '').trim(),
      affinity: (document.getElementById('rp-ed-affinity')?.value || '').trim(),
      access: document.getElementById('rp-ed-access')?.value || 'Ouverte',
      description: (document.getElementById('rp-ed-desc')?.value || ''),
    };

    /* Collect stats from repeater inputs */
    var stats = {};
    document.querySelectorAll('[data-stat]').forEach(function(inp) {
      stats[inp.dataset.stat] = parseInt(inp.value) || 0;
    });
    data.baseStats = stats;

    /* Collect powers from repeater rows */
    var powers = [];
    document.querySelectorAll('.rp-power-row-ed').forEach(function(row) {
      var n = row.querySelector('[data-pk="name"]')?.value?.trim() || '';
      var d = row.querySelector('[data-pk="desc"]')?.value?.trim() || '';
      if (n) powers.push({ name: n, desc: d });
    });
    data.basePowers = powers;

    saveRaceData(raceName, data).then(function() {
      racesData[raceName] = data;
      btn.textContent = '✓ Sauvegardé';
      btn.style.borderColor = 'rgba(0,255,136,0.5)';
      btn.style.color = '#00ff88';
      setTimeout(function() {
        btn.disabled = false;
        btn.textContent = '▸ Sauvegarder';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 2000);
    }).catch(function(e) {
      btn.textContent = '⚠ Erreur: ' + e.message;
      btn.style.color = '#ff3030';
      btn.disabled = false;
      setTimeout(function() {
        btn.textContent = '▸ Sauvegarder';
        btn.style.color = '';
      }, 3000);
    });
  }

  /* ── Add power row helper ── */
  window._addRacePower = function() {
    var container = document.getElementById('rp-powers-edit');
    if (!container) return;
    var idx = container.querySelectorAll('.rp-power-row-ed').length;
    container.insertAdjacentHTML('beforeend',
      '<div class="rp-power-row-ed" data-power-idx="' + idx + '">' +
      '<div class="rp-fg" style="flex:1;margin-bottom:0"><input class="rp-fi" placeholder="Nom du pouvoir" data-pk="name"></div>' +
      '<div class="rp-fg" style="flex:2;margin-bottom:0"><input class="rp-fi" placeholder="Description" data-pk="desc"></div>' +
      '<button type="button" class="rp-power-rm" onclick="this.parentElement.remove()" title="Supprimer">✕</button>' +
      '</div>'
    );
  };

  /* ── Inject CSS ── */
  var style = document.createElement('style');
  style.textContent = [
    '.rp-overlay{position:fixed;inset:0;z-index:10000;background:rgba(6,6,12,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .35s;pointer-events:none}',
    '.rp-overlay.rp-open{opacity:1;pointer-events:all}',
    '.rp-overlay.rp-closing{opacity:0;pointer-events:none}',
    '.rp-popup{position:relative;background:rgba(10,10,20,0.95);border:1px solid rgba(0,240,255,0.15);border-radius:8px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;transform:scale(0.95) translateY(20px);transition:transform .35s cubic-bezier(0.16,1,0.3,1);scrollbar-width:thin;scrollbar-color:rgba(0,240,255,0.3) transparent}',
    '.rp-open .rp-popup{transform:scale(1) translateY(0)}',
    '.rp-closing .rp-popup{animation:rpCloseGlitch .35s ease-in forwards}',
    '@keyframes rpCloseGlitch{0%{transform:scale(1) translateY(0);opacity:1;filter:blur(0)}15%{transform:scale(1) translateX(-5px);filter:blur(0)}30%{transform:scale(1) translateX(3px);opacity:.85;filter:blur(1px)}55%{transform:scale(.98) translateY(8px) skewX(-1deg);opacity:.5;filter:blur(2px)}100%{transform:scale(.9) translateY(30px);opacity:0;filter:blur(6px)}}',
    '.rp-scanline{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,240,255,0.15),transparent);animation:rpScan 4s linear infinite;pointer-events:none;z-index:10}',
    '@keyframes rpScan{0%{top:-2px}100%{top:100%}}',
    '.rp-close{position:absolute;top:16px;right:16px;background:none;border:1px solid rgba(0,240,255,0.2);color:#8a8fa8;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.9rem;border-radius:4px;transition:color .2s,border-color .2s;z-index:11}',
    '.rp-close:hover{color:#ff006e;border-color:rgba(255,0,110,0.4)}',
    '.rp-accent-bar{height:2px;border-radius:8px 8px 0 0}',
    '.rp-header{display:flex;align-items:center;gap:16px;padding:24px 24px 0}',
    '.rp-icon{font-size:2rem;flex-shrink:0}',
    ".rp-name{font-family:'Orbitron',sans-serif;font-weight:800;font-size:1.2rem;letter-spacing:.15em}",
    ".rp-meta{display:flex;gap:8px;margin-top:4px;font-family:'Rajdhani',sans-serif;font-size:.65rem;font-weight:500;color:#8a8fa8}",
    '.rp-access{padding:2px 10px;border-radius:3px;font-size:.58rem;letter-spacing:.1em}',
    '.rp-access--open{color:#00ff88;border:1px solid rgba(0,255,136,0.3);background:rgba(0,255,136,0.06)}',
    '.rp-access--cond{color:#ffd60a;border:1px solid rgba(255,214,10,0.3);background:rgba(255,214,10,0.06)}',
    '.rp-body{padding:20px 24px 24px}',
    '.rp-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}',
    '.rp-info{background:rgba(0,240,255,0.03);border:1px solid rgba(0,240,255,0.08);border-radius:4px;padding:10px 14px}',
    ".rp-info-lbl{display:block;font-family:'Rajdhani',sans-serif;font-size:.55rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#4a4e66;margin-bottom:2px}",
    ".rp-info-val{font-family:'Rajdhani',sans-serif;font-size:.85rem;font-weight:600}",
    ".rp-desc{font-family:'Exo 2',sans-serif;font-size:.88rem;font-weight:300;color:#8a8fa8;line-height:1.7;margin-bottom:20px;padding:14px;border-left:2px solid rgba(0,240,255,0.15);background:rgba(0,240,255,0.02);border-radius:0 4px 4px 0}",
    ".rp-section-title{font-family:'Orbitron',sans-serif;font-size:.6rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#8a8fa8;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid}",
    '.rp-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}',
    '.rp-stat{text-align:center;background:rgba(0,240,255,0.03);border:1px solid rgba(0,240,255,0.06);border-radius:4px;padding:8px 4px}',
    ".rp-stat-lbl{display:block;font-family:'Rajdhani',sans-serif;font-size:.48rem;font-weight:500;letter-spacing:.1em;color:#4a4e66}",
    ".rp-stat-val{display:block;font-family:'Orbitron',sans-serif;font-size:.9rem;font-weight:800;color:var(--cyan,#00f0ff)}",
    '.rp-powers{display:flex;flex-direction:column;gap:6px;margin-bottom:20px}',
    '.rp-power{padding:8px 12px;border-left:2px solid rgba(0,240,255,0.2);background:rgba(0,240,255,0.02);border-radius:0 4px 4px 0}',
    ".rp-power-name{font-family:'Rajdhani',sans-serif;font-size:.82rem;font-weight:600}",
    ".rp-power-desc{display:block;font-family:'Exo 2',sans-serif;font-size:.75rem;font-weight:300;color:#8a8fa8;margin-top:2px}",
    /* Admin section */
    '.rp-admin-section{border-top:1px solid rgba(0,240,255,0.1);margin:0 24px 24px;padding-top:20px}',
    ".rp-admin-title{font-family:'Orbitron',sans-serif;font-size:.6rem;font-weight:600;letter-spacing:.2em;color:var(--cyan,#00f0ff);margin-bottom:14px}",
    '.rp-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}',
    ".rp-fg{margin-bottom:8px}",
    ".rp-fl{display:block;font-family:'Rajdhani',sans-serif;font-size:.55rem;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#4a4e66;margin-bottom:4px}",
    ".rp-fi,.rp-fta{width:100%;background:rgba(0,240,255,0.03);border:1px solid rgba(0,240,255,0.12);border-radius:3px;color:#e8eaf0;font-family:'Rajdhani',sans-serif;font-size:.82rem;padding:8px 10px;outline:none;transition:border-color .2s;box-sizing:border-box}",
    '.rp-fi:focus,.rp-fta:focus{border-color:var(--cyan,#00f0ff);box-shadow:0 0 8px rgba(0,240,255,0.08)}',
    ".rp-fta{resize:vertical;min-height:60px;font-family:'Exo 2',sans-serif;font-size:.8rem}",
    ".rp-mono{font-family:'Rajdhani',sans-serif;font-size:.7rem}",
    ".rp-save-btn{width:100%;font-family:'Rajdhani',sans-serif;font-size:.75rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#06060c;background:linear-gradient(135deg,var(--cyan,#00f0ff),#80ffea);border:none;border-radius:3px;padding:12px;cursor:pointer;transition:background .3s,box-shadow .3s;margin-top:8px}",
    '.rp-save-btn:hover{background:#fff;box-shadow:0 0 20px rgba(0,240,255,0.3)}',
    '.rp-save-btn:disabled{opacity:0.5;cursor:not-allowed}',
    /* Stat editor grid */
    '.rp-stats-edit-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
    '.rp-stat-row-ed{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(0,240,255,0.02);border:1px solid rgba(0,240,255,0.06);border-radius:4px;padding:8px 4px}',
    ".rp-stat-row-lbl{font-family:'Rajdhani',sans-serif;font-size:.5rem;font-weight:600;letter-spacing:.1em;color:#4a4e66}",
    ".rp-stat-input{font-family:'Orbitron',sans-serif;font-weight:700;font-size:.85rem;color:var(--cyan,#00f0ff);background:rgba(0,240,255,0.03);border:1px solid rgba(0,240,255,0.12);border-radius:3px;padding:6px 4px}",
    /* Power editor rows */
    '.rp-power-row-ed{display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px 10px;background:rgba(0,240,255,0.02);border:1px solid rgba(0,240,255,0.06);border-radius:4px}',
    ".rp-power-rm{width:26px;height:26px;flex-shrink:0;border:1px solid rgba(255,0,110,0.15);background:rgba(255,0,110,0.04);border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:rgba(255,0,110,0.4);transition:border-color .2s,color .2s,background .2s}",
    '.rp-power-rm:hover{border-color:rgba(255,0,110,0.5);color:#ff006e;background:rgba(255,0,110,0.1)}',
    ".rp-power-add{width:100%;margin-top:6px;padding:8px;border:1px dashed rgba(0,240,255,0.12);border-radius:4px;background:transparent;color:#4a4e66;font-family:'Rajdhani',sans-serif;font-size:.72rem;letter-spacing:.1em;cursor:pointer;transition:border-color .2s,color .2s,background .2s}",
    '.rp-power-add:hover{border-color:rgba(0,240,255,0.3);color:var(--cyan,#00f0ff);background:rgba(0,240,255,0.02)}',
    '@media(max-width:560px){.rp-stats-grid{grid-template-columns:repeat(4,1fr)}.rp-admin-grid{grid-template-columns:1fr}.rp-info-grid{grid-template-columns:1fr}}',
  ].join('\n');
  document.head.appendChild(style);

})();
