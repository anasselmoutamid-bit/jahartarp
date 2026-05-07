/* ═══════════════════════════════════════════════════════════════════════
   hub-skill-tree.js — Onglet "Compétences" du hub
   - Charge data/skill-trees/{race}.json (statique)
   - Rend l'arbre en SVG : pan + zoom + minimap + side panel
   - Allocation côté site : transaction Firestore atomique
       characters/{id}: pc_spent + skill_tree_unlocked + stats.{X} + golden_eggs
   - Paliers : modal de choix d'un pouvoir racial dans le pool ANY (pour humans)
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Mapping site (str/agi/...) → bot Firestore (strength/agility/...) */
  const STAT_KEY_MAP = {
    str: 'strength', agi: 'agility', spd: 'speed',
    int: 'intelligence', mana: 'mana',
    res: 'resistance', cha: 'charisma',
  };
  const STAT_LABELS = {
    str: 'STR', agi: 'AGI', spd: 'SPD',
    int: 'INT', mana: 'MNA', res: 'RES', cha: 'CHA',
  };
  /* Race → fichier JSON */
  const RACE_FILES = {
    'Human': 'data/skill-trees/human.json',
    /* d'autres races plus tard */
  };

  /* ─── State ─── */
  let TREE = null;                  // contenu de human.json
  let CASE_BY_ID = {};              // index pour lookup rapide
  let SELECTED_ID = null;
  let pan = { x: 0, y: 0 };
  let zoom = 1;
  let dragState = null;             // {startX, startY, panStartX, panStartY}
  let RACIAL_POWERS_CACHE = null;   // chargé à la demande pour les paliers

  const VIEWPORT_PADDING = 80;
  const ZOOM_MIN = 0.3, ZOOM_MAX = 2.5;

  /* ─── Public render entry point (appelé par hub-core.js LAZY) ─── */
  window.renderSkillTree = async function renderSkillTree() {
    const panel = document.getElementById('panel-skilltree');
    if (!panel) return;
    if (typeof CHAR === 'undefined' || !CHAR) {
      panel.innerHTML = '<div class="st-loading"><div class="st-loading-spinner"></div><div class="st-loading-text">Personnage non chargé</div></div>';
      return;
    }

    /* Charge l'arbre selon la race du personnage */
    const race = (CHAR.race || CHAR.race_specific || 'Human');
    if (!TREE) {
      panel.innerHTML = '<div class="st-loading"><div class="st-loading-spinner"></div><div class="st-loading-text">Chargement de l\'arbre…</div></div>';
      try {
        const file = RACE_FILES[race] || RACE_FILES['Human'];
        const res = await fetch(file, { cache: 'force-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        TREE = await res.json();
        CASE_BY_ID = Object.fromEntries(TREE.cases.map(c => [c.id, c]));
      } catch (e) {
        panel.innerHTML = '<div class="st-loading"><div class="st-loading-text" style="color:var(--red)">Erreur chargement arbre : ' + (e.message || e) + '</div></div>';
        return;
      }
    }

    /* Centre sur l'origine au premier rendu */
    if (zoom === 1 && pan.x === 0 && pan.y === 0) {
      const w = panel.clientWidth || 1200;
      const h = (panel.clientHeight || 700) - 60;
      pan = { x: (w * 0.5) - 170 /* offset side panel */, y: h * 0.5 };
    }

    panel.innerHTML = buildLayoutHTML();
    bindInteractions(panel);
    renderTreeSVG();
    updateTopbar();
    renderSidePanel();
    renderMinimap();
  };

  /* ═══ Layout HTML ═══ */
  function buildLayoutHTML() {
    return ''
      + '<div class="st-topbar">'
      +   '<div class="st-topbar-title">Compétences</div>'
      +   '<div class="st-stat-pill cyan"><span class="st-pill-lbl">PC dispo</span><span class="st-pill-val" id="st-pc-available">0</span></div>'
      +   '<div class="st-stat-pill"><span class="st-pill-lbl">PC dépensés</span><span class="st-pill-val" id="st-pc-spent">0</span></div>'
      +   '<div class="st-stat-pill gold"><span class="st-pill-lbl">XP cumulés</span><span class="st-pill-val" id="st-xp">0</span></div>'
      +   '<div class="st-progress-wrap" title="Prochain PC à 1000 caractères">'
      +     '<div class="st-progress-fill" id="st-progress-fill"></div>'
      +     '<div class="st-progress-label" id="st-progress-label">— / 1000</div>'
      +   '</div>'
      +   '<div class="st-stat-pill violet"><span class="st-pill-lbl">Cases débloquées</span><span class="st-pill-val" id="st-unlocked-count">0 / ' + (TREE.cases.length) + '</span></div>'
      + '</div>'
      + '<div class="st-layout">'
      +   '<div class="st-viewport" id="st-viewport">'
      +     '<svg class="st-svg" id="st-svg" xmlns="http://www.w3.org/2000/svg"></svg>'
      +     '<div class="st-zoom-ctrl">'
      +       '<button class="st-zoom-btn" id="st-zoom-in" title="Zoomer">+</button>'
      +       '<button class="st-zoom-btn" id="st-zoom-out" title="Dézoomer">−</button>'
      +       '<button class="st-zoom-btn" id="st-zoom-reset" title="Recentrer">⊙</button>'
      +     '</div>'
      +     '<div class="st-legend">'
      +       '<div class="st-legend-item"><div class="st-legend-dot body"></div>Voie du Corps</div>'
      +       '<div class="st-legend-item"><div class="st-legend-dot mind"></div>Voie de l\'Esprit</div>'
      +       '<div class="st-legend-item"><div class="st-legend-dot soul"></div>Voie de l\'Âme</div>'
      +       '<div class="st-legend-item"><div class="st-legend-dot egg"></div>Golden Egg</div>'
      +       '<div class="st-legend-item"><div class="st-legend-dot pal"></div>Palier</div>'
      +     '</div>'
      +     '<div class="st-minimap" id="st-minimap" title="Cliquer pour recentrer">'
      +       '<div class="st-minimap-label">Carte</div>'
      +       '<svg id="st-minimap-svg" xmlns="http://www.w3.org/2000/svg"></svg>'
      +     '</div>'
      +   '</div>'
      +   '<div class="st-side" id="st-side">'
      +     '<div class="st-side-empty">Sélectionne une case pour voir ses détails et la débloquer.</div>'
      +   '</div>'
      + '</div>';
  }

  /* ═══ Interactions : pan, zoom, click ═══ */
  function bindInteractions(panel) {
    const vp = panel.querySelector('#st-viewport');
    const svg = panel.querySelector('#st-svg');

    /* Pan : mousedown + drag */
    vp.addEventListener('mousedown', (e) => {
      if (e.target.closest('.st-node, .st-zoom-btn, .st-minimap')) return;
      dragState = { startX: e.clientX, startY: e.clientY, panStartX: pan.x, panStartY: pan.y };
      vp.classList.add('panning');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragState) return;
      pan.x = dragState.panStartX + (e.clientX - dragState.startX);
      pan.y = dragState.panStartY + (e.clientY - dragState.startY);
      applyTransform();
      updateMinimapViewport();
    });
    window.addEventListener('mouseup', () => {
      if (dragState) {
        dragState = null;
        vp.classList.remove('panning');
      }
    });

    /* Zoom : wheel autour du curseur */
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      const ratio = newZoom / zoom;
      pan.x = cx - (cx - pan.x) * ratio;
      pan.y = cy - (cy - pan.y) * ratio;
      zoom = newZoom;
      applyTransform();
      updateMinimapViewport();
    }, { passive: false });

    /* Click sur node */
    svg.addEventListener('click', (e) => {
      const node = e.target.closest('.st-node');
      if (!node) return;
      SELECTED_ID = node.dataset.id;
      svg.querySelectorAll('.st-node.selected').forEach(n => n.classList.remove('selected'));
      node.classList.add('selected');
      renderSidePanel();
    });

    /* Boutons zoom */
    panel.querySelector('#st-zoom-in').addEventListener('click', () => zoomBy(1.25));
    panel.querySelector('#st-zoom-out').addEventListener('click', () => zoomBy(1 / 1.25));
    panel.querySelector('#st-zoom-reset').addEventListener('click', () => {
      zoom = 1;
      const w = vp.clientWidth || 1200, h = vp.clientHeight || 700;
      pan = { x: w * 0.5, y: h * 0.5 };
      applyTransform();
      updateMinimapViewport();
    });

    /* Minimap : click → recentre sur le point cliqué */
    panel.querySelector('#st-minimap').addEventListener('click', (e) => {
      const mm = e.currentTarget;
      const rect = mm.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const bb = computeBBox();
      const tx = bb.minX + px * (bb.maxX - bb.minX);
      const ty = bb.minY + py * (bb.maxY - bb.minY);
      const w = vp.clientWidth, h = vp.clientHeight;
      pan = { x: w * 0.5 - tx * zoom, y: h * 0.5 - ty * zoom };
      applyTransform();
      updateMinimapViewport();
    });
  }

  function zoomBy(factor) {
    const vp = document.getElementById('st-viewport');
    const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    const ratio = newZoom / zoom;
    pan.x = cx - (cx - pan.x) * ratio;
    pan.y = cy - (cy - pan.y) * ratio;
    zoom = newZoom;
    applyTransform();
    updateMinimapViewport();
  }

  function applyTransform() {
    const g = document.getElementById('st-svg-content');
    if (g) g.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${zoom})`);
  }

  /* ═══ Rendu SVG du tree ═══ */
  function renderTreeSVG() {
    const svg = document.getElementById('st-svg');
    if (!svg) return;
    const unlocked = new Set(CHAR.skill_tree_unlocked || ['h-origin']);

    /* On commence toujours par déduire l'origine */
    if (!unlocked.has('h-origin')) unlocked.add('h-origin');

    /* Chaque case : son state */
    function stateOf(c) {
      if (unlocked.has(c.id)) return 'unlocked';
      if ((c.requires || []).every(r => unlocked.has(r))) return 'ready';
      return 'locked';
    }

    /* Edges : on dessine depuis chaque case vers ses requires */
    let edges = '';
    for (const c of TREE.cases) {
      for (const reqId of (c.requires || [])) {
        const req = CASE_BY_ID[reqId];
        if (!req) continue;
        const cls = unlocked.has(c.id) ? 'unlocked'
                  : (unlocked.has(reqId) ? 'ready' : 'locked');
        const branchColor = branchColor_(c.branch);
        edges += `<line class="st-edge ${cls}" x1="${req.pos.x}" y1="${req.pos.y}" x2="${c.pos.x}" y2="${c.pos.y}" stroke="${branchColor}"/>`;
      }
    }

    /* Nodes : hexagones */
    let nodes = '';
    for (const c of TREE.cases) {
      const st = stateOf(c);
      const size = (c.type === 'origin' ? 26 : c.type === 'palier' ? 24 : 14);
      const color = branchColor_(c.branch, c.type);
      const hex = hexPath(c.pos.x, c.pos.y, size);
      const icon = iconFor(c);
      nodes += `<g class="st-node ${c.type} ${st}" data-id="${c.id}" style="--rc:${color}">`
            +    `<path class="st-node-hex" d="${hex}"/>`
            +    `<text class="st-node-icon" x="${c.pos.x}" y="${c.pos.y}">${icon}</text>`
            +  `</g>`;
    }

    /* Group avec transform pour pan+zoom */
    svg.innerHTML = `<g id="st-svg-content" transform="translate(${pan.x},${pan.y}) scale(${zoom})">${edges}${nodes}</g>`;
  }

  /* ─── Helpers ─── */
  function branchColor_(branch, type) {
    if (type === 'egg') return '#ffd60a';
    return ({
      body: '#FF4757', mind: '#4DA3FF', soul: '#ffe066',
      core: '#00e5ff',
    })[branch] || '#c0d0ff';
  }
  function iconFor(c) {
    if (c.type === 'origin') return '⊙';
    if (c.type === 'egg')    return '◆';
    if (c.type === 'palier') return '★';
    /* Stat case : la stat dominante en lettre */
    const eff = c.effects || {};
    const stat = Object.entries(eff).sort((a,b) => b[1]-a[1])[0];
    return stat ? STAT_LABELS[stat[0]].slice(0,1) : '·';
  }
  function hexPath(cx, cy, r) {
    /* Hexagone pointe vers le haut */
    let d = '';
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d + 'Z';
  }
  function computeBBox() {
    if (!TREE || !TREE.cases.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of TREE.cases) {
      if (c.pos.x < minX) minX = c.pos.x;
      if (c.pos.y < minY) minY = c.pos.y;
      if (c.pos.x > maxX) maxX = c.pos.x;
      if (c.pos.y > maxY) maxY = c.pos.y;
    }
    return { minX: minX - VIEWPORT_PADDING, minY: minY - VIEWPORT_PADDING,
             maxX: maxX + VIEWPORT_PADDING, maxY: maxY + VIEWPORT_PADDING };
  }

  /* ═══ Top bar (PC, XP, progress) ═══ */
  function updateTopbar() {
    const xp = Number(CHAR.xp || 0);
    const pcEarned = Math.floor(xp / 1000);
    const pcSpent = Number(CHAR.pc_spent || 0);
    const pcAvail = Math.max(0, pcEarned - pcSpent);
    const unlockedCount = (CHAR.skill_tree_unlocked || ['h-origin']).length;

    const $ = (id) => document.getElementById(id);
    if ($('st-pc-available')) $('st-pc-available').textContent = pcAvail;
    if ($('st-pc-spent'))     $('st-pc-spent').textContent     = pcSpent;
    if ($('st-xp'))           $('st-xp').textContent           = xp.toLocaleString('fr-FR');
    if ($('st-unlocked-count'))$('st-unlocked-count').textContent = unlockedCount + ' / ' + TREE.cases.length;

    const remaining = xp % 1000;
    if ($('st-progress-fill'))  $('st-progress-fill').style.width = (remaining / 10) + '%';
    if ($('st-progress-label')) $('st-progress-label').textContent = remaining + ' / 1000 chars';
  }

  /* ═══ Side panel ═══ */
  function renderSidePanel() {
    const side = document.getElementById('st-side');
    if (!side) return;
    if (!SELECTED_ID || !CASE_BY_ID[SELECTED_ID]) {
      side.innerHTML = '<div class="st-side-empty">Sélectionne une case pour voir ses détails et la débloquer.</div>';
      return;
    }
    const c = CASE_BY_ID[SELECTED_ID];
    const unlocked = new Set(CHAR.skill_tree_unlocked || ['h-origin']);
    const isUnlocked = unlocked.has(c.id);
    const prereqMet  = (c.requires || []).every(r => unlocked.has(r));
    const xp = Number(CHAR.xp || 0);
    const pcEarned = Math.floor(xp / 1000);
    const pcAvail = Math.max(0, pcEarned - Number(CHAR.pc_spent || 0));
    const enoughPC = pcAvail >= c.cost_pc;

    const branchLabel = c.branch === 'body' ? 'Voie du Corps'
                      : c.branch === 'mind' ? "Voie de l'Esprit"
                      : c.branch === 'soul' ? "Voie de l'Âme"
                      : 'Origine';
    const tagLine = c.type === 'palier'
                    ? `Palier · ${branchLabel}`
                    : c.type === 'egg'
                      ? `Récompense · ${branchLabel}`
                      : c.type === 'origin'
                        ? 'Point de départ'
                        : `Tier ${c.tier} · ${branchLabel}`;
    const name = c.type === 'palier' ? c.palier_name
               : c.type === 'origin' ? 'Origine du parcours'
               : c.type === 'egg'    ? `Cache de ${c.eggs} Golden Egg${c.eggs>1?'s':''}`
               : `Augmentation ${c.id.split('-').pop().toUpperCase()}`;

    let html = `<div class="st-side-tag" style="--rc:${branchColor_(c.branch,c.type)}">${tagLine}</div>`;
    html    += `<div class="st-side-name" style="--rc:${branchColor_(c.branch,c.type)}">${name}</div>`;
    if (c.palier_desc) html += `<div class="st-side-sub">${c.palier_desc}</div>`;
    if (c.desc)        html += `<div class="st-side-sub">${c.desc}</div>`;

    /* Effets (stats) */
    if (c.effects && Object.keys(c.effects).length) {
      html += '<div class="st-side-section"><div class="st-side-section-title">Bonus appliqués</div><div class="st-effects">';
      for (const [stat, amt] of Object.entries(c.effects)) {
        html += `<div class="st-effect" style="--rc:${branchColor_(c.branch,c.type)}"><span class="st-effect-lbl">${STAT_LABELS[stat]||stat}</span><span class="st-effect-val">+${amt}</span></div>`;
      }
      html += '</div></div>';
    }
    if (c.eggs) {
      html += '<div class="st-side-section"><div class="st-side-section-title">Récompense</div><div class="st-effects">';
      html += `<div class="st-effect egg"><span class="st-effect-lbl">Golden Eggs</span><span class="st-effect-val">+${c.eggs}</span></div>`;
      html += '</div></div>';
    }

    /* Prereq */
    if (c.requires && c.requires.length && c.type !== 'origin') {
      html += '<div class="st-side-section"><div class="st-side-section-title">Prérequis</div><div class="st-prereq-list">';
      for (const r of c.requires) {
        const ok = unlocked.has(r);
        const pr = CASE_BY_ID[r];
        const label = pr ? `${pr.id} (${pr.type === 'palier' ? pr.palier_name : 'tier ' + (pr.tier ?? '?')})` : r;
        html += `<div class="st-prereq ${ok?'met':'miss'}">${label}</div>`;
      }
      html += '</div></div>';
    }

    /* Action */
    html += '<div class="st-side-action">';
    if (isUnlocked) {
      html += '<div class="st-status-line done">✓ Déjà débloquée</div>';
    } else if (!prereqMet) {
      html += '<button class="st-btn-unlock" disabled><span>Prérequis non remplis</span></button>';
    } else if (!enoughPC) {
      html += `<button class="st-btn-unlock" disabled><kbd>${c.cost_pc} PC</kbd><span>PC insuffisants (dispo : ${pcAvail})</span></button>`;
    } else {
      html += `<button class="st-btn-unlock" id="st-btn-unlock-action"><kbd>${c.cost_pc} PC</kbd><span>${c.type==='palier'?'Choisir un pouvoir':'Débloquer'}</span></button>`;
    }
    html += '</div>';

    side.innerHTML = html;
    const btn = document.getElementById('st-btn-unlock-action');
    if (btn) btn.addEventListener('click', () => onUnlockClick(c));
  }

  /* ═══ Action de déblocage ═══ */
  async function onUnlockClick(c) {
    if (c.type === 'palier') {
      openPalierModal(c);
      return;
    }
    await commitUnlock(c, null);
  }

  async function commitUnlock(c, palierPowerId) {
    const btn = document.getElementById('st-btn-unlock-action');
    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Sauvegarde…'; }
    try {
      const update = {
        skill_tree_unlocked: firebase.firestore.FieldValue.arrayUnion(c.id),
        pc_spent:           firebase.firestore.FieldValue.increment(c.cost_pc),
        updated_at:         firebase.firestore.FieldValue.serverTimestamp(),
      };
      /* Stats */
      for (const [stat, amount] of Object.entries(c.effects || {})) {
        const botKey = STAT_KEY_MAP[stat] || stat;
        update['stats.' + botKey] = firebase.firestore.FieldValue.increment(amount);
      }
      /* Eggs */
      if (c.eggs) {
        update.golden_eggs = firebase.firestore.FieldValue.increment(c.eggs);
      }
      /* Palier slot : on ajoute le power_id choisi (ou null) */
      if (c.type === 'palier') {
        update.skill_tree_palier_slots = firebase.firestore.FieldValue.arrayUnion(palierPowerId || null);
      }

      await db.collection(C.CHARS).doc(CHAR_ID).update(update);

      /* Mise à jour locale optimiste pour UI réactive */
      CHAR.skill_tree_unlocked = [...(CHAR.skill_tree_unlocked || []), c.id];
      CHAR.pc_spent = Number(CHAR.pc_spent || 0) + c.cost_pc;
      CHAR.stats = CHAR.stats || {};
      for (const [stat, amount] of Object.entries(c.effects || {})) {
        const botKey = STAT_KEY_MAP[stat] || stat;
        CHAR.stats[botKey] = Number(CHAR.stats[botKey] || 0) + amount;
      }
      if (c.eggs) CHAR.golden_eggs = Number(CHAR.golden_eggs || 0) + c.eggs;
      if (c.type === 'palier') {
        CHAR.skill_tree_palier_slots = [...(CHAR.skill_tree_palier_slots || []), palierPowerId || null];
      }

      /* Re-render */
      renderTreeSVG();
      updateTopbar();
      renderSidePanel();
      renderMinimap();

      if (typeof showToast === 'function') showToast(c.type==='palier'?'Palier activé !':'Débloqué', 'success');
    } catch (e) {
      window._dbg?.error?.('[skill-tree] unlock error', e);
      if (typeof showToast === 'function') showToast('Erreur : ' + (e.code || e.message || 'unknown'), 'error');
      if (btn) { btn.disabled = false; renderSidePanel(); }
    }
  }

  /* ═══ Modal palier (choix pouvoir racial) ═══ */
  async function openPalierModal(c) {
    /* Charge la liste des pouvoirs raciaux (Firestore config/racial_powers, mirroir du bot) */
    if (!RACIAL_POWERS_CACHE) {
      try {
        const snap = await db.collection('config').doc('racial_powers').get();
        const data = snap.exists ? snap.data() : null;
        if (data) {
          RACIAL_POWERS_CACHE = Object.entries(data)
            .filter(([k, v]) => k !== '_meta' && typeof v === 'object')
            .map(([k, v]) => Object.assign({ id: k }, v));
        } else {
          RACIAL_POWERS_CACHE = [];
        }
      } catch (e) {
        window._dbg?.warn?.('[skill-tree] racial_powers fetch:', e.message);
        RACIAL_POWERS_CACHE = [];
      }
    }

    const modal = document.createElement('div');
    modal.className = 'st-palier-modal';
    let powersHtml = '';
    if (!RACIAL_POWERS_CACHE.length) {
      powersHtml = '<div class="st-side-empty">Aucun pouvoir racial disponible. Le palier sera activé sans pouvoir attaché — il pourra être assigné plus tard.</div>';
    } else {
      powersHtml = '<div class="st-power-grid">'
        + RACIAL_POWERS_CACHE.map(p => (
            `<div class="st-power-card" data-power="${p.id}">`
            + `<div class="st-power-name">${p.name||p.id}</div>`
            + `<div class="st-power-type">${p.type||'—'}</div>`
            + `<div class="st-power-desc">${p.desc||''}</div>`
            + `</div>`
          )).join('')
        + '</div>';
    }
    modal.innerHTML = ''
      + '<div class="st-palier-modal-box">'
      +   `<div class="st-palier-modal-title">★ ${c.palier_name||'Palier'}</div>`
      +   `<div class="st-palier-modal-sub">${c.palier_desc||'Choisis un pouvoir racial à attacher à ce slot. Cette décision est définitive.'}</div>`
      +   powersHtml
      +   '<div class="st-palier-modal-actions">'
      +     '<button class="st-palier-modal-cancel" id="st-pal-cancel">Annuler</button>'
      +     (RACIAL_POWERS_CACHE.length ? '' : '<button class="st-btn-unlock" style="--rc:#b06eff" id="st-pal-confirm-empty"><span>Activer sans pouvoir</span></button>')
      +   '</div>'
      + '</div>';
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    const close = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 350);
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#st-pal-cancel').addEventListener('click', close);
    if (RACIAL_POWERS_CACHE.length) {
      modal.querySelectorAll('.st-power-card').forEach(card => {
        card.addEventListener('click', async () => {
          close();
          await commitUnlock(c, card.dataset.power);
        });
      });
    } else {
      modal.querySelector('#st-pal-confirm-empty')?.addEventListener('click', async () => {
        close();
        await commitUnlock(c, null);
      });
    }
  }

  /* ═══ Minimap ═══ */
  function renderMinimap() {
    const mm = document.getElementById('st-minimap-svg');
    if (!mm || !TREE) return;
    const bb = computeBBox();
    const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
    mm.setAttribute('viewBox', `${bb.minX} ${bb.minY} ${w} ${h}`);
    mm.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const unlocked = new Set(CHAR.skill_tree_unlocked || ['h-origin']);
    let dots = '';
    for (const c of TREE.cases) {
      const fill = unlocked.has(c.id) ? branchColor_(c.branch, c.type) : '#34405a';
      const r = c.type === 'palier' ? 14 : c.type === 'origin' ? 18 : 7;
      dots += `<circle cx="${c.pos.x}" cy="${c.pos.y}" r="${r}" fill="${fill}" opacity="${unlocked.has(c.id)?0.95:0.45}"/>`;
    }
    mm.innerHTML = dots + `<rect class="st-mm-viewport" id="st-mm-vp"/>`;
    updateMinimapViewport();
  }
  function updateMinimapViewport() {
    const vp  = document.getElementById('st-viewport');
    const rect = document.getElementById('st-mm-vp');
    if (!vp || !rect) return;
    /* La zone visible dans le SVG principal = (-pan.x/zoom, -pan.y/zoom) à
       (-pan.x/zoom + vp.width/zoom, -pan.y/zoom + vp.height/zoom).
       En coords du SVG du tree (avant scale), = (-pan/zoom, vp/zoom). */
    const x = -pan.x / zoom;
    const y = -pan.y / zoom;
    const w = vp.clientWidth  / zoom;
    const h = vp.clientHeight / zoom;
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h);
  }

})();
