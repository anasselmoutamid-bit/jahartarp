/* ═══════════════════════════════════════════════════════════════════════
   competences.js — page Compétences (skill trees)
   Stages : auth /link → char picker → polygone rotatif → voie tree

   Fonctionnement :
     1. AUTH /link (gacha_link_codes) — session 7j en localStorage
     2. Liste tous les persos du joueur (characters where user_id == discord_id)
     3. Click sur une card perso → polygone rotatif avec 5 voies (ou 6 si IRP)
     4. Click sur un sommet du polygone → callout (nom voie + focus + Entrer)
     5. Click sur Entrer → arbre de cases de la voie (vertical scroll)
     6. Click sur une case → side panel + bouton Débloquer (transaction Firestore)
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ─── Firebase ─── */
  const cfg = {
    apiKey:"AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",
    authDomain:"jahartarp.firebaseapp.com",
    projectId:"jahartarp",
    storageBucket:"jahartarp.firebasestorage.app",
    messagingSenderId:"834848086593",
    appId:"1:834848086593:web:c5cddc894f04feb61cc4c0",
  };
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const db = firebase.firestore();

  /* ─── State ─── */
  const SESS_KEY = 'hub_session';
  const SESS_TTL = 7 * 24 * 60 * 60 * 1000;
  let SESS = null;             // {id, username, avatar, _exp}
  let CHARS = [];              // tous les persos du joueur
  let CHAR  = null;            // perso actuellement géré
  let TREE  = null;            // human.json filtré (sans Immoral si non-IRP)
  let CASE_BY_ID = {};
  let SELECTED_VOIE = null;
  let SELECTED_CASE_ID = null;
  let IS_IRP_LINKED = false;

  const STAT_KEY_MAP = {
    str: 'strength', agi: 'agility', spd: 'speed',
    int: 'intelligence', mana: 'mana',
    res: 'resistance', cha: 'charisma',
  };
  const STAT_LABELS = {
    str:'STR', agi:'AGI', spd:'SPD', int:'INT', mana:'MNA', res:'RES', cha:'CHA'
  };

  /* ═══ AUTH ═══════════════════════════════════════════════════════════ */
  function getSess() {
    try {
      const s = JSON.parse(localStorage.getItem(SESS_KEY) || 'null');
      if (!s || !s._exp || Date.now() > s._exp) { localStorage.removeItem(SESS_KEY); return null; }
      return s;
    } catch (_) { return null; }
  }
  function setSess(s) {
    s._exp = Date.now() + SESS_TTL;
    localStorage.setItem(SESS_KEY, JSON.stringify(s));
    try { localStorage.setItem('gacha_session', JSON.stringify(s)); } catch (_) {}
  }
  function clearSess() {
    localStorage.removeItem(SESS_KEY);
    localStorage.removeItem('gacha_session');
  }

  async function verifyCode() {
    const inp  = document.getElementById('link-code');
    const err  = document.getElementById('code-error');
    const btn  = document.getElementById('verify-btn');
    const code = (inp.value || '').trim().toUpperCase().replace(/\s/g, '').replace(/-/g, '');
    err.textContent = '';
    if (code.length < 4) { err.textContent = 'Code invalide'; return; }
    btn.disabled = true; btn.textContent = 'Vérification…';
    try {
      const data = await db.runTransaction(async tx => {
        const ref = db.collection('gacha_link_codes').doc(code);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('CODE_NOT_FOUND');
        const d = snap.data();
        if (d.expires_at && d.expires_at.toDate && d.expires_at.toDate() < new Date()) {
          throw new Error('CODE_EXPIRED');
        }
        tx.delete(ref);
        return d;
      });
      const s = {
        id: String(data.discord_id || data.user_id || ''),
        username: data.username || 'Joueur',
        avatar: data.avatar_url || '',
      };
      if (!s.id) throw new Error('CODE_NO_ID');
      setSess(s); SESS = s;
      onAuthOk();
    } catch (e) {
      const msg = e.message === 'CODE_NOT_FOUND' ? 'Code introuvable ou déjà utilisé.'
                : e.message === 'CODE_EXPIRED'   ? 'Code expiré.'
                : e.message === 'CODE_NO_ID'     ? 'Réponse invalide du serveur.'
                : 'Erreur : ' + (e.message || e);
      err.textContent = msg;
      btn.disabled = false; btn.textContent = 'CONNEXION AU NEXUS';
    }
  }

  function onAuthOk() {
    document.getElementById('login-gate').style.display = 'none';
    document.getElementById('comp-app').classList.add('ready');
    document.getElementById('comp-user').textContent = (SESS.username || 'Joueur') + ' · ' + SESS.id;
    loadChars();
  }

  function logout() {
    clearSess();
    location.reload();
  }

  /* ═══ Liste des personnages ═════════════════════════════════════════ */
  async function loadChars() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '<div class="char-loading">Chargement de tes personnages…</div>';
    try {
      const snap = await db.collection('characters').where('user_id', '==', SESS.id).get();
      CHARS = [];
      snap.forEach(d => CHARS.push(Object.assign({ _id: d.id }, d.data())));
      // Ordre : actif en premier (si on peut le résoudre), puis par updated_at desc
      const activeSnap = await db.collection('active_characters').doc(SESS.id).get();
      const activeId = activeSnap.exists ? (activeSnap.data().character_id || null) : null;
      CHARS.sort((a, b) => {
        if (a._id === activeId) return -1;
        if (b._id === activeId) return 1;
        return ((b.updated_at?.seconds || 0) - (a.updated_at?.seconds || 0));
      });
      CHARS.forEach(c => { c._isActive = (c._id === activeId); });
      renderCharGrid();
    } catch (e) {
      window._dbg?.error?.('[comp] loadChars', e);
      grid.innerHTML = '<div class="char-loading" style="color:#FF4757">Erreur : '
                     + (e.code || e.message || 'inconnue') + '</div>';
    }
  }

  function renderCharGrid() {
    const grid = document.getElementById('char-grid');
    if (!CHARS.length) {
      grid.innerHTML = '<div class="char-loading">Aucun personnage trouvé. Crée-en un avec <code>/character</code> sur Discord.</div>';
      return;
    }
    grid.innerHTML = CHARS.map(c => {
      const stats = c.stats || {};
      const xp    = Number(c.xp || 0);
      const pcSpent = Number(c.pc_spent || 0);
      const pcEarned = Math.floor(xp / 1000);
      const pcAvail = Math.max(0, pcEarned - pcSpent);
      const race  = (c.race || c.race_specific || c.race_category || '—');
      return ''
        + `<div class="char-card${c._isActive ? ' active' : ''}" data-charid="${esc(c._id)}">`
        +   `<div class="char-card-tag">${c._isActive ? '● Actif' : '○ Inactif'}</div>`
        +   `<div class="char-card-name">${esc((c.first_name||'') + ' ' + (c.last_name||'')).trim() || 'Personnage'}</div>`
        +   `<div class="char-card-meta">${esc(race)} · ${esc(c.rank || '?')} · niv ${esc(c.level || '—')}</div>`
        +   `<div class="char-card-stats">`
        +     `<div class="char-card-stat">XP <strong>${xp.toLocaleString('fr-FR')}</strong></div>`
        +     `<div class="char-card-stat">PC <strong>${pcAvail}</strong></div>`
        +     `<div class="char-card-stat">PC dépensés <strong>${pcSpent}</strong></div>`
        +   `</div>`
        + `</div>`;
    }).join('');
    grid.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => onCharSelected(card.dataset.charid));
    });
  }

  /* ═══ Stage B : polygone rotatif ════════════════════════════════════ */
  async function onCharSelected(charId) {
    CHAR = CHARS.find(c => c._id === charId);
    if (!CHAR) return;

    /* Détection IRP : on cherche dans irp_links/{discord_id} si main_char_id existe.
       On vérifie aussi `linked_to` / `synced_from` sur le perso. */
    IS_IRP_LINKED = await detectIrpLink(SESS.id, CHAR);

    /* Charge la définition d'arbre, filtre Immoral si non-IRP */
    if (!TREE) await loadTree();
    let voies = Object.assign({}, TREE._meta.voies);
    if (!IS_IRP_LINKED) {
      delete voies.immoral;
    }
    /* Filtre les cases en accord (sécurité : on ne garde même pas Immoral en mémoire si non-IRP) */
    if (!IS_IRP_LINKED && TREE._cases_full) {
      // Restaure d'abord (au cas où on revient d'un autre char IRP)
      TREE.cases = TREE._cases_full;
    }
    if (!TREE._cases_full) TREE._cases_full = TREE.cases.slice();
    if (!IS_IRP_LINKED) {
      TREE.cases = TREE._cases_full.filter(c => c.voie !== 'immoral');
    } else {
      TREE.cases = TREE._cases_full.slice();
    }
    CASE_BY_ID = Object.fromEntries(TREE.cases.map(c => [c.id, c]));

    /* Goto stage B */
    showStage('polygon');
    document.getElementById('poly-char-name').textContent =
      (CHAR.first_name || '') + ' ' + (CHAR.last_name || '');
    renderPolygonCenter(CHAR);
    renderPolygon(voies);
  }

  async function loadTree() {
    /* no-store : on évite que le navigateur serve un human.json v2 mis en cache lors d'une session précédente.
       Pour la prod, ajouter un query param de version suffirait. */
    const res = await fetch('data/skill-trees/human.json?v=3', { cache: 'no-store' });
    if (!res.ok) throw new Error('tree fetch ' + res.status);
    TREE = await res.json();
  }

  async function detectIrpLink(discordId, char) {
    try {
      const linksDoc = await db.collection('irp_links').doc(String(discordId)).get();
      if (linksDoc.exists) {
        const d = linksDoc.data();
        if (d && (d.main_char_id || d.character_id)) return true;
      }
    } catch (_) {}
    if (char && (char.linked_to || char.synced_from || char.irp_id)) return true;
    return false;
  }

  function renderPolygonCenter(char) {
    const el = document.getElementById('polygon-center');
    el.innerHTML = ''
      + `<div class="polygon-center-name">${esc((char.first_name||'') + ' ' + (char.last_name||''))}</div>`
      + `<div class="polygon-center-sub">${esc(char.race || char.race_specific || 'Humain')}</div>`;
  }

  /* ─── 3D : bipyramid Three.js ───
     - Cristal type bipyramide : N sommets équatoriaux (= N voies) + 2 pôles décoratifs
     - Rotation lente continue, pause sur sélection
     - Vertex markers (sphères glow) cliquables via raycaster
     - Labels HTML overlay positionnés via projection 3D→2D
   */
  let _3d = null;     // {scene, camera, renderer, mesh, vertexMeshes, raf, autoRotate, voies, verts}

  function renderPolygon(voies) {
    closeCallout();
    /* Téléport des entrées voies en tableau ordonné */
    const ordered = Object.entries(voies).sort((a,b) => (a[1].order||0) - (b[1].order||0));
    initThreeScene(ordered);
  }

  /* Sommets canoniques d'un icosaèdre (golden-ratio coordinates).
     Renvoie 12 Vector3 normalisés à un rayon donné. */
  function icosahedronVertices(radius) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const len = Math.sqrt(1 + phi * phi);
    const raw = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];
    return raw.map(([x, y, z]) =>
      new THREE.Vector3((x / len) * radius, (y / len) * radius, (z / len) * radius));
  }

  /* Sélectionne N sommets parmi 12 pour les voies. Stratégie : on prend les
     N sommets ayant la plus grande coordonnée Y (top de l'icosaèdre).
     Les autres restent décoratifs (l'utilisateur a accepté qu'il y ait plus
     d'angles que nécessaire). */
  function pickVertices(allVerts, n) {
    const sorted = allVerts.slice().sort((a, b) => b.y - a.y);
    return sorted.slice(0, n);
  }

  function initThreeScene(orderedVoies) {
    /* Cleanup ancien renderer */
    if (_3d && _3d.raf) cancelAnimationFrame(_3d.raf);
    if (_3d && _3d.renderer) {
      try { _3d.renderer.dispose(); } catch (_) {}
    }

    const wrap = document.getElementById('polyhedron-wrap');
    const canvas = document.getElementById('polyhedron-canvas');
    const labels = document.getElementById('poly-labels');
    labels.innerHTML = '';                  // pas de labels — uniquement points lumineux

    const W = wrap.clientWidth, H = wrap.clientHeight;
    const N = orderedVoies.length;          // 5 ou 6 voies

    /* ── Scene + camera + renderer ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0.4, 5.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    /* ── Géométrie : icosaèdre opaque (style orbital gacha) ── */
    const R = 1.5;
    const geom = new THREE.IcosahedronGeometry(R, 0);

    /* Solide opaque (pas translucide). Couleur cyber sombre. */
    const solidMat = new THREE.MeshBasicMaterial({
      color: 0x0d1530,
      transparent: false,
      side: THREE.FrontSide,
    });
    const solid = new THREE.Mesh(geom, solidMat);

    /* Wireframe blanc subtle par-dessus (style gacha orbital) */
    const wireOverlay = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      color: 0xffffff, wireframe: true,
      transparent: true, opacity: 0.28,
    }));
    /* Bord net via EdgesGeometry — accent cyan plus défini */
    const edges = new THREE.EdgesGeometry(geom);
    const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: 0x00e5ff, transparent: true, opacity: 0.55,
    }));

    /* On groupe tout dans un seul rotor pour rotation cohérente */
    const rotor = new THREE.Group();
    rotor.add(solid);
    rotor.add(wireOverlay);
    rotor.add(edgeLines);
    scene.add(rotor);

    /* ── Points lumineux : sphères opaques aux N sommets choisis ── */
    const allVerts = icosahedronVertices(R);
    const chosen   = pickVertices(allVerts, N);     // N sommets en haut de l'icosaèdre
    const sphereGeo = new THREE.SphereGeometry(0.085, 24, 24);
    const haloGeo   = new THREE.SphereGeometry(0.16, 24, 24);

    const equatorVerts = [];
    chosen.forEach((vec, i) => {
      const color = new THREE.Color(orderedVoies[i][1].color || '#00e5ff');
      const sphere = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color }));
      sphere.position.copy(vec);
      sphere.userData.idx = i;
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.22, side: THREE.BackSide,
      }));
      halo.position.copy(vec);
      rotor.add(sphere);
      rotor.add(halo);
      equatorVerts.push({
        key: orderedVoies[i][0],
        cfg: orderedVoies[i][1],
        pos: vec,
        mesh: sphere,
        halo,
        label: null,        // plus de label HTML
      });
    });

    /* ── Raycaster pour clic sur sphère lumineuse ── */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(equatorVerts.map(v => v.mesh));
      if (hits.length) onVertexClick(hits[0].object.userData.idx);
      else closeCallout();
    });

    /* ── Drag pour orbiter manuellement (pause auto-rotate) ── */
    let isDragging = false;
    let dragLast = { x: 0, y: 0 };
    let userYaw = 0, userPitch = 0;
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true; dragLast.x = e.clientX; dragLast.y = e.clientY;
      _3d.autoRotate = false;
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      userYaw   += (e.clientX - dragLast.x) * 0.01;
      userPitch += (e.clientY - dragLast.y) * 0.01;
      userPitch = Math.max(-1.0, Math.min(1.0, userPitch));
      dragLast.x = e.clientX; dragLast.y = e.clientY;
    });

    /* ── Animation loop ── */
    let theta = 0;
    const tick = () => {
      if (_3d.autoRotate) theta += 0.005;
      rotor.rotation.set(userPitch, theta + userYaw, 0);
      renderer.render(scene, camera);
      _3d.raf = requestAnimationFrame(tick);
    };

    _3d = {
      scene, camera, renderer, rotor,
      equatorVerts, autoRotate: true, raf: null,
      onResize: () => {
        const W2 = wrap.clientWidth, H2 = wrap.clientHeight;
        camera.aspect = W2 / H2; camera.updateProjectionMatrix();
        renderer.setSize(W2, H2, false);
      },
    };
    window.addEventListener('resize', _3d.onResize);
    tick();

    function onVertexClick(idx) {
      _3d.autoRotate = false;
      const v = equatorVerts[idx];
      showCallout(v);
    }
  }

  function showCallout(vertex) {
    const callout = document.getElementById('polygon-callout');
    const cfg = vertex.cfg;
    callout.style.setProperty('--vc', cfg.color);
    callout.innerHTML = ''
      + `<div class="polygon-callout-name">${esc(cfg.name)}</div>`
      + `<div class="polygon-callout-focus">Focus · ${esc(cfg.focus || '—')}</div>`
      + `<div class="polygon-callout-desc">${esc(cfg.palier_desc || '')}</div>`
      + `<button class="polygon-callout-enter" data-key="${esc(vertex.key)}">▶ Entrer dans la voie</button>`;
    callout.hidden = false;
    requestAnimationFrame(() => {
      callout.classList.add('shown');
      positionCallout(callout, vertex);
    });
    callout.querySelector('.polygon-callout-enter').addEventListener('click', () => {
      enterVoie(vertex.key);
    });
  }

  function positionCallout(callout, vertex) {
    /* On projette la position de la sphère 3D (en world space, après rotation
       du rotor) en coords 2D du canvas, puis on décale le callout vers
       l'extérieur du centre de l'écran. */
    if (!_3d) return;
    const wrap = document.getElementById('polyhedron-wrap');
    const W = wrap.clientWidth, H = wrap.clientHeight;
    /* La sphère est enfant du rotor → on récupère sa position monde */
    vertex.mesh.updateMatrixWorld();
    const worldPos = new THREE.Vector3();
    worldPos.setFromMatrixPosition(vertex.mesh.matrixWorld);
    const screen = worldPos.project(_3d.camera);
    const sx = (screen.x * 0.5 + 0.5) * W;
    const sy = (-screen.y * 0.5 + 0.5) * H;
    /* Décale vers l'extérieur (loin du centre) pour ne pas couvrir le sommet */
    const cx = W / 2, cy = H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const offsetDist = 90;
    const calloutX = sx + Math.cos(ang) * offsetDist;
    const calloutY = sy + Math.sin(ang) * offsetDist;
    callout.style.left = '0px'; callout.style.top = '0px';
    callout.style.transform = `translate(${calloutX}px, ${calloutY}px) translate(-50%, -50%) scale(1)`;
  }

  function closeCallout() {
    const callout = document.getElementById('polygon-callout');
    if (callout) {
      callout.classList.remove('shown');
      setTimeout(() => { if (callout) callout.hidden = true; }, 280);
    }
    if (_3d) _3d.autoRotate = true;
  }

  /* ═══ Stage C : voie tree (cases) ═══════════════════════════════════ */
  function enterVoie(voieKey) {
    SELECTED_VOIE = voieKey;
    SELECTED_CASE_ID = null;
    showStage('voie');
    const cfg = TREE._meta.voies[voieKey];
    const header = document.getElementById('voie-header');
    header.style.setProperty('--vc', cfg.color);
    header.innerHTML = ''
      + `<div class="voie-header-name">${esc(cfg.name)}</div>`
      + `<div class="voie-header-focus">Focus · ${esc(cfg.focus)}</div>`;
    document.getElementById('voie-side').style.setProperty('--vc', cfg.color);
    renderVoieTree();
    updateVoieTopbar();
  }

  function updateVoieTopbar() {
    const xp = Number(CHAR.xp || 0);
    const pcEarned = Math.floor(xp / 1000);
    const pcSpent = Number(CHAR.pc_spent || 0);
    const pcAvail = Math.max(0, pcEarned - pcSpent);
    const unlocked = (CHAR.skill_tree_unlocked || ['h-origin']).length;
    const cfg = TREE._meta.voies[SELECTED_VOIE];
    const inVoie = TREE.cases.filter(c => c.voie === SELECTED_VOIE).length;
    const unlockedInVoie = TREE.cases.filter(c =>
      c.voie === SELECTED_VOIE && (CHAR.skill_tree_unlocked || []).includes(c.id)).length;

    document.getElementById('voie-topbar').style.setProperty('--vc', cfg.color);
    document.getElementById('voie-topbar').innerHTML = ''
      + `<div class="vt-pill cyan"><span class="lbl">PC dispo</span><span class="val">${pcAvail}</span></div>`
      + `<div class="vt-pill"><span class="lbl">PC dépensés</span><span class="val">${pcSpent}</span></div>`
      + `<div class="vt-pill gold"><span class="lbl">XP</span><span class="val">${xp.toLocaleString('fr-FR')}</span></div>`
      + `<div class="vt-pill voie"><span class="lbl">Voie</span><span class="val">${unlockedInVoie} / ${inVoie}</span></div>`
      + `<div class="vt-pill"><span class="lbl">Total arbre</span><span class="val">${unlocked} / ${TREE.cases.length}</span></div>`;
  }

  function renderVoieTree() {
    const cfg = TREE._meta.voies[SELECTED_VOIE];
    const cases = TREE.cases.filter(c => c.voie === SELECTED_VOIE || c.id === 'h-origin');
    const unlocked = new Set(CHAR.skill_tree_unlocked || ['h-origin']);
    if (!unlocked.has('h-origin')) unlocked.add('h-origin');

    /* BBox : toutes les positions des cases de la voie + origin */
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cases) {
      if (c.pos.x < minX) minX = c.pos.x;
      if (c.pos.y < minY) minY = c.pos.y;
      if (c.pos.x > maxX) maxX = c.pos.x;
      if (c.pos.y > maxY) maxY = c.pos.y;
    }
    const PAD = 80;
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const w = maxX - minX, h = maxY - minY;

    function stateOf(c) {
      if (unlocked.has(c.id)) return 'unlocked';
      if ((c.requires || []).every(r => unlocked.has(r))) return 'ready';
      return 'locked';
    }

    /* Edges : courbes Bezier (S-curve verticale + asymétrie X-dependent).
       On n'affiche QUE les arêtes intra-voie (sinon visuel pollué). */
    let edges = '';
    for (const c of cases) {
      for (const reqId of (c.requires || [])) {
        const req = CASE_BY_ID[reqId];
        if (!req) continue;
        const inThis = (c.voie === SELECTED_VOIE) && (req.voie === SELECTED_VOIE || req.id === 'h-origin');
        if (!inThis) continue;
        const cls = unlocked.has(c.id) ? 'unlocked'
                  : (unlocked.has(reqId) ? 'ready' : 'locked');
        edges += `<path class="vc-edge ${cls}" d="${bezierPath(req.pos.x, req.pos.y, c.pos.x, c.pos.y)}"/>`;
      }
    }

    /* Nodes */
    let nodes = '';
    for (const c of cases) {
      const st = stateOf(c);
      const size = c.type === 'origin' ? 26 : c.type === 'palier' ? 24 : 14;
      const hex = hexPath(c.pos.x, c.pos.y, size);
      const icon = iconFor(c);
      nodes += `<g class="vc-node ${c.type} ${st}" data-id="${c.id}" style="--vc:${cfg.color}">`
            +    `<path class="vc-node-hex" d="${hex}"/>`
            +    `<text class="vc-node-icon" x="${c.pos.x}" y="${c.pos.y}">${icon}</text>`
            +  `</g>`;
    }

    const svg = document.getElementById('voie-svg');
    svg.setAttribute('viewBox', `${minX} ${minY} ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.style.minHeight = Math.max(540, h * 0.6) + 'px';
    svg.style.setProperty('--vc', cfg.color);
    svg.innerHTML = edges + nodes;

    /* Click sur un node */
    svg.querySelectorAll('.vc-node').forEach(g => {
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        SELECTED_CASE_ID = g.dataset.id;
        svg.querySelectorAll('.vc-node.selected').forEach(n => n.classList.remove('selected'));
        g.classList.add('selected');
        renderVoieSide();
      });
    });

    /* Auto-scroll vers le tier 1 (haut) au premier render */
    document.getElementById('voie-viewport').scrollTop = 0;
  }

  function renderVoieSide() {
    const side = document.getElementById('voie-side');
    if (!SELECTED_CASE_ID || !CASE_BY_ID[SELECTED_CASE_ID]) {
      side.innerHTML = '<div class="voie-side-empty">Sélectionne une case pour voir ses détails et la débloquer.</div>';
      return;
    }
    const c = CASE_BY_ID[SELECTED_CASE_ID];
    const cfg = TREE._meta.voies[c.voie] || TREE._meta.voies[SELECTED_VOIE] || { color: '#00e5ff' };
    side.style.setProperty('--vc', cfg.color);
    const unlocked = new Set(CHAR.skill_tree_unlocked || ['h-origin']);
    const isUnlocked = unlocked.has(c.id);
    const prereqMet = (c.requires || []).every(r => unlocked.has(r));
    const xp = Number(CHAR.xp || 0);
    const pcEarned = Math.floor(xp / 1000);
    const pcAvail = Math.max(0, pcEarned - Number(CHAR.pc_spent || 0));
    const enoughPC = pcAvail >= c.cost_pc;

    const tagLine = c.type === 'palier' ? `Palier · ${cfg.name}`
                  : c.type === 'origin' ? 'Point de départ'
                  : c.type === 'egg'    ? `Récompense · ${cfg.name}`
                  : `Tier ${c.tier} · ${cfg.name}`;
    const name = c.type === 'palier' ? c.palier_name
               : c.type === 'origin' ? 'Origine du parcours'
               : c.type === 'egg'    ? `Cache de ${c.eggs} Golden Egg${c.eggs>1?'s':''}`
               : `Augmentation ${c.id.split('-').pop().toUpperCase()}`;

    let html = `<div class="vs-tag">${tagLine}</div>`;
    html    += `<div class="vs-name">${name}</div>`;
    if (c.palier_desc) html += `<div class="vs-sub">${c.palier_desc}</div>`;
    if (c.desc)        html += `<div class="vs-sub">${c.desc}</div>`;

    if (c.effects && Object.keys(c.effects).length) {
      html += '<div class="vs-section"><div class="vs-section-title">Bonus appliqués</div><div class="vs-effects">';
      for (const [stat, amt] of Object.entries(c.effects)) {
        html += `<div class="vs-effect"><span class="vs-effect-lbl">${STAT_LABELS[stat]||stat}</span><span class="vs-effect-val">+${amt}</span></div>`;
      }
      html += '</div></div>';
    }
    if (c.eggs) {
      html += '<div class="vs-section"><div class="vs-section-title">Récompense</div><div class="vs-effects">';
      html += `<div class="vs-effect egg"><span class="vs-effect-lbl">Golden Eggs</span><span class="vs-effect-val">+${c.eggs}</span></div>`;
      html += '</div></div>';
    }
    if (c.requires && c.requires.length && c.type !== 'origin') {
      html += '<div class="vs-section"><div class="vs-section-title">Prérequis</div>';
      for (const r of c.requires) {
        const ok = unlocked.has(r);
        const pr = CASE_BY_ID[r];
        const label = pr ? `${pr.id} (${pr.type === 'palier' ? pr.palier_name : 'tier ' + (pr.tier ?? '?')})` : r;
        html += `<div class="vs-prereq ${ok?'met':'miss'}">${label}</div>`;
      }
      html += '</div>';
    }
    html += '<div class="vs-action">';
    if (isUnlocked) {
      html += '<div class="vs-status done">✓ Déjà débloquée</div>';
    } else if (!prereqMet) {
      html += '<button class="vs-btn-unlock" disabled><span>Prérequis non remplis</span></button>';
    } else if (!enoughPC) {
      html += `<button class="vs-btn-unlock" disabled><kbd>${c.cost_pc} PC</kbd><span>PC insuffisants (${pcAvail})</span></button>`;
    } else {
      html += `<button class="vs-btn-unlock" id="vs-do-unlock"><kbd>${c.cost_pc} PC</kbd><span>Débloquer</span></button>`;
    }
    html += '</div>';
    side.innerHTML = html;
    document.getElementById('vs-do-unlock')?.addEventListener('click', () => commitUnlock(c));
  }

  async function commitUnlock(c) {
    const btn = document.getElementById('vs-do-unlock');
    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Sauvegarde…'; }
    try {
      const update = {
        skill_tree_unlocked: firebase.firestore.FieldValue.arrayUnion(c.id),
        pc_spent:           firebase.firestore.FieldValue.increment(c.cost_pc),
        updated_at:         firebase.firestore.FieldValue.serverTimestamp(),
      };
      for (const [stat, amount] of Object.entries(c.effects || {})) {
        update['stats.' + (STAT_KEY_MAP[stat] || stat)] = firebase.firestore.FieldValue.increment(amount);
      }
      if (c.eggs) {
        update.golden_eggs = firebase.firestore.FieldValue.increment(c.eggs);
      }
      if (c.type === 'palier') {
        update.skill_tree_palier_slots = firebase.firestore.FieldValue.arrayUnion(null);
      }
      await db.collection('characters').doc(CHAR._id).update(update);

      /* Mise à jour locale optimiste */
      CHAR.skill_tree_unlocked = [...(CHAR.skill_tree_unlocked || []), c.id];
      CHAR.pc_spent = Number(CHAR.pc_spent || 0) + c.cost_pc;
      CHAR.stats = CHAR.stats || {};
      for (const [stat, amount] of Object.entries(c.effects || {})) {
        const k = STAT_KEY_MAP[stat] || stat;
        CHAR.stats[k] = Number(CHAR.stats[k] || 0) + amount;
      }
      if (c.eggs) CHAR.golden_eggs = Number(CHAR.golden_eggs || 0) + c.eggs;
      if (c.type === 'palier') CHAR.skill_tree_palier_slots = [...(CHAR.skill_tree_palier_slots || []), null];

      renderVoieTree();
      updateVoieTopbar();
      renderVoieSide();
      toast('Débloqué !', 'success');
    } catch (e) {
      window._dbg?.error?.('[comp] unlock', e);
      toast('Erreur : ' + (e.code || e.message || 'unknown'), 'error');
      if (btn) { btn.disabled = false; renderVoieSide(); }
    }
  }

  /* ═══ Helpers ═══ */
  function showStage(name) {
    document.querySelectorAll('.comp-stage').forEach(s => s.hidden = true);
    document.getElementById('stage-' + name).hidden = false;
    closeCallout();
    if (name !== 'voie') {
      // Reset selected case
      SELECTED_CASE_ID = null;
    }
  }
  function hexPath(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      d += (i === 0 ? 'M' : 'L') + (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  /* Bezier S-curve verticale entre 2 points : control points pull halfway down/up.
     Donne le visuel "data-flow / circuit organique" plutôt qu'un quadrillage. */
  function bezierPath(sx, sy, tx, ty) {
    const dy = ty - sy;
    /* Plus la distance verticale est grande, plus la courbure est douce.
       cy1 et cy2 placent les 2 control points à ~40% / 60% du chemin vertical. */
    const cy1 = sy + dy * 0.4;
    const cy2 = sy + dy * 0.6;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} `
         + `C ${sx.toFixed(1)} ${cy1.toFixed(1)}, ${tx.toFixed(1)} ${cy2.toFixed(1)}, `
         + `${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }
  function iconFor(c) {
    if (c.type === 'origin') return '⊙';
    if (c.type === 'egg')    return '◆';
    if (c.type === 'palier') return '★';
    const eff = c.effects || {};
    const stat = Object.entries(eff).sort((a,b)=>b[1]-a[1])[0];
    return stat ? STAT_LABELS[stat[0]].slice(0,1) : '·';
  }
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[m]);
  }
  function toast(msg, kind) {
    const t = document.getElementById('comp-toast');
    if (!t) return;
    t.className = 'comp-toast ' + (kind || '');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ═══ Init ═══ */
  document.addEventListener('DOMContentLoaded', () => {
    const verifyBtn = document.getElementById('verify-btn');
    const codeInp   = document.getElementById('link-code');
    verifyBtn.addEventListener('click', verifyCode);
    codeInp.addEventListener('keydown', e => { if (e.key === 'Enter') verifyCode(); });
    document.getElementById('comp-logout').addEventListener('click', logout);
    document.querySelectorAll('.stage-back').forEach(b => {
      b.addEventListener('click', () => showStage(b.dataset.back));
    });

    /* Restore session */
    SESS = getSess();
    if (SESS) onAuthOk();
  });

})();
