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
  let SELECTED_CASE_ID = null;       // legacy : encore utilisé par renderVoieSide stub
  let SELECTED_PENDING = new Set();  // v8 — multi-select des cases à débloquer (Apply)
  let APPLYING = false;              // verrou anti double-click sur Apply
  let IS_IRP_LINKED = false;

  const STAT_KEY_MAP = {
    str: 'strength', agi: 'agility', spd: 'speed',
    int: 'intelligence', mana: 'mana',
    res: 'resistance', cha: 'charisma',
    aura: 'aura',
  };
  const STAT_LABELS = {
    str:'STR', agi:'AGI', spd:'SPD', int:'INT', mana:'MNA', res:'RES', cha:'CHA', aura:'AUR'
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
      let data = null;
      if (typeof window.d1LinkSignIn === 'function') {
        try {
          const user = await window.d1LinkSignIn(code);
          data = { discord_id: user.discord_id, username: user.username, avatar_url: user.avatar_url };
        } catch (eAuth) {
          console.warn('[verifyCode] d1LinkSignIn failed:', eAuth && eAuth.message);
          const m = String(eAuth && eAuth.message || '');
          if (m.includes('404') || m.includes('410') || m.includes('400')) throw eAuth;
        }
      }
      if (!data) data = await db.runTransaction(async tx => {
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
      const xp    = Number(c.xp || 0);
      const pcSpent = Number(c.pc_spent || 0);
      const pcEarned = Math.floor(xp / 1000);
      const pcAvail = Math.max(0, pcEarned - pcSpent);
      /* Bot écrit `class` (race spécifique) et `race_category` (catégorie).
         Fallbacks pour anciens persos avec des champs legacy. */
      const race = c.class || c.race_specific || c.race || '—';
      const category = c.race_category || '';
      const img = c.profile_image || c.image_url || '';
      const meta = [esc(race), category ? esc(category) : null, `niv ${esc(c.level || '—')}`]
        .filter(Boolean).join(' · ');
      return ''
        + `<div class="char-card${c._isActive ? ' active' : ''}" data-charid="${esc(c._id)}">`
        +   (img
              ? `<div class="char-card-img" style="background-image:url('${esc(img)}')"></div>`
              : `<div class="char-card-img empty">?</div>`)
        +   `<div class="char-card-body">`
        +     `<div class="char-card-tag">${c._isActive ? '● Actif' : '○ Inactif'}</div>`
        +     `<div class="char-card-name">${esc((c.first_name||'') + ' ' + (c.last_name||'')).trim() || 'Personnage'}</div>`
        +     `<div class="char-card-meta">${meta}</div>`
        +     `<div class="char-card-stats">`
        +       `<div class="char-card-stat">XP <strong>${xp.toLocaleString('fr-FR')}</strong></div>`
        +       `<div class="char-card-stat">PC <strong>${pcAvail}</strong></div>`
        +       `<div class="char-card-stat">PC dépensés <strong>${pcSpent}</strong></div>`
        +     `</div>`
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

    /* Charge la skill tree de la race du perso (recharge si race différente du dernier perso). */
    const raceKey = String(CHAR.class || '').trim().toLowerCase();
    if (!TREE || TREE_RACE !== raceKey) {
      TREE = await loadTreeForRace(raceKey);
      TREE_RACE = raceKey;
    }
    if (!TREE) {
      /* Pas de tree disponible pour cette race → message + retour picker. */
      showNoTreeMessage(CHAR);
      return;
    }
    if (!TREE._cases_full) TREE._cases_full = TREE.cases.slice();

    /* Voies cachées :
        - immoral : flag hidden_unless_irp dans _meta.voies → besoin d'un lien IRP
        - evolution : flag hidden_until_base_full → toutes les voies "non spéciales" 100% unlock
       Les deux conditions sont strictement INDÉPENDANTES (pas d'effet de bord). */
    let voies = Object.assign({}, TREE._meta.voies);
    const HIDDEN_VOIES = new Set();
    for (const [key, cfg] of Object.entries(voies)) {
      if (cfg.hidden_unless_irp && !IS_IRP_LINKED) HIDDEN_VOIES.add(key);
      if (cfg.hidden_until_base_full && !isBaseVoiesFullUnlocked(CHAR, TREE)) HIDDEN_VOIES.add(key);
    }
    HIDDEN_VOIES.forEach(v => delete voies[v]);

    TREE.cases = TREE._cases_full.filter(c => !HIDDEN_VOIES.has(c.voie));
    CASE_BY_ID = Object.fromEntries(TREE.cases.map(c => [c.id, c]));

    /* Goto stage B */
    showStage('polygon');
    document.getElementById('poly-char-name').textContent =
      (CHAR.first_name || '') + ' ' + (CHAR.last_name || '');
    renderPolygonCenter(CHAR);
    renderPolygon(voies);
  }

  function showNoTreeMessage(char) {
    const stage = document.getElementById('stage-picker');
    /* On reste sur le stage picker mais on insère un toast explicatif. */
    toast(`Pas de Voie disponible pour le moment (${char.class || '—'}).`, 'error');
  }

  /* Mapping race spécifique (champ `class` du perso) → fichier de skill tree.
     Toute race absente de cette table → "Pas de Voie disponible". */
  const RACE_TREES = {
    human:                   'human.json',
    succubus:                'succubus.json',
    'aberration ancestrale': 'aberration_ancestrale.json',
    joker:                   'joker.json',
    devil:                   'devil.json',
    android:                 'android.json',
    slime:                   'slime.json',
    moth:                    'moth.json',
    vampire:                 'vampire.json',
  };
  let TREE_RACE = null; // race actuellement chargée (pour invalider si on change de perso)

  async function loadTreeForRace(raceName) {
    const key = String(raceName || '').trim().toLowerCase();
    const file = RACE_TREES[key];
    if (!file) return null;
    const res = await fetch(`data/skill-trees/${file}?v=8`, { cache: 'no-store' });
    if (!res.ok) return null;
    const tree = await res.json();
    /* Détecte l'ID de la case origine de cet arbre (h-origin pour humans,
       s-origin pour succubus, a-origin pour aberration, etc.) */
    const orig = (tree.cases || []).find(c => c.type === 'origin');
    ORIGIN_ID = (orig && orig.id) || 'h-origin';
    return tree;
  }

  /* "Voies de base" = toutes les voies SAUF celles flaggées hidden_unless_irp ou
     hidden_until_base_full. Cette définition est tirée de _meta.voies du JSON
     courant — donc elle s'adapte à n'importe quelle race (Human, Succubus, …)
     sans dépendance dure à des noms de voies.

     Les flags hidden_unless_irp et hidden_until_base_full sont strictement
     indépendants : débloquer une voie cachée ne révèle PAS l'autre. */
  function isBaseVoiesFullUnlocked(char, tree) {
    if (!char || !tree || !tree._meta || !tree._meta.voies) return false;
    const unlocked = new Set(char.skill_tree_unlocked || []);
    const BASE = new Set(
      Object.entries(tree._meta.voies)
        .filter(([, cfg]) => !cfg.hidden_unless_irp && !cfg.hidden_until_base_full)
        .map(([k]) => k)
    );
    if (!BASE.size) return false;
    let foundAtLeastOne = false;
    for (const c of (tree._cases_full || tree.cases || [])) {
      if (BASE.has(c.voie)) {
        foundAtLeastOne = true;
        if (!unlocked.has(c.id)) return false;
      }
    }
    return foundAtLeastOne;
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
    /* Le bot écrit la race spécifique dans `class`. Fallbacks pour anciens persos. */
    const race = char.class || char.race_specific || char.race || 'Inconnu';
    el.innerHTML = ''
      + `<div class="polygon-center-name">${esc((char.first_name||'') + ' ' + (char.last_name||''))}</div>`
      + `<div class="polygon-center-sub">${esc(race)}</div>`;
  }

  /* ─── 3D : bipyramid Three.js ───
     - Cristal type bipyramide : N sommets équatoriaux (= N voies) + 2 pôles décoratifs
     - Rotation lente continue, pause sur sélection
     - Vertex markers (sphères glow) cliquables via raycaster
     - Labels HTML overlay positionnés via projection 3D→2D
   */
  let _3d = null;     // {scene, camera, renderer, mesh, vertexMeshes, raf, autoRotate, voies, verts}
  let _vp = { tx:0, ty:0, scale:1, dragging:false, sx:0, sy:0, moved:false };
  let _voieVB = null; // bounding box voie courante (pour minimap / zoom reset)
  let ORIGIN_ID = 'h-origin'; // recalculé à chaque chargement de tree (dynamique selon la race)

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

    /* ── Points lumineux : petites sphères aux N sommets choisis (taille /6) ── */
    const allVerts = icosahedronVertices(R);
    const chosen   = pickVertices(allVerts, N);
    const sphereGeo = new THREE.SphereGeometry(0.014, 16, 16);
    const haloGeo   = new THREE.SphereGeometry(0.028, 16, 16);
    /* Hit sphere invisible (plus large) pour faciliter le clic sur les petits points */
    const hitGeo    = new THREE.SphereGeometry(0.18, 12, 12);

    const equatorVerts = [];
    chosen.forEach((vec, i) => {
      const color = new THREE.Color(orderedVoies[i][1].color || '#00e5ff');
      const sphere = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color }));
      sphere.position.copy(vec);
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.22, side: THREE.BackSide,
      }));
      halo.position.copy(vec);
      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(vec);
      hit.userData.idx = i;
      rotor.add(sphere); rotor.add(halo); rotor.add(hit);

      /* Label HTML — affiché en overlay, opacité 60% (modulée par la profondeur Z) */
      const label = document.createElement('div');
      label.className = 'poly-label';
      label.textContent = orderedVoies[i][1].name;
      label.style.setProperty('--vc', orderedVoies[i][1].color || '#00e5ff');
      label.dataset.idx = String(i);
      labels.appendChild(label);
      label.addEventListener('click', () => onVertexClick(i));

      equatorVerts.push({
        key: orderedVoies[i][0],
        cfg: orderedVoies[i][1],
        pos: vec,
        mesh: hit,        // raycaster cible la hit sphere (large mais invisible)
        sphere,           // visuel — petite sphère lumineuse
        halo,
        label,
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
    const _wp = new THREE.Vector3();
    const tick = () => {
      if (_3d.autoRotate) theta += 0.005;
      rotor.rotation.set(userPitch, theta + userYaw, 0);

      /* Reproject les labels sur l'écran à chaque frame */
      const W2 = wrap.clientWidth, H2 = wrap.clientHeight;
      for (const v of equatorVerts) {
        if (!v.label) continue;
        v.mesh.updateMatrixWorld();
        _wp.setFromMatrixPosition(v.mesh.matrixWorld);
        const sp = _wp.clone().project(camera);
        const sx = (sp.x * 0.5 + 0.5) * W2;
        const sy = (-sp.y * 0.5 + 0.5) * H2;
        /* Label positionné juste au-dessus du point (offset Y de 22px) */
        v.label.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - 22).toFixed(1)}px) translate(-50%, -50%)`;
        /* Profondeur : sp.z ∈ [-1,1]. Plus c'est loin (z>0), plus on fade. */
        const depth = Math.max(0.15, Math.min(1, 1 - (sp.z + 0.4) * 0.85));
        v.label.style.setProperty('--depth', depth.toFixed(2));
      }

      renderer.render(scene, camera);
      _3d.raf = requestAnimationFrame(tick);
    };

    _3d = {
      scene, camera, renderer, rotor,
      equatorVerts, autoRotate: false, raf: null,
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
  }

  /* ═══ Stage C : Skill Tree V3 ═══════════════════════════════════════ */

  function enterVoie(voieKey) {
    SELECTED_VOIE = voieKey;
    SELECTED_CASE_ID = null;
    SELECTED_PENDING.clear();
    showStage('voie');

    const container = document.getElementById('stage-voie');
    const cfg = TREE._meta.voies[voieKey];

    /* Déléguer au moteur SkillTreeV3 */
    if (window.SkillTreeV3) {
      SkillTreeV3.init({
        container,
        voieKey,
        voieCfg: cfg,
        char: CHAR,
        onUnlock: (node, vKey) => commitV3Unlock(node, vKey),
        onBack: () => showStage('polygon'),
      });
    }
  }

  /* Commit d'un nœud V3 vers Firestore */
  async function commitV3Unlock(node, voieKey) {
    /* Vérifie les fonds */
    const xp      = Number(CHAR.xp || 0);
    const earned  = Math.floor(xp / 1000);
    const spent   = Number(CHAR.pc_spent || 0);
    const avail   = Math.max(0, earned - spent);
    if (node.cost > avail) throw new Error('Fonds insuffisants');

    /* Mise à jour du personnage en mémoire */
    const unlocked = Array.from(new Set([
      ...(CHAR.skill_tree_unlocked || []),
      node.id,
    ]));

    const updates = {
      skill_tree_unlocked: unlocked,
      pc_spent: spent + (node.cost || 0),
    };

    /* Appliquer les effets de stat */
    if (node.stat && node.amount) {
      const statKey = node.stat;
      const cur = Number(CHAR[statKey] || CHAR.stats?.[statKey] || 0);
      updates[statKey] = cur + node.amount;
    }

    /* Golden Eggs */
    if (node.eggs > 0) {
      updates.golden_eggs = (Number(CHAR.golden_eggs || 0)) + node.eggs;
    }

    /* Navarites */
    if (node.navarites > 0) {
      updates.navarites = (Number(CHAR.navarites || 0)) + node.navarites;
    }

    /* Écriture Firestore */
    await db.collection('characters').doc(CHAR._id).update(updates);

    /* Sync état local */
    Object.assign(CHAR, updates);

    toast(`✓ Débloqué${node.stat ? ' +' + node.amount + ' ' + node.stat.toUpperCase() : node.eggs ? ' +' + node.eggs + ' Eggs' : node.navarites ? ' +' + node.navarites + ' Nav' : ''}`, 'success');
  }

  function updateVoieTopbar() {
    const xp = Number(CHAR.xp || 0);
    const pcEarned = Math.floor(xp / 1000);
    const pcSpent = Number(CHAR.pc_spent || 0);
    const pcAvail = Math.max(0, pcEarned - pcSpent);
    const unlocked = (CHAR.skill_tree_unlocked || [ORIGIN_ID]).length;
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

    /* HUD overlay + boutons Apply/Unselect — peuplés par _renderVoieOverlays
       (v8 — renommé depuis _renderVoieHud, qui ne supportait pas le pending). */
    _renderVoieOverlays();
  }

  /* ═══ Multi-select + Apply / Unselect (v8 — proto voie-v2) ═══════════ */

  /* Coût total des cases en attente (pending) */
  function pendingCost() {
    let s = 0;
    for (const id of SELECTED_PENDING) {
      const c = CASE_BY_ID[id];
      if (c) s += Number(c.cost_pc || 0);
    }
    return s;
  }

  /* PC disponibles (calc à partir de XP/PC_dépensés) */
  function pcAvailable() {
    const xp = Number(CHAR?.xp || 0);
    const pcEarned = Math.floor(xp / 1000);
    const pcSpent = Number(CHAR?.pc_spent || 0);
    return Math.max(0, pcEarned - pcSpent);
  }

  /* Une case est-elle "atteignable" (requires satisfaits par unlocked OU pending) ? */
  function isReachable(c) {
    if (!c) return false;
    if (c.id === ORIGIN_ID) return true;
    const unlocked = new Set(CHAR.skill_tree_unlocked || [ORIGIN_ID]);
    return (c.requires || []).every(r => unlocked.has(r) || SELECTED_PENDING.has(r));
  }

  /* Chemin minimal pour rendre `targetId` atteignable : DFS post-order
     sur les requires, ignore les cases déjà unlocked ou déjà pending.
     Retourne les ids dans l'ordre des dépendances (prérequis d'abord,
     target en dernier). Sert au clic sur une case lointaine. */
  function computeUnlockPath(targetId) {
    const unlocked = new Set(CHAR.skill_tree_unlocked || [ORIGIN_ID]);
    const visited = new Set();
    const path = [];
    (function visit(id) {
      if (unlocked.has(id) || SELECTED_PENDING.has(id) || visited.has(id)) return;
      visited.add(id);
      const c = CASE_BY_ID[id];
      if (!c) return;
      for (const r of (c.requires || [])) visit(r);
      path.push(id);
    })(targetId);
    return path;
  }

  function _sumPathCost(ids) {
    return ids.reduce((s, id) => s + Number((CASE_BY_ID[id] || {}).cost_pc || 0), 0);
  }

  /* Toggle sélection avec auto-pathing :
     - Case déjà débloquée → no-op
     - Case dans pending → on retire (avec cascade orphan-cleanup)
     - Case atteignable mais PC insuffisants → message explicite "il manque X PC"
     - Case LOINTAINE (prérequis manquants) → calcule le chemin complet et
       ajoute TOUTES les cases du chemin si on a assez de PC, sinon
       message explicite "il manque X PC pour atteindre ce stade".
  */
  function toggleSelectCase(id) {
    const c = CASE_BY_ID[id];
    if (!c) return;
    const unlocked = new Set(CHAR.skill_tree_unlocked || [ORIGIN_ID]);
    if (unlocked.has(id)) return;

    if (SELECTED_PENDING.has(id)) {
      SELECTED_PENDING.delete(id);
      /* Cascade : si on retire X, retirer aussi les pending qui dépendent de X */
      let changed = true;
      while (changed) {
        changed = false;
        for (const pid of [...SELECTED_PENDING]) {
          const pc = CASE_BY_ID[pid];
          const ok = (pc.requires || []).every(r => unlocked.has(r) || SELECTED_PENDING.has(r));
          if (!ok) { SELECTED_PENDING.delete(pid); changed = true; }
        }
      }
      renderVoieTree();
      updateVoieTopbar();
      return;
    }

    /* Cas lointain : on calcule le chemin complet. Si la case est déjà
       atteignable, le chemin contient juste la case elle-même (1 élément). */
    const path = computeUnlockPath(id);
    const pathCost = _sumPathCost(path);
    const remaining = pcAvailable() - pendingCost();

    if (pathCost > remaining) {
      const missing = pathCost - remaining;
      const isPath = path.length > 1;
      toast(
        isPath
          ? `Il manque ${missing} PC pour atteindre ce stade · chemin : ${path.length} cases · ${pathCost} PC`
          : `Il manque ${missing} PC pour débloquer cette case`,
        'error'
      );
      return;
    }

    path.forEach(pid => SELECTED_PENDING.add(pid));
    renderVoieTree();
    updateVoieTopbar();
    if (path.length > 1) {
      toast(`Chemin sélectionné · ${path.length} cases · ${pathCost} PC`, 'success');
    }
  }

  function unselectAllPending() {
    if (SELECTED_PENDING.size === 0) return;
    SELECTED_PENDING.clear();
    renderVoieTree();
    updateVoieTopbar();
  }

  async function applyPending() {
    if (APPLYING) return;
    if (SELECTED_PENDING.size === 0) return;
    APPLYING = true;
    const ids = [...SELECTED_PENDING];
    const list = ids.map(id => CASE_BY_ID[id]).filter(Boolean);
    try {
      await commitUnlockBatch(list);
      SELECTED_PENDING.clear();
      renderVoieTree();
      updateVoieTopbar();
      toast(`Débloqué : ${list.length} case${list.length>1?'s':''}`, 'success');
    } catch (e) {
      window._dbg?.error?.('[comp] applyPending', e);
      toast('Erreur : ' + (e.code || e.message || 'unknown'), 'error');
    } finally {
      APPLYING = false;
    }
  }

  /* HUD overlay + Apply/Unselect buttons — peuplés à chaque render */
  function _renderVoieOverlays() {
    const cfg = TREE._meta.voies[SELECTED_VOIE];
    const pcAvail = pcAvailable();
    const pending = pendingCost();
    const inVoie = TREE.cases.filter(c => c.voie === SELECTED_VOIE).length;
    const unlockedInVoie = TREE.cases.filter(c =>
      c.voie === SELECTED_VOIE && (CHAR.skill_tree_unlocked || []).includes(c.id)).length;

    const hud = document.getElementById('voie-hud');
    if (hud) {
      hud.style.setProperty('--vc', cfg.color);
      hud.innerHTML = ''
        + `<div class="voie-hud-top">`
        +   `<div class="voie-hud-label">Points de compétence disponibles</div>`
        +   `<div class="voie-hud-pill">`
        +     `<span class="voie-hud-dot"></span>`
        +     `<span class="voie-hud-num">${pcAvail}</span>`
        +     `<span class="voie-hud-pending ${pending>0?'':'zero'}">−${pending}</span>`
        +   `</div>`
        +   `<div class="voie-hud-progress">${unlockedInVoie} / ${inVoie} · ${esc(cfg.name)}</div>`
        + `</div>`
        + `<div class="voie-hud-help">`
        +   `<div><strong>Clic</strong> · sélectionner</div>`
        +   `<div><strong>Drag</strong> · déplacer · <strong>Molette</strong> · zoom</div>`
        +   `<div><strong>Entrée</strong> · valider · <strong>Échap</strong> · tout désélectionner</div>`
        + `</div>`;
    }

    const actions = document.getElementById('voie-actions');
    if (actions) {
      const has = pending > 0;
      actions.innerHTML = ''
        + `<div class="va-btn ${has?'':'disabled'}" id="va-btn-unselect">`
        +   `<div class="key">ÉCHAP</div><div class="lbl">Tout désélectionner</div>`
        + `</div>`
        + `<div class="va-btn apply ${has?'has-pending':'disabled'}" id="va-btn-apply">`
        +   `<div class="key">ENTRÉE</div><div class="lbl">Valider les achats${has?' ('+SELECTED_PENDING.size+')':''}</div>`
        + `</div>`;
      const $un = document.getElementById('va-btn-unselect');
      const $ap = document.getElementById('va-btn-apply');
      if ($un) $un.addEventListener('click', () => unselectAllPending());
      if ($ap) $ap.addEventListener('click', () => applyPending());
    }
  }

  /* ─── Tooltip flottant (au hover sur une case) ─── */
  function showVoieTooltip(c) {
    const tt = document.getElementById('voie-tooltip');
    if (!tt || !c) return;
    const unlocked = new Set(CHAR.skill_tree_unlocked || [ORIGIN_ID]);
    let effHtml = '';
    if (c.effects) {
      for (const [k, v] of Object.entries(c.effects)) {
        effHtml += `<div class="vt-effect"><span>${STAT_LABELS[k]||k}</span><span class="v">+${v}</span></div>`;
      }
    }
    if (c.eggs)       effHtml += `<div class="vt-effect"><span>Golden Eggs</span><span class="v">+${c.eggs}</span></div>`;
    if (c.navarites)  effHtml += `<div class="vt-effect"><span>Navarites</span><span class="v">+${c.navarites}</span></div>`;
    if (c.jahartites) effHtml += `<div class="vt-effect"><span>Jahartites</span><span class="v">+${c.jahartites}</span></div>`;
    if (c.palier_desc) effHtml += `<div class="vt-effect"><span style="opacity:.75">${esc(c.palier_desc)}</span></div>`;
    if (c.transforms_race_to) effHtml += `<div class="vt-effect"><span style="opacity:.75">Transforme en : <strong>${esc(c.transforms_race_to)}</strong></span></div>`;
    if (c.grants_power) effHtml += `<div class="vt-effect"><span style="opacity:.75">Pouvoir : <strong>${esc(c.grants_power_name||c.grants_power)}</strong></span></div>`;
    if (c.unlocks_racial_power_slot) effHtml += `<div class="vt-effect"><span style="opacity:.75">+1 slot de pouvoir racial</span></div>`;

    const state = unlocked.has(c.id) ? 'unlocked'
      : SELECTED_PENDING.has(c.id) ? 'selected'
      : isReachable(c) ? 'ready' : 'locked';
    const cost = Number(c.cost_pc || 0);
    const affordable = pendingCost() + cost <= pcAvailable() || SELECTED_PENDING.has(c.id);
    const costClass = (state === 'locked' && !affordable) ? 'unaffordable' : '';

    tt.innerHTML = ''
      + `<div class="vt-head">`
      +   `<div class="vt-icon">${iconFor(c)}</div>`
      +   `<div class="vt-title">${esc(labelFor(c) || (c.id))}</div>`
      + `</div>`
      + (effHtml ? `<div class="vt-effects">${effHtml}</div>` : '')
      + `<div class="vt-cost ${costClass}">${state === 'unlocked' ? 'Déjà débloquée' : `Coût · ${cost} PC`}</div>`
      + `<div class="vt-status">${
        state === 'unlocked' ? '<span style="color:#00e5ff">✓ DÉBLOQUÉE</span>'
        : state === 'selected' ? '<span style="color:#fff">◉ SÉLECTIONNÉE</span>'
        : state === 'ready'    ? '<span style="color:#00e5ff">PRÊTE</span>'
        : '<span style="color:#FF4757">🔒 VERROUILLÉE</span>'
      }</div>`;
    tt.hidden = false;
    tt.classList.add('show');
  }
  function moveVoieTooltip(e) {
    const tt = document.getElementById('voie-tooltip');
    if (!tt) return;
    const tw = tt.offsetWidth || 240, th = tt.offsetHeight || 100;
    let x = e.clientX + 18, y = e.clientY;
    if (x + tw > window.innerWidth - 12) x = e.clientX - tw - 18;
    if (y - th/2 < 12) y = th/2 + 12;
    if (y + th/2 > window.innerHeight - 12) y = window.innerHeight - th/2 - 12;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  }
  function hideVoieTooltip() {
    const tt = document.getElementById('voie-tooltip');
    if (tt) { tt.classList.remove('show'); tt.hidden = true; }
  }

  /* ───────────────────────────────────────────────────────────────────
   * v8 — Palette de couleurs par type + état (refonte proto voie-v2) :
   *   - origin            → cyan
   *   - locked (any)      → rouge sombre
   *   - unlocked stat     → bleu (#4DA3FF)
   *   - unlocked egg      → jaune (#ffd60a)
   *   - unlocked navarites→ violet (#9b59ff)
   *   - unlocked jahartites→ jade (#34d399)
   *   - palier final      → couleur de voie
   * Le retour est injecté dans CSS var --node-color sur l'élément <g>.
   * ─────────────────────────────────────────────────────────────────── */
  function nodeColor(c, state, voieCfg) {
    if (c.type === 'origin') return '#00e5ff';
    if (state === 'locked')  return '#6e1620';
    if (c.type === 'palier') return voieCfg.color;
    if (c.type === 'egg')    return '#ffd60a';
    if (c.navarites)         return '#9b59ff';
    if (c.jahartites)        return '#34d399';
    return '#4DA3FF';
  }

  /* Catégorie de "type" CSS — pour les sélecteurs CSS .vc-node.egg/nav/etc.
     Le typage existant n'a que 'origin'/'palier'/'egg' ; on dérive 'nav'/'jah'
     à partir de la présence des champs (cas pratique des voies de l'immoral). */
  function typeClass(c) {
    if (c.type === 'origin' || c.type === 'palier' || c.type === 'egg') return c.type;
    if (c.navarites)  return 'nav';
    if (c.jahartites) return 'jahartites';
    return 'stat';
  }

  function renderVoieTree() {
    const cfg = TREE._meta.voies[SELECTED_VOIE];
    const cases = TREE.cases.filter(c => c.voie === SELECTED_VOIE || c.id === ORIGIN_ID);
    const unlocked = new Set(CHAR.skill_tree_unlocked || []);
    if (!unlocked.has(ORIGIN_ID)) unlocked.add(ORIGIN_ID);

    /* Layout scatter pseudo-random (computeFanLayout v8). */
    const layoutPos = computeFanLayout(cases);
    const getPos = (id) => layoutPos[id] || { x: 0, y: 0 };

    /* BBox sur les positions calculées */
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cases) {
      const p = getPos(c.id);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const PAD = 90;
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const w = maxX - minX, h = maxY - minY;

    function stateOf(c) {
      if (unlocked.has(c.id)) return 'unlocked';
      if (SELECTED_PENDING.has(c.id)) return 'selected';
      /* Une case est "ready" (achetable) si tous ses requires sont soit déjà
         unlocked soit sélectionnés en pending → enchaîner des achats est OK. */
      if ((c.requires || []).every(r => unlocked.has(r) || SELECTED_PENDING.has(r))) return 'ready';
      return 'locked';
    }

    /* Edges : lignes droites, trim adapté au rayon réel de chaque nœud */
    const radiusOf = (c) => c.type === 'origin' ? 30 : c.type === 'palier' ? 26 : 16;
    let edges = '';
    for (const c of cases) {
      for (const reqId of (c.requires || [])) {
        const req = CASE_BY_ID[reqId];
        if (!req) continue;
        const inThis = (c.voie === SELECTED_VOIE) && (req.voie === SELECTED_VOIE || req.id === ORIGIN_ID);
        if (!inThis) continue;
        const reach = s => s === 'unlocked';
        const sA = stateOf(req), sB = stateOf(c);
        const cls = reach(sA) && reach(sB) ? 'unlocked'
                  : (reach(sA) || reach(sB) || sA === 'selected' || sB === 'selected') ? 'ready'
                  : 'locked';
        const cp = getPos(c.id), rp = getPos(reqId);
        const dx = cp.x - rp.x, dy = cp.y - rp.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const trimA = radiusOf(req) + 2;
        const trimB = radiusOf(c)   + 2;
        const x1 = (rp.x + ux * trimA).toFixed(1);
        const y1 = (rp.y + uy * trimA).toFixed(1);
        const x2 = (cp.x - ux * trimB).toFixed(1);
        const y2 = (cp.y - uy * trimB).toFixed(1);
        edges += `<line class="vc-edge ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    }

    /* Nodes — rendu circulaire avec halo doux pulsant (proto v2). */
    let nodes = '';
    for (const c of cases) {
      const st = stateOf(c);
      const p = getPos(c.id);
      const size = c.type === 'origin' ? 30 : c.type === 'palier' ? 26 : 16;
      const main  = circlePath(p.x, p.y, size);
      const halo  = circlePath(p.x, p.y, size + 8);
      const inner = circlePath(p.x, p.y, Math.max(3, size - 5));
      const icon = iconFor(c);
      /* Label sous le nœud : pour TOUTES les cases sauf locked stats anonymes —
         les stats unlockables affichent leur gain (ex "STR+3"), eggs / nav / pal
         affichent leur récompense. Format compact, monospace. */
      const label = labelFor(c);
      const labelSvg = label
        ? `<text class="vc-node-label" x="${p.x}" y="${(p.y + size + 13).toFixed(1)}">${esc(label)}</text>`
        : '';
      /* Perf : halo path uniquement pour les cases actives (locked → skip) */
      const haloSvg = (st === 'locked' && c.type !== 'origin')
        ? ''
        : `<path class="vc-node-halo" d="${halo}"/>`;
      const color = nodeColor(c, st, cfg);
      const tCls = typeClass(c);
      const reachable = st !== 'locked' || (c.requires || []).every(r => unlocked.has(r) || SELECTED_PENDING.has(r));
      nodes += `<g class="vc-node ${tCls} ${st}" data-id="${c.id}" data-reachable="${reachable}" style="--node-color:${color}">`
            +    haloSvg
            +    `<path class="vc-node-hex"   d="${main}"/>`
            +    `<path class="vc-node-inner" d="${inner}"/>`
            +    `<text class="vc-node-icon" x="${p.x}" y="${p.y}">${icon}</text>`
            +    labelSvg
            +  `</g>`;
    }

    const svg = document.getElementById('voie-svg');
    svg.removeAttribute('viewBox');
    svg.removeAttribute('preserveAspectRatio');
    svg.style.minHeight = '';
    svg.style.setProperty('--vc', cfg.color);
    /* Defs SVG (v8) — glow-soft (2 couches) plus discret que glow-neon, +
       gradient rouge sombre pour le fond des cases locked, + glow-line pour
       les edges unlocked. */
    const defs = `<defs>
      <filter id="vt-glow-soft" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="3" result="b1"/>
        <feGaussianBlur stdDeviation="6" result="b2" in="SourceGraphic"/>
        <feMerge>
          <feMergeNode in="b2"/>
          <feMergeNode in="b1"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="vt-glow-line" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="1.4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="vt-node-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%"  stop-color="#0a1230"/>
        <stop offset="70%" stop-color="#040814"/>
        <stop offset="100%" stop-color="#020713"/>
      </radialGradient>
      <radialGradient id="vt-node-core-locked" cx="50%" cy="50%" r="50%">
        <stop offset="0%"  stop-color="#2a0a10"/>
        <stop offset="65%" stop-color="#180408"/>
        <stop offset="100%" stop-color="#0a0203"/>
      </radialGradient>
    </defs>`;
    svg.innerHTML = defs + `<g id="voie-canvas">${edges}${nodes}</g>`;

    /* Click sur un node : multi-select / unselect (cascade) */
    svg.querySelectorAll('.vc-node').forEach(g => {
      const cid = g.dataset.id;
      g.addEventListener('click', (e) => {
        if (_vp.moved) return;
        e.stopPropagation();
        toggleSelectCase(cid);
      });
      g.addEventListener('mouseenter', () => showVoieTooltip(CASE_BY_ID[cid]));
      g.addEventListener('mousemove', moveVoieTooltip);
      g.addEventListener('mouseleave', hideVoieTooltip);
    });

    /* HUD + Actions overlay (peuplés à chaque render pour refléter pending/PC) */
    _renderVoieOverlays();

    /* Zoom/pan + minimap : raf pour attendre le layout visible */
    const _vb = { x: minX, y: minY, w, h };
    if (!_voieVB) {
      requestAnimationFrame(() => { initVoieZoom(_vb); _buildMinimap(_vb, cases, layoutPos); });
    } else {
      _applyVpTransform();
      _buildMinimap(_vb, cases, layoutPos);
      _refreshMinimap();
    }
  }

  /* renderVoieSide — stub no-op (v8 — side panel supprimé, infos déplacées
     dans le tooltip flottant + HUD du viewport). Conservé pour compat avec
     les anciens appels (loadVoie, etc.) qui pourraient encore l'invoquer. */
  function renderVoieSide() { /* deprecated — voir showVoieTooltip + _renderVoieOverlays */ }

  /* commitUnlockBatch — débloque plusieurs cases en 1 seul batch Firestore.
     Aggregate toutes les déltas (PC, stats, eggs, nav, jah, slots, pouvoirs,
     transformations) en un seul update sur characters/{id}. Les navarites
     vivent sur players/{discord_id} → ajoutées au batch séparément. */
  const RACE_CATEGORY_MAP = {
    'Blasphémée':              'Angelic',
    'Aberration ancestrale':   'Mythical Zooids',
    'Archdevil':               'Demons',
    'Nureonago':               'Semi-Liquid',
  };

  async function commitUnlockBatch(list) {
    if (!list.length) return;
    /* Aggrégation des deltas */
    let totalPc = 0;
    const statDelta = {};       // stat key → total amount
    let eggsTotal = 0;
    let navTotal  = 0;
    let jahTotal  = 0;
    const powers = [];
    const slots = [];
    let auraEnable = false;
    let transformTo = null;
    const ids = [];

    for (const c of list) {
      totalPc += Number(c.cost_pc || 0);
      for (const [stat, amount] of Object.entries(c.effects || {})) {
        const k = STAT_KEY_MAP[stat] || stat;
        statDelta[k] = (statDelta[k] || 0) + amount;
      }
      if (c.eggs)        eggsTotal += c.eggs;
      if (c.navarites)   navTotal  += c.navarites;
      if (c.jahartites)  jahTotal  += c.jahartites;
      if (c.unlocks_racial_power_slot) slots.push(null);
      /* Stocke le pouvoir comme OBJET { id, name } pour matcher le format lu par
         hub-renders.js / fiches.js / hub-character.js (qui font `pw.name || pw`).
         Si on stockait juste l'ID string, le hub afficherait "android quantum ai"
         (snake_case) au lieu de "Quantum AI Assistance". */
      if (c.grants_power) {
        powers.push({
          id:   c.grants_power,
          name: c.grants_power_name || c.grants_power.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
        });
      }
      if (c.unlocks_stat === 'aura') auraEnable = true;
      if (c.transforms_race_to) transformTo = c.transforms_race_to; // dernier gagne
      ids.push(c.id);
    }

    /* Construction du payload update */
    const update = {
      skill_tree_unlocked: firebase.firestore.FieldValue.arrayUnion(...ids),
      pc_spent:           firebase.firestore.FieldValue.increment(totalPc),
      updated_at:         firebase.firestore.FieldValue.serverTimestamp(),
    };
    for (const [k, v] of Object.entries(statDelta)) {
      update['stats.' + k] = firebase.firestore.FieldValue.increment(v);
    }
    if (eggsTotal) update.golden_eggs = firebase.firestore.FieldValue.increment(eggsTotal);
    if (jahTotal)  update.jahartites  = firebase.firestore.FieldValue.increment(jahTotal);
    if (slots.length) update.skill_tree_palier_slots = firebase.firestore.FieldValue.arrayUnion(...slots);
    if (powers.length) update.powers = firebase.firestore.FieldValue.arrayUnion(...powers);
    if (auraEnable) update.aura_enabled = true;
    if (transformTo) {
      update.class = transformTo;
      if (RACE_CATEGORY_MAP[transformTo]) update.race_category = RACE_CATEGORY_MAP[transformTo];
    }

    /* Batch : characters + players (navarites vivent sur players/{discord_id}) */
    const batch = db.batch();
    batch.update(db.collection('characters').doc(CHAR._id), update);
    if (navTotal && SESS && SESS.id) {
      batch.set(
        db.collection('players').doc(String(SESS.id)),
        { navarites: firebase.firestore.FieldValue.increment(navTotal) },
        { merge: true }
      );
    }
    await batch.commit();

    /* MAJ locale optimiste */
    CHAR.skill_tree_unlocked = [...(CHAR.skill_tree_unlocked || []), ...ids];
    CHAR.pc_spent = Number(CHAR.pc_spent || 0) + totalPc;
    CHAR.stats = CHAR.stats || {};
    for (const [k, v] of Object.entries(statDelta)) {
      CHAR.stats[k] = Number(CHAR.stats[k] || 0) + v;
    }
    if (eggsTotal) CHAR.golden_eggs = Number(CHAR.golden_eggs || 0) + eggsTotal;
    if (jahTotal)  CHAR.jahartites  = Number(CHAR.jahartites  || 0) + jahTotal;
    if (slots.length) CHAR.skill_tree_palier_slots = [...(CHAR.skill_tree_palier_slots || []), ...slots];
    if (powers.length) {
      CHAR.powers = CHAR.powers || [];
      /* p est maintenant un objet { id, name } — dedup par p.id contre les
         pouvoirs déjà présents (qui peuvent être strings legacy ou objets). */
      for (const p of powers) {
        const pid = p.id;
        if (!CHAR.powers.some(pp => (typeof pp === 'string' ? pp : pp?.id) === pid)) {
          CHAR.powers = [...CHAR.powers, p];
        }
      }
    }
    if (auraEnable) CHAR.aura_enabled = true;
    if (transformTo) {
      CHAR.class = transformTo;
      if (RACE_CATEGORY_MAP[transformTo]) CHAR.race_category = RACE_CATEGORY_MAP[transformTo];
    }
  }

  /* commitUnlock (legacy) — wrapper sur commitUnlockBatch pour 1 case unique */
  async function commitUnlock(c) {
    try { await commitUnlockBatch([c]); renderVoieTree(); updateVoieTopbar(); toast('Débloqué !', 'success'); }
    catch (e) { window._dbg?.error?.('[comp] unlock', e); toast('Erreur : ' + (e.code || e.message || 'unknown'), 'error'); }
  }

  /* ═══ Helpers ═══ */
  function showStage(name) {
    document.querySelectorAll('.comp-stage').forEach(s => s.hidden = true);
    document.getElementById('stage-' + name).hidden = false;
    closeCallout();
    if (name !== 'voie') {
      SELECTED_CASE_ID = null;
      /* Détruire l'arbre V3 si on quitte le stage-voie */
      window.SkillTreeV3?.destroy?.();
    }
  }
  /* Layout constellation guidée par les prérequis (v9) :
       Origine au centre (0,0). Chaque case d'un tier N est placée dans son
       anneau (rayon TIER_R*N ± jitter), MAIS son angle est tiré autour de
       l'angle moyen de ses parents → l'enfant reste dans le voisinage
       angulaire de ses parents → edges courtes, peu de croisements.
       Le jitter angulaire (~25-90% d'une tranche de roue) garde l'aspect
       "constellation légèrement random" sans tomber dans le rigide.
       Tier 1 (parents = origin uniquement) reçoit une distribution uniforme
       sur 360° + jitter ±60% du pas, pour bien étaler les spokes.
       PRNG seedé voie+race → layout stable cross-load. */
  function computeFanLayout(cases) {
    const ORIGIN = ORIGIN_ID;
    const positions = { [ORIGIN]: { x: 0, y: 0 } };
    const angles    = { [ORIGIN]: 0 };

    /* PRNG seedé déterministe (LCG) */
    const seedStr = `${TREE.race || 'X'}-${SELECTED_VOIE || 'X'}`;
    let _s = 0;
    for (const ch of seedStr) _s = ((_s << 5) + _s + ch.charCodeAt(0)) | 0;
    _s = Math.abs(_s) || 1;
    const rand = () => { _s = (_s * 1664525 + 1013904223) | 0; return ((_s >>> 0) % 1000000) / 1000000; };

    const byTier = {};
    for (const c of cases) {
      if (c.id === ORIGIN) continue;
      const t = c.tier || 1;
      (byTier[t] = byTier[t] || []).push(c);
    }
    const tiers = Object.keys(byTier).map(Number).sort((a,b) => a - b);

    const TIER_R        = 95;
    const RADIUS_JITTER = 30;
    const MIN_SPACING   = 55;
    const MAX_TRIES     = 80;

    const n_t1 = (byTier[1] || []).length || 1;
    const wheelSlice = (2 * Math.PI) / n_t1;   // une "tranche" de roue (~36° avec 10 t1)

    /* Helper : tente de placer une case à un angle cible + jitter croissant. */
    const placeCase = (c, baseR, targetAng, baseJitterRatio) => {
      for (let t = 0; t < MAX_TRIES; t++) {
        /* Jitter angulaire qui s'élargit avec les tentatives :
           démarre à baseJitterRatio, finit à ~0.95 d'une tranche complète. */
        const jr = baseJitterRatio + (t / MAX_TRIES) * (0.95 - baseJitterRatio);
        const angJitter = (rand() - 0.5) * wheelSlice * jr * 2;
        const ang = targetAng + angJitter;
        const r = baseR + (rand() - 0.5) * RADIUS_JITTER * 2;
        const x = r * Math.cos(ang), y = r * Math.sin(ang);
        let ok = true;
        for (const id in positions) {
          const p = positions[id];
          if (Math.hypot(x - p.x, y - p.y) < MIN_SPACING) { ok = false; break; }
        }
        if (ok) return { x, y, ang };
      }
      /* Fallback ultime : on lâche le min-spacing, on garde juste angle cible + grand jitter */
      const ang = targetAng + (rand() - 0.5) * wheelSlice * 1.6;
      const r = baseR + (rand() - 0.5) * RADIUS_JITTER * 2;
      return { x: r * Math.cos(ang), y: r * Math.sin(ang), ang };
    };

    for (const tier of tiers) {
      const baseR = TIER_R * tier;
      const items = byTier[tier];

      if (tier === 1) {
        /* Répartition uniforme sur 360° + jitter ±60% du pas — donne un cercle
           de spokes scatter mais bien étalé. Stable via tri alphabétique d'IDs. */
        const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
        const step = (2 * Math.PI) / sorted.length;
        for (let i = 0; i < sorted.length; i++) {
          const c = sorted[i];
          const target = i * step;
          const placed = placeCase(c, baseR, target, 0.30);
          angles[c.id]    = placed.ang;
          positions[c.id] = { x: placed.x, y: placed.y };
        }
      } else {
        /* Tier ≥ 2 : angle cible = moyenne vectorielle des angles des parents
           (évite les pièges de wrap-around 0/2π). Jitter de départ resserré
           (~25% d'une tranche) → cohérent avec le parent ; s'élargit si la
           zone est encombrée. */
        const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
        for (const c of sorted) {
          const pa = (c.requires || []).filter(r => angles[r] !== undefined);
          let target;
          if (pa.length === 0) {
            target = rand() * Math.PI * 2;
          } else {
            let sx = 0, sy = 0;
            for (const r of pa) { sx += Math.cos(angles[r]); sy += Math.sin(angles[r]); }
            target = Math.atan2(sy, sx);
          }
          const placed = placeCase(c, baseR, target, 0.25);
          angles[c.id]    = placed.ang;
          positions[c.id] = { x: placed.x, y: placed.y };
        }
      }
    }
    return positions;
  }

  /* Nœud circulaire premium (v5) — l'ancien hexagone est remplacé par un
     cercle SVG via deux arcs. La signature est conservée pour ne rien casser
     dans les appels existants. */
  function hexPath(cx, cy, r) {
    return `M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} `
         + `a ${r} ${r} 0 1 0 ${(2 * r).toFixed(1)} 0 `
         + `a ${r} ${r} 0 1 0 ${(-2 * r).toFixed(1)} 0 Z`;
  }
  /* Alias sémantique pour la suite — même implémentation, nom plus juste. */
  const circlePath = hexPath;

  /* Courbe quadratique avec léger offset perpendiculaire (vers l'origine 0,0)
     — donne un visuel organique pour le layout radial. */
  function bezierPath(sx, sy, tx, ty) {
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    /* Vecteur du midpoint vers l'origine, normalisé puis multiplié par une
       petite fraction de la distance — courbe légèrement vers le centre. */
    const ml = Math.hypot(mx, my) || 1;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const k = Math.min(0.18, 30 / dist) * dist;
    const cx = mx + (-mx / ml) * k;
    const cy = my + (-my / ml) * k;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} `
         + `Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }
  /* Icônes — symboles géométriques unicode (style proto voie-v2).
     Pas d'emojis colorés : on reste dans le look "data viz dashboard" sobre. */
  const STAT_ICON = {
    str:  '◆',   // diamant plein  — force
    agi:  '⚡',   // éclair         — agilité
    spd:  '➤',   // flèche         — vitesse
    int:  '◐',   // demi-disque    — intellect
    mana: '◉',   // bullseye       — mana / arcane
    res:  '▲',   // triangle       — résistance / bouclier
    cha:  '✦',   // étoile 4 pts   — charisme
    aura: '✻',   // sparkle        — aura
  };
  function iconFor(c) {
    if (c.type === 'origin') return '✦';
    if (c.type === 'egg')    return '✧';    // étoile pour les eggs
    if (c.type === 'palier') {
      if (c.transforms_race_to) return '⧫';
      if (c.requires_dm_fonda)  return '✉';
      return '◆';
    }
    if (c.navarites)  return '◇';            // gemme creuse — navarites
    if (c.jahartites) return '※';            // marqueur jahartites
    const eff = c.effects || {};
    const stat = Object.entries(eff).sort((a,b)=>b[1]-a[1])[0];
    return stat ? (STAT_ICON[stat[0]] || '·') : '·';
  }
  /* Label sous le nœud — montre le gain net :
     stat mono   → "STR+3"
     multi-stats → "STR+2 · CHA+1"
     egg         → "+5 EGG"
     navarites   → "+10 NAV"
     jahartites  → "+7 JAH"
     palier      → nom du palier (OVERDRIVE etc.)
     origin      → "ORIGINE"
     locked stats anonymes ne reçoivent pas de label (saturerait l'écran). */
  function labelFor(c) {
    if (c.type === 'origin') return 'ORIGINE';
    if (c.type === 'palier') return ((TREE._meta.voies[c.voie]||{}).palier_name || 'PALIER').toUpperCase();
    if (c.type === 'egg')    return `+${c.eggs||1} EGG`;
    if (c.navarites)         return `+${c.navarites} NAV`;
    if (c.jahartites)        return `+${c.jahartites} JAH`;
    const eff = c.effects || {};
    const parts = Object.entries(eff).sort((a,b)=>b[1]-a[1])
      .map(([k,v]) => `${(STAT_LABELS[k] || k.toUpperCase())}+${v}`);
    return parts.join(' · ');
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

  /* ═══ Zoom / Pan / Minimap (voie-viewport) ══════════════════════════ */
  const _VP_SMIN = 0.15, _VP_SMAX = 4;

  function _applyVpTransform() {
    const g = document.querySelector('#voie-canvas');
    if (g) g.setAttribute('transform',
      `translate(${_vp.tx.toFixed(1)},${_vp.ty.toFixed(1)}) scale(${_vp.scale.toFixed(4)})`);
  }

  function initVoieZoom(vb) {
    _voieVB = vb;
    const vport = document.getElementById('voie-viewport');
    if (!vport) return;
    const vpW = vport.clientWidth  || 800;
    const vpH = vport.clientHeight || 540;
    /* Cadrage initial : on vise à montrer origin + ~3.5 tiers (zone "shopping
       immédiat" lisible, gros nœuds), pas l'arbre entier (11 tiers). L'utilisateur
       peut dézoomer à la molette pour voir la totalité. */
    const TARGET_RADIUS = 95 * 3.5 + 40; // TIER_R * 3.5 + padding ≈ 372
    const idealS = (Math.min(vpW, vpH) - 80) / (TARGET_RADIUS * 2);
    /* Fallback fit-all si l'utilisateur a un viewport très étroit. */
    const fitS = Math.min((vpW - 80) / vb.w, (vpH - 80) / vb.h);
    _vp.scale = Math.max(_VP_SMIN, Math.min(_VP_SMAX, Math.max(idealS, fitS)));
    /* Centre sur l'origine (0,0) — sunburst la met au centre du bbox. */
    _vp.tx = vpW / 2 - 0 * _vp.scale;
    _vp.ty = vpH / 2 - 0 * _vp.scale;
    _applyVpTransform();

    if (vport._vpClean) { vport._vpClean(); vport._vpClean = null; }

    const onWheel = (e) => {
      e.preventDefault();
      const r = vport.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.14 : 1 / 1.14;
      const ns = Math.max(_VP_SMIN, Math.min(_VP_SMAX, _vp.scale * f));
      _vp.tx = mx - (mx - _vp.tx) * (ns / _vp.scale);
      _vp.ty = my - (my - _vp.ty) * (ns / _vp.scale);
      _vp.scale = ns;
      _applyVpTransform(); _refreshMinimap();
    };
    const onMD = (e) => {
      _vp.dragging = true; _vp.moved = false;
      _vp.sx = e.clientX; _vp.sy = e.clientY;
    };
    const onMM = (e) => {
      if (!_vp.dragging) return;
      const dx = e.clientX - _vp.sx, dy = e.clientY - _vp.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) _vp.moved = true;
      _vp.tx += dx; _vp.ty += dy;
      _vp.sx = e.clientX; _vp.sy = e.clientY;
      _applyVpTransform(); _refreshMinimap();
    };
    const onMU = () => { _vp.dragging = false; };

    vport.addEventListener('wheel', onWheel, { passive: false });
    vport.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    vport._vpClean = () => {
      vport.removeEventListener('wheel', onWheel);
      vport.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
    };
    _buildZoomCtrl(vport);
  }

  function _buildZoomCtrl(vport) {
    if (vport.querySelector('.voie-zoom-ctrl')) return;
    const zc = document.createElement('div');
    zc.className = 'voie-zoom-ctrl';
    zc.innerHTML = '<button class="vzc-btn vzc-in" title="Zoom +">+</button>'
      + '<button class="vzc-btn vzc-rst" title="Recentrer">↺</button>'
      + '<button class="vzc-btn vzc-out" title="Zoom −">–</button>';
    vport.appendChild(zc);
    const zoomBy = (f) => {
      const cx = vport.clientWidth / 2, cy = vport.clientHeight / 2;
      const ns = Math.max(_VP_SMIN, Math.min(_VP_SMAX, _vp.scale * f));
      _vp.tx = cx - (cx - _vp.tx) * (ns / _vp.scale);
      _vp.ty = cy - (cy - _vp.ty) * (ns / _vp.scale);
      _vp.scale = ns;
      _applyVpTransform(); _refreshMinimap();
    };
    zc.querySelector('.vzc-in').addEventListener('click',  () => zoomBy(1.3));
    zc.querySelector('.vzc-out').addEventListener('click', () => zoomBy(0.77));
    zc.querySelector('.vzc-rst').addEventListener('click', () => {
      if (!_voieVB) return;
      const vpW = vport.clientWidth  || 800;
      const vpH = vport.clientHeight || 540;
      const fitS = Math.min((vpW - 80) / _voieVB.w, (vpH - 80) / _voieVB.h);
      _vp.scale = Math.max(_VP_SMIN, Math.min(_VP_SMAX, fitS));
      _vp.tx = vpW / 2 - (_voieVB.x + _voieVB.w / 2) * _vp.scale;
      _vp.ty = vpH / 2 - (_voieVB.y + _voieVB.h / 2) * _vp.scale;
      _applyVpTransform(); _refreshMinimap();
    });
  }

  function _buildMinimap(vb, cases, posMap) {
    const vport = document.getElementById('voie-viewport');
    if (!vport) return;
    let mm = vport.querySelector('.voie-minimap');
    if (!mm) { mm = document.createElement('div'); mm.className = 'voie-minimap'; vport.appendChild(mm); }
    const MM_W = 148, MM_H = 94, pad = 8;
    const mms = Math.min((MM_W - pad*2) / vb.w, (MM_H - pad*2) / vb.h) * 0.9;
    const ox = pad + (MM_W - pad*2 - vb.w*mms) / 2;
    const oy = pad + (MM_H - pad*2 - vb.h*mms) / 2;
    mm._mms = mms; mm._ox = ox; mm._oy = oy; mm._vb = vb;
    const unlocked = new Set(CHAR ? (CHAR.skill_tree_unlocked || [ORIGIN_ID]) : [ORIGIN_ID]);
    /* Idem que dans renderVoieTree : on lit UNIQUEMENT la position calculée
       par computeFanLayout, jamais le `c.pos` legacy du JSON. */
    const _pos = (c) => (posMap && posMap[c.id]) || { x:0, y:0 };
    let dots = '';
    for (const c of cases) {
      const p = _pos(c);
      const cx = (ox + (p.x - vb.x) * mms).toFixed(1);
      const cy = (oy + (p.y - vb.y) * mms).toFixed(1);
      const r  = c.type === 'palier' ? 2.5 : c.type === 'origin' ? 3 : 1.5;
      const col = unlocked.has(c.id) ? 'rgba(0,229,255,0.85)' : 'rgba(90,122,144,0.5)';
      dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`;
    }
    mm.innerHTML = `<svg width="${MM_W}" height="${MM_H}" xmlns="http://www.w3.org/2000/svg">`
      + `<rect width="${MM_W}" height="${MM_H}" fill="rgba(4,6,16,0.93)" rx="5"`
      +   ` stroke="rgba(0,229,255,0.18)" stroke-width="1"/>`
      + `<text x="6" y="11" font-size="7" fill="rgba(0,229,255,0.4)"`
      +   ` font-family="monospace" letter-spacing="2">MAP</text>`
      + dots
      + `<rect id="mm-vr" fill="rgba(0,229,255,0.07)" stroke="rgba(0,229,255,0.65)"`
      +   ` stroke-width="1" rx="2"/>`
      + `</svg>`;
    _refreshMinimap();
  }

  function _refreshMinimap() {
    const vport = document.getElementById('voie-viewport');
    if (!vport) return;
    const mm = vport.querySelector('.voie-minimap');
    if (!mm || !mm._vb) return;
    const rect = mm.querySelector('#mm-vr');
    if (!rect) return;
    const vpW = vport.clientWidth, vpH = vport.clientHeight;
    const { _mms: mms, _ox: ox, _oy: oy, _vb: vb } = mm;
    const rx = (ox + (-_vp.tx / _vp.scale - vb.x) * mms).toFixed(1);
    const ry = (oy + (-_vp.ty / _vp.scale - vb.y) * mms).toFixed(1);
    const rw = (vpW / _vp.scale * mms).toFixed(1);
    const rh = (vpH / _vp.scale * mms).toFixed(1);
    rect.setAttribute('x', rx); rect.setAttribute('y', ry);
    rect.setAttribute('width', rw); rect.setAttribute('height', rh);
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

    /* Raccourcis clavier Stage C : Entrée = Apply, Échap = Unselect (v8) */
    window.addEventListener('keydown', (e) => {
      const stageVoie = document.getElementById('stage-voie');
      if (!stageVoie || stageVoie.hidden) return;            // actif uniquement sur Stage C
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        applyPending();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        unselectAllPending();
      }
    });

    /* Restore session */
    SESS = getSess();
    if (SESS) onAuthOk();
  });

})();
