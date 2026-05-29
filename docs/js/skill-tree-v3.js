/* ═══════════════════════════════════════════════════════════════════════
   skill-tree-v3.js — Arbre de compétences constellation  (V3)
   Style @yarrindev : axe principal vertical + branches diagonales,
   tracé animé des lignes, pop des nœuds, fond étoilé.

   Nœuds : origin · normal · overgrowth · gold · purple · final
   Chaque nœud n'ajoute qu'UNE stat.

   API publique : window.SkillTreeV3.init(opts) / .destroy()
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ═══════════════════════ CONSTANTES ═══════════════════════ */

  const SVG_W = 1000;
  const SVG_H = 1880;
  const MAIN_X = 500;
  const ORIGIN_Y = 1760;
  const FINAL_Y = 100;
  const MAIN_DEPTH = 14;
  // Espacement vertical entre deux nœuds de la branche principale
  const MAIN_SPC = Math.round((ORIGIN_Y - FINAL_Y) / (MAIN_DEPTH + 2)); // ≈104px

  // Décalage (dx,dy) par nœud de sous-branche → angle ~23°
  const SUB_DX = 152;
  const SUB_DY = -62;

  // Rayon SVG par type
  const NODE_R = {
    origin: 23,
    normal: 19,
    overgrowth: 29,
    gold: 22,
    purple: 22,
    final: 52,
  };

  // Coût PC par type
  const NODE_COST = {
    origin: 0,
    normal: 1,
    overgrowth: 3,
    gold: 2,
    purple: 2,
    final: 5,
  };

  /* ═══════════════════════ ICÔNES SVG ═══════════════════════
     Paths stroke-based, viewBox 24×24, centrés.
  ══════════════════════════════════════════════════════════ */

  const ICONS = {
    // Stats
    str:  'M7 3 L17 13 M6 18 L11 13 M16 8 L21 3 M3 21 L8 16',
    agi:  'M13 2 L4 14 L11 14 L10 22 L20 10 L13 10 Z',
    spd:  'M5 12 H19 M14 7 L19 12 L14 17 M10 7 L5 12 L10 17',
    int:  'M12 3 L20 10 L12 21 L4 10 Z M12 3 L12 21 M4 10 L20 10',
    mana: 'M12 3 C9 8 5 11 5 15 C5 19.4 8.1 22 12 22 C15.9 22 19 19.4 19 15 C19 11 15 8 12 3 Z',
    res:  'M12 2 L20 6 L20 13 C20 18 16 21.5 12 23 C8 21.5 4 18 4 13 L4 6 Z',
    cha:  'M3 19 H21 M6 19 L6 12 M18 19 L18 12 M9 12 L12 8 L15 12 M6 12 L3 8 M18 12 L21 8',
    aura: 'M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7.1 7.1 M16.9 16.9 L19 19 M5 19 L7.1 16.9 M16.9 7.1 L19 5 M12 7 A5 5 0 1 1 12 17 A5 5 0 1 1 12 7',
    // Spéciaux
    egg:  'M12 3 C8.1 3 5 7.1 5 11.5 C5 15.9 7.5 20.5 12 21 C16.5 20.5 19 15.9 19 11.5 C19 7.1 15.9 3 12 3 Z M9 13 Q12 16 15 13',
    gem:  'M12 3 L20 9 L17 20 L7 20 L4 9 Z M12 3 L17 9 L12 20 M12 3 L7 9 L12 20 M4 9 L20 9',
    star: 'M12 2 L14.4 9.4 L22 9.4 L15.9 13.9 L18.3 21.5 L12 17.1 L5.7 21.5 L8.1 13.9 L2 9.4 L9.6 9.4 Z',
    lock: 'M5 11 V8 A7 7 0 0 1 19 8 V11 M3 11 H21 V22 H3 Z M12 16 V18',
  };

  const STAT_LABELS = {
    str: 'FORCE', agi: 'AGILITÉ', spd: 'VITESSE',
    int: 'INTELLIGENCE', mana: 'MANA', res: 'RÉSISTANCE',
    cha: 'CHARISME', aura: 'AURA',
  };

  /* ═══════════════════════ TEMPLATE DE L'ARBRE ═══════════════════════
     Pour chaque profondeur (1→14) : type du nœud principal
     et configuration des sous-branches (gauche/droite, longueur, type final).
  ══════════════════════════════════════════════════════════════════════ */

  const TEMPLATE = [
    /* d=1  */ { main: 'normal',     subs: [] },
    /* d=2  */ { main: 'normal',     subs: [{ dir: 'right', count: 2, end: 'normal' }] },
    /* d=3  */ { main: 'normal',     subs: [] },
    /* d=4  */ { main: 'normal',     subs: [{ dir: 'left',  count: 2, end: 'gold'   }] },
    /* d=5  */ { main: 'overgrowth', subs: [] },
    /* d=6  */ { main: 'normal',     subs: [{ dir: 'left', count: 1, end: 'normal' },
                                             { dir: 'right', count: 2, end: 'normal' }] },
    /* d=7  */ { main: 'normal',     subs: [{ dir: 'left',  count: 2, end: 'purple' }] },
    /* d=8  */ { main: 'normal',     subs: [] },
    /* d=9  */ { main: 'normal',     subs: [{ dir: 'right', count: 2, end: 'normal' }] },
    /* d=10 */ { main: 'overgrowth', subs: [{ dir: 'left',  count: 1, end: 'normal' }] },
    /* d=11 */ { main: 'normal',     subs: [{ dir: 'right', count: 2, end: 'gold'   },
                                             { dir: 'left',  count: 1, end: 'normal' }] },
    /* d=12 */ { main: 'normal',     subs: [{ dir: 'right', count: 1, end: 'purple' }] },
    /* d=13 */ { main: 'overgrowth', subs: [] },
    /* d=14 */ { main: 'normal',     subs: [{ dir: 'left',  count: 2, end: 'normal' },
                                             { dir: 'right', count: 1, end: 'normal' }] },
  ];

  /* ═══════════════════════ GÉNÉRATEUR D'ARBRE ═══════════════════════ */

  function buildTree(voieKey, voieCfg) {
    // Liste des stats selon stat_weights (pondérée)
    const weights = voieCfg.stat_weights || { str: 1 };
    const statPool = [];
    for (const [s, w] of Object.entries(weights)) {
      for (let i = 0; i < (w || 1); i++) statPool.push(s);
    }
    if (!statPool.length) statPool.push('str');

    let si = 0;
    const nextStat = () => {
      const s = statPool[si % statPool.length];
      si++;
      return s;
    };

    const nodes = [];
    const edges = [];
    const nodeById = {};

    const addNode = cfg => { nodes.push(cfg); nodeById[cfg.id] = cfg; };
    const addEdge = (f, t) => edges.push({ from: f, to: t });

    // Nœud origine
    addNode({
      id: `${voieKey}-origin`,
      type: 'origin',
      mainBranch: true,
      x: MAIN_X,
      y: ORIGIN_Y,
      stat: null,
      amount: 0,
      eggs: 0,
      navarites: 0,
      cost: 0,
      requires: [],
    });

    let prevId = `${voieKey}-origin`;

    for (let d = 1; d <= MAIN_DEPTH; d++) {
      const tmpl = TEMPLATE[d - 1];
      const y = ORIGIN_Y - d * MAIN_SPC;
      const mainStat = nextStat();
      const mainType = tmpl.main;
      const mainId = `${voieKey}-m${d}`;

      addNode({
        id: mainId,
        type: mainType,
        mainBranch: true,
        x: MAIN_X,
        y,
        stat: mainStat,
        amount: mainType === 'overgrowth' ? 4 : 1,
        eggs: 0,
        navarites: 0,
        cost: NODE_COST[mainType] || 1,
        requires: [prevId],
      });
      addEdge(prevId, mainId);
      prevId = mainId;

      // Sous-branches
      for (const sub of (tmpl.subs || [])) {
        const dirSign = sub.dir === 'left' ? -1 : 1;
        let subPrevId = mainId;
        const parentNode = nodeById[mainId];

        for (let sn = 1; sn <= sub.count; sn++) {
          const isLast = sn === sub.count;
          const subType = isLast ? sub.end : 'normal';
          const subId = `${voieKey}-s${d}${sub.dir[0]}${sn}`;

          const pn = nodeById[subPrevId];
          const sx = pn.x + dirSign * SUB_DX;
          const sy = pn.y + SUB_DY;

          let subStat = null, subAmount = 0, subEggs = 0, subNav = 0;
          if (subType === 'gold')        { subEggs = 6; }
          else if (subType === 'purple') { subNav  = 5; }
          else { subStat = nextStat(); subAmount = subType === 'overgrowth' ? 4 : 1; }

          addNode({
            id: subId,
            type: subType,
            mainBranch: false,
            x: sx,
            y: sy,
            stat: subStat,
            amount: subAmount,
            eggs: subEggs,
            navarites: subNav,
            cost: NODE_COST[subType] || 1,
            requires: [subPrevId],
          });
          addEdge(subPrevId, subId);
          subPrevId = subId;
        }
      }
    }

    // Nœud final
    const finalId = `${voieKey}-final`;
    addNode({
      id: finalId,
      type: 'final',
      mainBranch: true,
      x: MAIN_X,
      y: FINAL_Y + 40,
      stat: null,
      amount: 0,
      eggs: 0,
      navarites: 0,
      cost: NODE_COST.final,
      requires: [prevId],
      palierName: voieCfg.palier_name || voieCfg.name || 'PALIER',
      palierDesc: voieCfg.palier_desc || '',
    });
    addEdge(prevId, finalId);

    return { nodes, edges, nodeById, voieKey, voieCfg };
  }

  /* ═══════════════════════ HELPERS SVG ═══════════════════════ */

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== null && v !== undefined) e.setAttribute(k, String(v));
    }
    return e;
  };
  const setA = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); };

  /* ═══════════════════════ CONSTRUCTION SVG ═══════════════════════ */

  function buildSVG(treeData, voieColor, unlockedSet) {
    const { nodes, edges, nodeById } = treeData;

    const svg = el('svg', {
      class: 'skt-svg',
      viewBox: `0 0 ${SVG_W} ${SVG_H}`,
      preserveAspectRatio: 'xMidYMid meet',
    });

    /* ── DEFS ── */
    const defs = el('defs');

    // Filtre glow générique (utilise la couleur de l'élément)
    const fGlow = el('filter', { id: 'skt-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    fGlow.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '5', result: 'blur' }));
    const fMerge = el('feMerge');
    fMerge.appendChild(el('feMergeNode', { in: 'blur' }));
    fMerge.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    fGlow.appendChild(fMerge);
    defs.appendChild(fGlow);

    // Filtre glow fort (final)
    const fFinal = el('filter', { id: 'skt-glow-final', x: '-60%', y: '-60%', width: '220%', height: '220%' });
    fFinal.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '10', result: 'blur' }));
    const fMerge2 = el('feMerge');
    fMerge2.appendChild(el('feMergeNode', { in: 'blur' }));
    fMerge2.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    fFinal.appendChild(fMerge2);
    defs.appendChild(fFinal);

    // Symbols icônes
    for (const [key, d] of Object.entries(ICONS)) {
      const sym = el('symbol', { id: `skt-ico-${key}`, viewBox: '0 0 24 24' });
      const p = el('path', {
        d, fill: 'none', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      sym.appendChild(p);
      defs.appendChild(sym);
    }
    svg.appendChild(defs);

    /* ── FOND ÉTOILÉ ── */
    const starG = el('g', { class: 'skt-stars', 'aria-hidden': 'true' });
    const rng = seededRng(voieColor); // étoiles stables (même seed = même étoiles)
    for (let i = 0; i < 160; i++) {
      const cx = rng() * SVG_W;
      const cy = rng() * SVG_H;
      const r  = rng() * 1.3 + 0.3;
      const op = (rng() * 0.35 + 0.05).toFixed(2);
      starG.appendChild(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: r.toFixed(2), fill: '#fff', opacity: op }));
    }
    svg.appendChild(starG);

    /* ── EDGES ── */
    const edgeG = el('g', { class: 'skt-edges' });
    for (const edge of edges) {
      const a = nodeById[edge.from];
      const b = nodeById[edge.to];
      if (!a || !b) continue;
      const unlk = unlockedSet.has(edge.from) && unlockedSet.has(edge.to);
      const isSub = !b.mainBranch;
      const len = Math.hypot(b.x - a.x, b.y - a.y).toFixed(1);
      const line = el('line', {
        class: `skt-edge ${isSub ? 'sub' : 'main'} ${unlk ? 'unlocked' : 'locked'}`,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        'data-from': edge.from, 'data-to': edge.to,
        '--elen': len,
        stroke: unlk ? voieColor : undefined,
      });
      if (unlk) line.setAttribute('filter', 'url(#skt-glow)');
      edgeG.appendChild(line);
    }
    svg.appendChild(edgeG);

    /* ── NODES ── */
    const nodeG = el('g', { class: 'skt-nodes' });
    for (const node of nodes) {
      nodeG.appendChild(buildNodeEl(node, voieColor, unlockedSet, nodeById));
    }
    svg.appendChild(nodeG);

    return svg;
  }

  function buildNodeEl(node, voieColor, unlockedSet, nodeById) {
    const unlk = unlockedSet.has(node.id);
    const canUnlock = !unlk && node.requires.every(r => unlockedSet.has(r));
    const state = unlk ? 'unlocked' : canUnlock ? 'unlockable' : 'locked';
    const r = NODE_R[node.type] || 19;

    const nc = nodeColor(node.type, voieColor);
    const filt = node.type === 'final' ? 'url(#skt-glow-final)' : 'url(#skt-glow)';

    const g = el('g', {
      class: `skt-node ${node.type} ${state}`,
      transform: `translate(${node.x},${node.y})`,
      'data-id': node.id,
      style: `--nc:${nc};`,
    });

    /* Glow ring (background) */
    const glow = el('circle', {
      class: 'n-glow',
      r: r + (node.type === 'final' ? 18 : node.type === 'overgrowth' ? 10 : 8),
      fill: nc,
      opacity: unlk ? '0.32' : '0',
      filter: filt,
    });
    g.appendChild(glow);

    /* Second ring (overgrowth / final) */
    if (node.type === 'overgrowth' || node.type === 'final') {
      const rr = node.type === 'final' ? r + 22 : r + 9;
      const r2 = el('circle', {
        class: 'n-ring2',
        r: rr, fill: 'none', stroke: nc,
        'stroke-width': node.type === 'final' ? 1.5 : 1,
        'stroke-dasharray': node.type === 'final' ? '8 5' : '4 6',
        opacity: unlk ? '0.22' : '0.06',
      });
      g.appendChild(r2);
    }

    /* Cercle principal */
    const circle = el('circle', {
      class: 'n-bg', r,
      fill: 'rgba(4,0,10,0.7)',
      stroke: unlk ? nc : 'rgba(255,255,255,0.2)',
      'stroke-width': unlk ? '2' : '1.5',
      'stroke-dasharray': unlk || canUnlock ? 'none' : '5 5',
    });
    g.appendChild(circle);

    /* Icône */
    const iconKey = iconForNode(node);
    const iconSize = r * 1.28;  // icon viewBox s'ajuste dans le cercle
    const iconOff  = iconSize / 2;
    const iconG = el('g', {
      class: 'n-icon',
      transform: `translate(${-iconOff},${-iconOff}) scale(${iconSize / 24})`,
      color: unlk ? nc : 'rgba(255,255,255,0.3)',
      stroke: unlk ? nc : 'rgba(255,255,255,0.3)',
      fill: 'none',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    const useEl = el('use', { href: `#skt-ico-${iconKey}` });
    iconG.appendChild(useEl);
    g.appendChild(iconG);

    /* Label overgrowth */
    if (node.type === 'overgrowth' && node.stat) {
      const lbl = el('text', {
        class: 'n-label',
        y: r + 15, 'text-anchor': 'middle',
        'font-size': '11', 'font-family': 'Orbitron,sans-serif',
        fill: unlk ? nc : 'rgba(255,255,255,0.3)',
        'letter-spacing': '1',
      });
      lbl.textContent = `+${node.amount} ${(STAT_LABELS[node.stat] || node.stat).slice(0, 5)}`;
      g.appendChild(lbl);
    }

    /* Nom du palier (final) */
    if (node.type === 'final' && node.palierName) {
      const lbl = el('text', {
        class: 'n-label',
        y: r + 20, 'text-anchor': 'middle',
        'font-size': '13', 'font-family': 'Orbitron,sans-serif',
        fill: unlk ? '#ffd600' : 'rgba(255,214,0,0.35)',
        'letter-spacing': '2',
      });
      lbl.textContent = node.palierName.toUpperCase().slice(0, 14);
      g.appendChild(lbl);
    }

    /* Indicateur d'état (petit point) */
    if (node.type !== 'origin' && node.type !== 'final') {
      const dot = el('circle', {
        class: 'n-dot', r: 3, cy: r + 2,
        fill: state === 'unlocked' ? nc
            : state === 'unlockable' ? 'rgba(255,255,255,0.55)'
            : 'rgba(255,255,255,0.15)',
      });
      g.appendChild(dot);
    }

    return g;
  }

  /* Couleur selon type de nœud */
  function nodeColor(type, voieColor) {
    if (type === 'gold')   return '#ffd600';
    if (type === 'purple') return '#a855f7';
    if (type === 'final')  return '#ffd600';
    if (type === 'overgrowth') return '#00ffcc';
    return voieColor;
  }

  /* Icône selon type/stat */
  function iconForNode(node) {
    if (node.type === 'gold')    return 'egg';
    if (node.type === 'purple')  return 'gem';
    if (node.type === 'final')   return 'star';
    if (node.type === 'origin')  return 'aura';
    return ICONS[node.stat] ? node.stat : 'str';
  }

  /* PRNG seedé (stars stables) */
  function seededRng(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return () => {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return (s >>> 0) / 0xFFFFFFFF;
    };
  }

  /* ═══════════════════════ PAN / ZOOM ═══════════════════════ */

  function setupPanZoom(wrap, svg) {
    let vp = { tx: 0, ty: 0, sc: 1 };
    let drag = null, lastPinch = null;
    let moved = false;

    const applyVP = () => {
      const t = `translate(${vp.tx}px,${vp.ty}px) scale(${vp.sc})`;
      svg.style.transformOrigin = '0 0';
      svg.style.transform = t;
    };

    const fitAll = () => {
      const { width: W, height: H } = wrap.getBoundingClientRect();
      const pad = 48;
      vp.sc = Math.min((W - pad * 2) / SVG_W, (H - pad * 2) / SVG_H);
      vp.tx = (W - SVG_W * vp.sc) / 2;
      vp.ty = (H - SVG_H * vp.sc) / 2;
      applyVP();
    };
    fitAll();
    window.addEventListener('resize', fitAll);

    // Mouse drag
    wrap.addEventListener('mousedown', e => {
      if (e.target.closest('.skt-node')) return;
      drag = { sx: e.clientX - vp.tx, sy: e.clientY - vp.ty };
      moved = false;
      wrap.classList.add('dragging');
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      vp.tx = e.clientX - drag.sx;
      vp.ty = e.clientY - drag.sy;
      moved = true;
      applyVP();
    });
    window.addEventListener('mouseup', () => {
      drag = null;
      wrap.classList.remove('dragging');
    });

    // Wheel zoom
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.88 : 1.13;
      const { left, top } = wrap.getBoundingClientRect();
      const mx = e.clientX - left, my = e.clientY - top;
      vp.tx = mx - factor * (mx - vp.tx);
      vp.ty = my - factor * (my - vp.ty);
      vp.sc = Math.min(Math.max(vp.sc * factor, 0.12), 5);
      applyVP();
    }, { passive: false });

    // Touch pinch + drag
    wrap.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastPinch = pinchDist(e.touches);
      } else if (e.touches.length === 1) {
        if (e.target.closest('.skt-node')) return;
        drag = { sx: e.touches[0].clientX - vp.tx, sy: e.touches[0].clientY - vp.ty };
        moved = false;
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && lastPinch != null) {
        const cur = pinchDist(e.touches);
        const factor = cur / lastPinch;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const { left, top } = wrap.getBoundingClientRect();
        const mx = cx - left, my = cy - top;
        vp.tx = mx - factor * (mx - vp.tx);
        vp.ty = my - factor * (my - vp.ty);
        vp.sc = Math.min(Math.max(vp.sc * factor, 0.12), 5);
        lastPinch = cur;
        moved = true;
        applyVP();
      } else if (e.touches.length === 1 && drag) {
        vp.tx = e.touches[0].clientX - drag.sx;
        vp.ty = e.touches[0].clientY - drag.sy;
        moved = true;
        applyVP();
      }
    }, { passive: true });

    wrap.addEventListener('touchend', () => { drag = null; lastPinch = null; });

    return {
      fitAll,
      wasMoved: () => moved,
      resetMoved: () => { moved = false; },
      zoomIn:  () => { vp.sc = Math.min(vp.sc * 1.2, 5);  applyVP(); },
      zoomOut: () => { vp.sc = Math.max(vp.sc * 0.83, 0.12); applyVP(); },
      resetView: fitAll,
    };
  }

  function pinchDist(touches) {
    return Math.hypot(
      touches[1].clientX - touches[0].clientX,
      touches[1].clientY - touches[0].clientY
    );
  }

  /* ═══════════════════════ ANIMATION DÉBLOCAGE ═══════════════════════ */

  function animateUnlock(svg, fromId, toId, voieColor, onDone) {
    const edgeEl = svg.querySelector(`.skt-edge[data-from="${CSS.escape(fromId)}"][data-to="${CSS.escape(toId)}"]`);
    const nodeEl = svg.querySelector(`.skt-node[data-id="${CSS.escape(toId)}"]`);
    if (!edgeEl || !nodeEl) { onDone?.(); return; }

    const len = parseFloat(edgeEl.getAttribute('--elen') || 100);

    // 1. Tracé de la ligne
    edgeEl.setAttribute('stroke', voieColor);
    edgeEl.classList.remove('locked');
    edgeEl.setAttribute('stroke-dasharray', `${len} ${len}`);
    edgeEl.setAttribute('stroke-dashoffset', len);

    // Forcer reflow puis lancer la transition
    void edgeEl.getBoundingClientRect();
    edgeEl.style.transition = `stroke-dashoffset 0.42s ease`;
    edgeEl.setAttribute('stroke-dashoffset', 0);

    setTimeout(() => {
      edgeEl.style.transition = '';
      edgeEl.removeAttribute('stroke-dasharray');
      edgeEl.removeAttribute('stroke-dashoffset');
      edgeEl.classList.add('unlocked');
      edgeEl.setAttribute('filter', 'url(#skt-glow)');

      // 2. Pop du nœud
      nodeEl.classList.remove('locked', 'unlockable');
      nodeEl.classList.add('unlocked');

      // Mettre à jour les couleurs du nœud
      refreshNodeVisuals(nodeEl, voieColor);

      nodeEl.classList.add('popping');
      setTimeout(() => nodeEl.classList.remove('popping'), 420);

      onDone?.();
    }, 450);
  }

  function refreshNodeVisuals(nodeEl, voieColor) {
    const type = [...nodeEl.classList].find(c => ['normal','overgrowth','gold','purple','final','origin'].includes(c)) || 'normal';
    const nc = nodeColor(type, voieColor);
    nodeEl.style.setProperty('--nc', nc);

    const bg   = nodeEl.querySelector('.n-bg');
    const glow = nodeEl.querySelector('.n-glow');
    const icon = nodeEl.querySelector('.n-icon');
    const dot  = nodeEl.querySelector('.n-dot');
    const lbl  = nodeEl.querySelector('.n-label');
    const r2   = nodeEl.querySelector('.n-ring2');

    if (bg)   { bg.setAttribute('stroke', nc); bg.setAttribute('stroke-width', '2'); bg.setAttribute('stroke-dasharray', 'none'); bg.setAttribute('fill', 'rgba(4,0,10,0.7)'); }
    if (glow) { glow.setAttribute('fill', nc); glow.setAttribute('opacity', '0.32'); }
    if (icon) { icon.setAttribute('color', nc); icon.setAttribute('stroke', nc); }
    if (dot)  { dot.setAttribute('fill', nc); }
    if (lbl)  { lbl.setAttribute('fill', nc); }
    if (r2)   { r2.setAttribute('stroke', nc); r2.setAttribute('opacity', '0.22'); }
  }

  function updateUnlockableStates(svg, treeData, unlockedSet) {
    for (const node of treeData.nodes) {
      const el = svg.querySelector(`.skt-node[data-id="${CSS.escape(node.id)}"]`);
      if (!el || el.classList.contains('unlocked')) continue;
      const canNow = node.requires.every(r => unlockedSet.has(r));
      el.classList.toggle('unlockable', canNow);
      el.classList.toggle('locked', !canNow);
      const bg = el.querySelector('.n-bg');
      if (bg && canNow) { bg.setAttribute('stroke', 'rgba(255,255,255,0.42)'); bg.setAttribute('stroke-dasharray', 'none'); }
    }
  }

  /* ═══════════════════════ INFO PANEL ═══════════════════════ */

  function openInfoPanel(panel, node, pcAvail, voieColor, onUnlock) {
    const nc = nodeColor(node.type, voieColor);

    const typeLabel =
      node.type === 'gold'       ? '✦ NŒUD DORÉ'
    : node.type === 'purple'     ? '◈ NŒUD NAVARITE'
    : node.type === 'overgrowth' ? '⬡ OVERGROWTH'
    : node.type === 'final'      ? '★ NŒUD FINAL'
    : node.type === 'origin'     ? '◎ ORIGINE'
    : '○ NŒUD';

    const statName = node.stat ? (STAT_LABELS[node.stat] || node.stat) : null;

    const effectHtml =
      node.type === 'gold'
      ? `<strong>+ ${node.eggs} Golden Eggs</strong>`
    : node.type === 'purple'
      ? `<strong>+ ${node.navarites} Navarites</strong>`
    : node.type === 'final'
      ? (node.palierDesc || 'Pouvoir de voie débloqué')
    : statName
      ? `+ <strong>${node.amount} ${statName}</strong>`
      : '—';

    const canAfford = pcAvail >= (node.cost || 0);
    const isUnlocked = panel.dataset.nodeState === 'unlocked';

    panel.style.setProperty('--nc', nc);

    // R, G, B pour la variable CSS du bouton
    const rgb = hexToRgbStr(nc);
    panel.style.setProperty('--nc-rgb', rgb);

    panel.innerHTML = `
      <button class="skt-info-close" id="skt-close-panel" aria-label="Fermer">✕</button>
      <div class="skt-info-type">${typeLabel}</div>
      <div class="skt-info-name">${statName || (node.palierName || node.type.toUpperCase())}</div>
      <div class="skt-info-effect">${effectHtml}</div>
      <div class="skt-info-cost">
        Coût : ${node.cost} PC
        ${!canAfford && node.cost > 0 ? '<span class="skt-no-funds">— fonds insuffisants</span>' : ''}
      </div>
      <button class="skt-unlock-btn ${isUnlocked ? 'already-done' : ''}"
        ${(!canAfford && !isUnlocked) || isUnlocked ? 'disabled' : ''}>
        ${isUnlocked ? '✓ DÉBLOQUÉ' : 'DÉBLOQUER'}
      </button>
    `;

    panel.querySelector('#skt-close-panel').addEventListener('click', () => {
      panel.classList.remove('open');
    });

    if (!isUnlocked && canAfford) {
      panel.querySelector('.skt-unlock-btn').addEventListener('click', () => {
        panel.classList.remove('open');
        onUnlock(node);
      });
    }

    panel.classList.add('open');
  }

  function hexToRgbStr(hex) {
    const r = parseInt(hex.slice(1,3), 16) || 0;
    const g = parseInt(hex.slice(3,5), 16) || 229;
    const b = parseInt(hex.slice(5,7), 16) || 255;
    return `${r},${g},${b}`;
  }

  /* ═══════════════════════ LÉGENDE ═══════════════════════ */

  function buildLegend(container, voieColor) {
    const legend = document.createElement('div');
    legend.className = 'skt-legend';
    const items = [
      { color: voieColor, label: 'NORMAL +1' },
      { color: '#00ffcc', label: 'OVERGROWTH +4' },
      { color: '#ffd600', label: 'GOLDEN EGG' },
      { color: '#a855f7', label: 'NAVARITE' },
      { color: '#ffd600', label: 'FINAL' },
    ];
    for (const i of items) {
      const d = document.createElement('div');
      d.className = 'skt-legend-item';
      d.innerHTML = `<span class="skt-legend-dot" style="background:${i.color};box-shadow:0 0 5px ${i.color}"></span>${i.label}`;
      legend.appendChild(d);
    }
    container.appendChild(legend);
  }

  /* ═══════════════════════ CONTRÔLES ZOOM ═══════════════════════ */

  function buildZoomControls(container, pz) {
    const ctrl = document.createElement('div');
    ctrl.className = 'skt-zoom-controls';
    ctrl.innerHTML = `
      <button class="skt-zoom-btn" title="Zoom +" id="skt-zoom-in">+</button>
      <button class="skt-zoom-btn" title="Zoom −" id="skt-zoom-out">−</button>
      <button class="skt-zoom-btn" title="Ajuster" id="skt-zoom-fit" style="font-size:.7rem;letter-spacing:.05em">FIT</button>
    `;
    ctrl.querySelector('#skt-zoom-in').addEventListener('click',  () => pz.zoomIn());
    ctrl.querySelector('#skt-zoom-out').addEventListener('click', () => pz.zoomOut());
    ctrl.querySelector('#skt-zoom-fit').addEventListener('click', () => pz.resetView());
    container.appendChild(ctrl);
  }

  /* ═══════════════════════ API PUBLIQUE ═══════════════════════ */

  let _inst = null;

  window.SkillTreeV3 = {

    init: function (opts) {
      /*
       * opts = {
       *   container   : HTMLElement   — stage-voie element
       *   voieKey     : string
       *   voieCfg     : object        — { name, color, stat_weights, palier_name, palier_desc, ... }
       *   char        : object        — { xp, pc_spent, skill_tree_unlocked, ... }
       *   onUnlock    : async (node, voieKey) => void
       *   onBack      : () => void
       * }
       */
      SkillTreeV3.destroy();

      const { container, voieKey, voieCfg, char, onUnlock, onBack } = opts;
      const voieColor = voieCfg.color || '#00e5ff';

      // Ensemble des nœuds débloqués (les IDs actuels peuvent être de l'ancien format)
      const rawUnlocked = char.skill_tree_unlocked || [];
      const unlockedSet = new Set();
      unlockedSet.add(`${voieKey}-origin`);  // origin toujours débloqué
      // Inclure les IDs du nouveau format
      rawUnlocked.forEach(id => unlockedSet.add(id));
      // Compatibilité ancien format (ex: "an-origin")
      if (rawUnlocked.some(id => id.endsWith('-origin'))) unlockedSet.add(`${voieKey}-origin`);

      // Construire l'arbre
      const treeData = buildTree(voieKey, voieCfg);

      // Vider le container
      container.innerHTML = '';
      container.style.setProperty('--vc', voieColor);
      container.style.setProperty('--vc-rgb', hexToRgbStr(voieColor));

      // ── Header ──
      const header = document.createElement('div');
      header.className = 'skt-header';
      header.innerHTML = `
        <button class="skt-back" id="skt-back-btn">← VOIES</button>
        <div class="skt-voie-name">${voieCfg.name || voieKey}</div>
        <div class="skt-pc-badge" id="skt-pc-badge">— PC</div>
      `;
      container.appendChild(header);

      // ── Canvas wrap ──
      const wrap = document.createElement('div');
      wrap.className = 'skt-canvas-wrap';
      container.appendChild(wrap);

      // ── SVG ──
      const svg = buildSVG(treeData, voieColor, unlockedSet);
      wrap.appendChild(svg);

      // ── Info panel ──
      const panel = document.createElement('div');
      panel.className = 'skt-info-panel';
      container.appendChild(panel);

      // ── Légende ──
      buildLegend(container, voieColor);

      // ── Zoom controls ──
      const pz = setupPanZoom(wrap, svg);
      buildZoomControls(container, pz);

      // ── PC badge ──
      const updatePc = () => {
        const xp = Number(char.xp || 0);
        const earned = Math.floor(xp / 1000);
        const spent  = Number(char.pc_spent || 0);
        const avail  = Math.max(0, earned - spent);
        const badge  = container.querySelector('#skt-pc-badge');
        if (badge) badge.textContent = `${avail} PC`;
        return avail;
      };
      updatePc();

      // ── Click sur les nœuds ──
      svg.addEventListener('click', e => {
        if (pz.wasMoved()) { pz.resetMoved(); return; } // ignore si drag
        const nodeEl = e.target.closest('.skt-node');
        if (!nodeEl) { panel.classList.remove('open'); return; }

        const nodeId  = nodeEl.dataset.id;
        const node    = treeData.nodeById[nodeId];
        if (!node || node.type === 'origin') return;

        const pcAvail = updatePc();
        const isUnlk  = nodeEl.classList.contains('unlocked');
        panel.dataset.nodeState = isUnlk ? 'unlocked' : 'pending';

        if (!isUnlk && !nodeEl.classList.contains('unlockable')) return;

        openInfoPanel(panel, node, pcAvail, voieColor, async (n) => {
          try {
            await onUnlock(n, voieKey);

            // Mise à jour locale
            unlockedSet.add(n.id);
            char.skill_tree_unlocked = [...(char.skill_tree_unlocked || []), n.id];
            char.pc_spent = (Number(char.pc_spent || 0)) + (n.cost || 0);

            // Animation
            const parentId = n.requires[0];
            animateUnlock(svg, parentId, n.id, voieColor, () => {
              updateUnlockableStates(svg, treeData, unlockedSet);
              updatePc();
            });
          } catch (err) {
            console.error('[SkillTreeV3] unlock error', err);
          }
        });
      });

      // Touch tap : même logique (via click event, fonctionne avec le flag moved)
      let touchStartX = 0, touchStartY = 0;
      wrap.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });
      wrap.addEventListener('touchend', e => {
        if (e.changedTouches.length === 1) {
          const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
          if (dx < 8 && dy < 8) pz.resetMoved(); // tap immobile → ne pas ignorer
        }
      }, { passive: true });

      // ── Back button ──
      header.querySelector('#skt-back-btn').addEventListener('click', () => {
        panel.classList.remove('open');
        onBack?.();
      });

      _inst = { container, treeData, svg, unlockedSet, char, pz, panel };
    },

    destroy: function () {
      if (_inst) {
        _inst.container.innerHTML = '';
        _inst = null;
      }
    },
  };

})();
