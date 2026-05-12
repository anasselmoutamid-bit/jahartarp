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

  /* ═══ Stage C : voie tree (cases) ═══════════════════════════════════ */
  function enterVoie(voieKey) {
    SELECTED_VOIE = voieKey;
    SELECTED_CASE_ID = null;
    _voieVB = null; // force réinit zoom au prochain render
    _vp = { tx:0, ty:0, scale:1, dragging:false, sx:0, sy:0, moved:false };
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

    /* HUD flottant dans le viewport (style proto : pill centrée en haut +
       légende clavier en bas-gauche). Indépendant du zoom/pan SVG. */
    _renderVoieHud(pcAvail, unlockedInVoie, inVoie, cfg);
  }

  function _renderVoieHud(pcAvail, unlockedInVoie, inVoie, cfg) {
    const vport = document.getElementById('voie-viewport');
    if (!vport) return;
    let hud = vport.querySelector('.voie-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'voie-hud';
      vport.appendChild(hud);
    }
    hud.style.setProperty('--vc', cfg.color);
    hud.innerHTML = ''
      + `<div class="voie-hud-top">`
      +   `<div class="voie-hud-label">Points de compétence disponibles</div>`
      +   `<div class="voie-hud-pill">`
      +     `<span class="voie-hud-dot"></span>`
      +     `<span class="voie-hud-num">${pcAvail}</span>`
      +   `</div>`
      +   `<div class="voie-hud-progress">${unlockedInVoie} / ${inVoie} · ${esc(cfg.name)}</div>`
      + `</div>`
      + `<div class="voie-hud-help">`
      +   `<div><strong>Clic</strong> · sélectionner</div>`
      +   `<div><strong>Drag</strong> · déplacer · <strong>Molette</strong> · zoom</div>`
      + `</div>`;
  }

  function renderVoieTree() {
    const cfg = TREE._meta.voies[SELECTED_VOIE];
    const cases = TREE.cases.filter(c => c.voie === SELECTED_VOIE || c.id === ORIGIN_ID);
    const unlocked = new Set(CHAR.skill_tree_unlocked || []);
    if (!unlocked.has(ORIGIN_ID)) unlocked.add(ORIGIN_ID);

    /* Layout sunburst centré (computeFanLayout v6) — fournit une position pour
       chaque case (origine + tier ≥ 1). Le `c.pos` du JSON est un vestige d'un
       ancien layout statique : on ne le lit plus, sinon il écraserait notre
       agencement si computeFanLayout venait à oublier un node. */
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
    const PAD = 80;
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const w = maxX - minX, h = maxY - minY;

    function stateOf(c) {
      if (unlocked.has(c.id)) return 'unlocked';
      if ((c.requires || []).every(r => unlocked.has(r))) return 'ready';
      return 'locked';
    }

    /* Edges : courbes Bezier — uniquement intra-voie pour rester lisible */
    let edges = '';
    for (const c of cases) {
      for (const reqId of (c.requires || [])) {
        const req = CASE_BY_ID[reqId];
        if (!req) continue;
        const inThis = (c.voie === SELECTED_VOIE) && (req.voie === SELECTED_VOIE || req.id === ORIGIN_ID);
        if (!inThis) continue;
        const cls = unlocked.has(c.id) ? 'unlocked'
                  : (unlocked.has(reqId) ? 'ready' : 'locked');
        const cp = getPos(c.id), rp = getPos(reqId);
        edges += `<path class="vc-edge ${cls}" d="${bezierPath(rp.x, rp.y, cp.x, cp.y)}"/>`;
      }
    }

    /* Nodes — rendu circulaire néon (v6) :
         - .vc-node-halo  : halo flou externe (visible si unlocked/ready/selected)
         - .vc-node-hex   : cercle principal (nom conservé pour ne pas casser le CSS)
         - .vc-node-inner : anneau interne fin (effet "double ring" data-viz)
         - .vc-node-icon  : icône centrale
         - .vc-node-label : label monospace sous le nœud (origin / palier / egg uniquement,
                            pour éviter de saturer l'écran avec 150 cases) */
    let nodes = '';
    for (const c of cases) {
      const st = stateOf(c);
      const p = getPos(c.id);
      const size = c.type === 'origin' ? 30 : c.type === 'palier' ? 26 : 16;
      const main  = circlePath(p.x, p.y, size);
      const halo  = circlePath(p.x, p.y, size + 8);
      const inner = circlePath(p.x, p.y, Math.max(3, size - 5));
      const icon = iconFor(c);
      /* Label sous le nœud (uniquement les cases marquantes pour ne pas surcharger).
         Les augmentations standard restent sans label : l'icône suffit, et le side-panel
         donne le détail au clic. */
      let label = '';
      if (c.type === 'origin') label = 'ORIGIN';
      else if (c.type === 'palier') label = ((TREE._meta.voies[c.voie]||{}).palier_name || 'PALIER').toUpperCase();
      else if (c.type === 'egg')    label = c.navarites ? `+${c.navarites} NAV` : `+${c.eggs||1} EGG`;
      const labelSvg = label
        ? `<text class="vc-node-label" x="${p.x}" y="${(p.y + size + 14).toFixed(1)}">${esc(label)}</text>`
        : '';
      nodes += `<g class="vc-node ${c.type} ${st}" data-id="${c.id}" style="--vc:${cfg.color}">`
            +    `<path class="vc-node-halo"  d="${halo}"/>`
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
    svg.innerHTML = `<g id="voie-canvas">${edges}${nodes}</g>`;

    /* Click sur un node (ignoré si c'était un glissé) */
    svg.querySelectorAll('.vc-node').forEach(g => {
      g.addEventListener('click', (e) => {
        if (_vp.moved) return;
        e.stopPropagation();
        SELECTED_CASE_ID = g.dataset.id;
        svg.querySelectorAll('.vc-node.selected').forEach(n => n.classList.remove('selected'));
        g.classList.add('selected');
        renderVoieSide();
      });
    });

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

  function renderVoieSide() {
    const side = document.getElementById('voie-side');
    if (!SELECTED_CASE_ID || !CASE_BY_ID[SELECTED_CASE_ID]) {
      side.innerHTML = '<div class="voie-side-empty">Sélectionne une case pour voir ses détails et la débloquer.</div>';
      return;
    }
    const c = CASE_BY_ID[SELECTED_CASE_ID];
    const cfg = TREE._meta.voies[c.voie] || TREE._meta.voies[SELECTED_VOIE] || { color: '#00e5ff' };
    side.style.setProperty('--vc', cfg.color);
    const unlocked = new Set(CHAR.skill_tree_unlocked || []);
    if (!unlocked.has(ORIGIN_ID)) unlocked.add(ORIGIN_ID);
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
    if (c.eggs || c.navarites) {
      html += '<div class="vs-section"><div class="vs-section-title">Récompense</div><div class="vs-effects">';
      if (c.eggs) {
        html += `<div class="vs-effect egg"><span class="vs-effect-lbl">Golden Eggs</span><span class="vs-effect-val">+${c.eggs}</span></div>`;
      }
      if (c.navarites) {
        html += `<div class="vs-effect nav"><span class="vs-effect-lbl">Navarites</span><span class="vs-effect-val">+${c.navarites}</span></div>`;
      }
      html += '</div></div>';
    }
    if (c.transforms_race_to) {
      html += '<div class="vs-section"><div class="vs-section-title">Transformation</div>'
           +  `<div class="vs-fonda">Le personnage devient <strong>${esc(c.transforms_race_to)}</strong> au moment du déblocage.</div></div>`;
    }
    if (c.requires_dm_fonda) {
      html += '<div class="vs-section"><div class="vs-section-title">Action manuelle requise</div>'
           +  `<div class="vs-fonda">Récompense : <strong>${esc(c.requires_dm_fonda)}</strong>.<br>`
           +  `Une fois la case débloquée, MP le fondateur pour la mise en place — le pouvoir/item sera codé manuellement.</div></div>`;
    }
    if (c.unlocks_racial_power_slot) {
      html += '<div class="vs-section"><div class="vs-section-title">Slot débloqué</div>'
           +  `<div class="vs-fonda">+1 emplacement de <strong>pouvoir racial</strong> au choix.</div></div>`;
    }
    if (c.grants_power) {
      const pname = (c.grants_power_name || c.grants_power.replace(/_/g,' '));
      html += '<div class="vs-section"><div class="vs-section-title">Pouvoir octroyé</div>'
           +  `<div class="vs-fonda">⚡ <strong>${esc(pname)}</strong> — ajouté automatiquement à la liste des pouvoirs du personnage.</div></div>`;
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
      /* Slot de pouvoir racial : flag explicite (corps/sagesse/esprit/immoral pour humans) */
      if (c.unlocks_racial_power_slot) {
        update.skill_tree_palier_slots = firebase.firestore.FieldValue.arrayUnion(null);
      }
      /* Octroi direct d'un pouvoir spécifique (paliers Voie : vampire_morsure,
         android_quantum_ai, devil_pactes, succubus_lust, moth_insectoid_boost, etc.) */
      if (c.grants_power) {
        update.powers = firebase.firestore.FieldValue.arrayUnion(c.grants_power);
      }
      /* Débloque la stat AURA (palier Évolution Human) — flag attendu côté bot */
      if (c.unlocks_stat === 'aura') {
        update.aura_enabled = true;
      }
      /* Transformation de race (palier Évolution Succubus → Blasphémée) */
      const RACE_CATEGORY_MAP = {
        'Blasphémée':              'Angelic',
        'Aberration ancestrale':   'Mythical Zooids',
        'Archdevil':               'Demons',
        'Nureonago':               'Semi-Liquid',
      };
      if (c.transforms_race_to) {
        update.class = c.transforms_race_to;
        if (RACE_CATEGORY_MAP[c.transforms_race_to]) {
          update.race_category = RACE_CATEGORY_MAP[c.transforms_race_to];
        }
      }

      /* Batch : character + players (Navarites vivent sur players/{discord_id}) */
      const batch = db.batch();
      batch.update(db.collection('characters').doc(CHAR._id), update);
      if (c.navarites && SESS && SESS.id) {
        batch.set(
          db.collection('players').doc(String(SESS.id)),
          { navarites: firebase.firestore.FieldValue.increment(c.navarites) },
          { merge: true }
        );
      }
      await batch.commit();

      /* Mise à jour locale optimiste */
      CHAR.skill_tree_unlocked = [...(CHAR.skill_tree_unlocked || []), c.id];
      CHAR.pc_spent = Number(CHAR.pc_spent || 0) + c.cost_pc;
      CHAR.stats = CHAR.stats || {};
      for (const [stat, amount] of Object.entries(c.effects || {})) {
        const k = STAT_KEY_MAP[stat] || stat;
        CHAR.stats[k] = Number(CHAR.stats[k] || 0) + amount;
      }
      if (c.eggs) CHAR.golden_eggs = Number(CHAR.golden_eggs || 0) + c.eggs;
      if (c.unlocks_racial_power_slot) CHAR.skill_tree_palier_slots = [...(CHAR.skill_tree_palier_slots || []), null];
      if (c.grants_power) {
        CHAR.powers = CHAR.powers || [];
        if (!CHAR.powers.some(p => (typeof p === 'string' ? p : p?.id) === c.grants_power)) {
          CHAR.powers = [...CHAR.powers, c.grants_power];
        }
      }
      if (c.unlocks_stat === 'aura') CHAR.aura_enabled = true;
      if (c.transforms_race_to) {
        CHAR.class = c.transforms_race_to;
        const RCM = {
          'Blasphémée':            'Angelic',
          'Aberration ancestrale': 'Mythical Zooids',
          'Archdevil':             'Demons',
          'Nureonago':             'Semi-Liquid',
        };
        if (RCM[c.transforms_race_to]) CHAR.race_category = RCM[c.transforms_race_to];
      }

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
  /* Layout sunburst (v6) : origine au CENTRE (0,0), tiers en anneaux concentriques
     répartis sur 360°. Les enfants se regroupent près de leurs parents (angle =
     moyenne des angles parents) — reproduit l'agencement radial du proto, avec
     branches qui rayonnent dans toutes les directions. */
  function computeFanLayout(cases) {
    const ORIGIN = ORIGIN_ID;
    const positions = { [ORIGIN]: { x: 0, y: 0 } };
    const angles    = { [ORIGIN]: 0 };
    const TIER_R     = 95;             // distance entre tiers (compact pour densité proto)
    const MIN_SPACING = 38;            // espacement min entre nodes au même tier

    const byTier = {};
    for (const c of cases) {
      if (c.id === ORIGIN) continue;
      const t = c.tier || 1;
      (byTier[t] = byTier[t] || []).push(c);
    }
    const tiers = Object.keys(byTier).map(Number).sort((a,b)=>a-b);

    for (const tier of tiers) {
      const arr = byTier[tier];
      const items = arr.map(c => {
        const reqs = (c.requires || []).filter(r => angles[r] !== undefined);
        const pref = reqs.length
          ? reqs.reduce((s,r) => s + angles[r], 0) / reqs.length
          : 0;
        return { c, pref };
      });
      items.sort((a,b) => a.pref - b.pref || a.c.id.localeCompare(b.c.id));
      const k = items.length;
      const radius = TIER_R * tier;
      /* Sunburst : on répartit les k nœuds sur 360° (2π). Si la densité est
         trop forte, on retombera sur le min-spacing imposé par la circonférence
         disponible — naturellement borné par k items / 2π rad. */
      const step = (Math.PI * 2) / k;

      for (let j = 0; j < k; j++) {
        /* Décalage de tier pour éviter un alignement parfait entre anneaux —
           donne une légère torsion façon "data viz". */
        const ang = j * step + (tier % 2 ? step / 2 : 0);
        const { c } = items[j];
        angles[c.id] = ang;
        /* Convention SVG : Y vers le bas. On utilise (sin, -cos) pour avoir
           l'angle 0 vers le haut, comme dans le proto. */
        positions[c.id] = { x: radius * Math.sin(ang), y: -radius * Math.cos(ang) };
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
  const STAT_EMOJI = { str:'💪', agi:'⚡', spd:'💨', int:'🧠', mana:'🔮', res:'🛡', cha:'✨', aura:'🌟' };
  function iconFor(c) {
    if (c.type === 'origin') return '◎';
    if (c.type === 'egg')    return c.navarites ? '💎' : '⭐';
    if (c.type === 'palier') {
      if (c.transforms_race_to) return '🔮';
      if (c.requires_dm_fonda)  return '✉';
      if (c.navarites)          return '💎';
      return '◆';
    }
    const eff = c.effects || {};
    const stat = Object.entries(eff).sort((a,b)=>b[1]-a[1])[0];
    return stat ? (STAT_EMOJI[stat[0]] || '·') : '·';
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

    /* Restore session */
    SESS = getSess();
    if (SESS) onAuthOk();
  });

})();
