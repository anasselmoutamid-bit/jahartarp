/* ══════════════════════════════════════════════════════════════════════
   casino-core.js — Jaharta RP Casino
   Init Firebase · Auth · Mode (normal/prime) · Wallet · Tabs · Toggle casino
   ══════════════════════════════════════════════════════════════════════ */

/* ═══ FIREBASE INIT ═══ */
const FB_CFG = {
  apiKey: "AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",
  authDomain: "jahartarp.firebaseapp.com",
  projectId: "jahartarp",
  storageBucket: "jahartarp.firebasestorage.app",
  messagingSenderId: "834848086593",
  appId: "1:834848086593:web:c5cddc894f04feb61cc4c0"
};
if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
const db = firebase.firestore();
window._db = db;

/* ═══ COLLECTIONS ═══ */
const CC = {
  ACTIVE:  'active_characters',
  CHARS:   'characters',
  PLAYERS: 'players',
  ECONOMY: 'economy',
  LINK:    'gacha_link_codes',
  CASINO_CFG: 'casino_config',
  CASINO_TABLES: 'casino_tables',
  CASINO_HEARTBEATS: 'casino_heartbeats',
  CASINO_LOGS: 'casino_logs'
};
window._CC = CC;

/* ═══ SESSION ═══ */
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
function getSess() {
  try {
    const raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session') || localStorage.getItem('casino_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s._exp && Date.now() > s._exp) { clearSess(); return null; }
    return s;
  } catch (e) { return null; }
}
function setSess(s) {
  const payload = { ...s, _exp: Date.now() + SESSION_TTL };
  localStorage.setItem('casino_session', JSON.stringify(payload));
  localStorage.setItem('hub_session', JSON.stringify(payload));
  localStorage.setItem('gacha_session', JSON.stringify(payload));
}
function clearSess() {
  localStorage.removeItem('casino_session');
  localStorage.removeItem('hub_session');
  localStorage.removeItem('gacha_session');
}
window._getSess = getSess;

/* ═══ STATE ═══ */
window.CASINO = {
  uid: null,
  username: null,
  avatar: null,
  charId: null,
  charData: null,
  player: null,
  economy: null,
  mode: 'normal', // 'normal' | 'prime'
  currentGame: 'lobby',
  isOpen: true, // default true to avoid "closed" flash before config loads
  configLoaded: false,
  unsubs: {}
};

/* ═══ TOAST ═══ */
function showToast(msg, type = 'info', duration = 3500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.classList.remove('show'); }, duration);
}
window.showToast = showToast;

/* ═══ AUTH — /link code ═══ */
window.verifyCode = async function verifyCode() {
  const inp = document.getElementById('link-code');
  const err = document.getElementById('code-error');
  const btn = document.querySelector('.code-btn');
  err.textContent = '';
  const code = inp.value.trim().toUpperCase();
  if (!code || code.length < 4) { err.textContent = 'Entre un code valide'; return; }
  btn.classList.add('loading');
  try {
    const codeRef = db.collection(CC.LINK).doc(code);
    if (typeof window.d1LinkSignIn !== 'function') {
      throw Object.assign(new Error('Système d'authentification non chargé (recharge la page)'), { _u: true });
    }
    const _user = await window.d1LinkSignIn(code);
    setSess({ id: _user.discord_id, username: _user.username, avatar: _user.avatar_url });
    await loadCasino();
  } catch (e) {
    err.textContent = e._u ? e.message : 'Erreur de connexion — réessaye';
    btn.classList.remove('loading');
  }
};

window.logout = function logout() {
  clearSess();
  // Cleanup all subscriptions + leave any table
  Object.values(CASINO.unsubs).forEach(u => { try { u(); } catch {} });
  CASINO.unsubs = {};
  if (window._rlLeave) try { window._rlLeave(); } catch {}
  if (window._bjLeave) try { window._bjLeave(); } catch {}
  if (window._pkLeave) try { window._pkLeave(); } catch {}
  document.getElementById('login-gate').classList.add('active');
  document.getElementById('casino-main').classList.remove('active');
  document.getElementById('casino-closed').classList.remove('active');
  document.getElementById('casino-status-banner').style.display = 'none';
  showToast('Déconnecté', 'info');
};

/* ═══ LOAD CASINO ═══ */
async function loadCasino() {
  const sess = getSess();
  if (!sess) { document.getElementById('login-gate').classList.add('active'); return; }

  CASINO.uid = String(sess.id);
  CASINO.username = sess.username || 'Joueur';
  CASINO.avatar = sess.avatar || '';

  document.getElementById('login-gate').classList.remove('active');

  // Watch casino config (open/close + settings)
  subscribeCasinoConfig();

  // Load player (navarites)
  await loadPlayer();

  // Load active character
  await loadActiveCharacter();

  // Render header
  document.getElementById('cu-avatar').src = CASINO.avatar || 'img/logo-jaharta.png';
  document.getElementById('cu-name').textContent = CASINO.username;
  const charName = CASINO.charData ? ((CASINO.charData.first_name || CASINO.charData.firstname || '') + ' ' + (CASINO.charData.last_name || CASINO.charData.lastname || '')).trim() : '—';
  document.getElementById('cu-char').textContent = charName || '// PAS DE PERSO ACTIF';

  // Enter casino UI (respect open/closed)
  evaluateAccess();
}
window.loadCasino = loadCasino;

function subscribeCasinoConfig() {
  if (CASINO.unsubs.cfg) { try { CASINO.unsubs.cfg(); } catch {} }
  CASINO.unsubs.cfg = db.collection(CC.CASINO_CFG).doc('main').onSnapshot(snap => {
    const cfg = snap.exists ? snap.data() : { is_open: true };
    const wasOpen = CASINO.isOpen;
    const wasLoaded = CASINO.configLoaded;
    CASINO.isOpen = cfg.is_open !== false;
    CASINO.config = cfg;
    CASINO.configLoaded = true;
    updateStatusBanner();
    evaluateAccess();
    // Détection transition true → false : forcer la fermeture côté client
    // (refund des mises en cours + reset de la table par le premier client actif).
    if (wasLoaded && wasOpen && !CASINO.isOpen) {
      onCasinoClosing();
    }
  }, err => { window._dbg?.warn('[casino-cfg]', err?.message); CASINO.configLoaded = true; evaluateAccess(); });
}

// Appelé quand le casino passe ouvert → fermé.
// Chaque client en jeu rembourse ses mises et quitte sa place. Le premier à
// répondre remet la table en état vierge (transaction idempotente).
function onCasinoClosing() {
  try { showToast('Casino fermé — remboursement des mises en cours…', 'info', 4000); } catch {}
  try { window._rlForceClose?.(); } catch (e) { window._dbg?.warn('[rl-close]', e?.message); }
  try { window._bjForceClose?.(); } catch (e) { window._dbg?.warn('[bj-close]', e?.message); }
  try { window._pkForceClose?.(); } catch (e) { window._dbg?.warn('[pk-close]', e?.message); }
}
window._onCasinoClosing = onCasinoClosing;

function updateStatusBanner() {
  const bn = document.getElementById('casino-status-banner');
  const lbl = document.getElementById('cs-label');
  const cfg = CASINO.config || {};
  const adminOnly = cfg.admin_only === true;
  bn.style.display = 'inline-flex';
  if (!CASINO.isOpen) {
    bn.className = 'casino-status-banner closed';
    lbl.textContent = 'CASINO FERMÉ';
  } else if (adminOnly) {
    bn.className = 'casino-status-banner maintenance';
    lbl.textContent = '🛠 MAINTENANCE · ADMINS UNIQUEMENT';
  } else {
    bn.className = 'casino-status-banner open';
    lbl.textContent = 'CASINO OUVERT';
  }
}

function isCasinoAdmin() {
  const cfg = CASINO.config || {};
  const list = Array.isArray(cfg.admin_discord_ids) ? cfg.admin_discord_ids : [];
  // Comparaison en string — CASINO.uid est déjà stringifié au login
  return list.map(String).includes(String(CASINO.uid));
}
window._isCasinoAdmin = isCasinoAdmin;

function evaluateAccess() {
  if (!CASINO.uid) return;
  const main = document.getElementById('casino-main');
  const closed = document.getElementById('casino-closed');
  const closedLabel = document.getElementById('cc-reason');
  // Wait for config to load before deciding open/closed (avoids flash)
  if (!CASINO.configLoaded) {
    main.classList.remove('active');
    closed.classList.remove('active');
    return;
  }

  // Ordre d'évaluation :
  // 1) Si casino explicitement fermé → écran "fermé" pour tout le monde
  //    (les admins casino bypassent pour pouvoir tester au calme)
  // 2) Sinon, si admin_only et je ne suis pas admin → écran fermé avec
  //    raison "maintenance"
  // 3) Sinon → accès normal
  const cfg = CASINO.config || {};
  const adminOnly = cfg.admin_only === true;
  const amAdmin = isCasinoAdmin();

  if (!CASINO.isOpen && !amAdmin) {
    main.classList.remove('active');
    closed.classList.add('active');
    if (closedLabel) closedLabel.textContent = '🎰 Le casino est temporairement fermé.';
    return;
  }
  if (adminOnly && !amAdmin) {
    main.classList.remove('active');
    closed.classList.add('active');
    if (closedLabel) closedLabel.textContent = '🛠 Casino en maintenance — accès réservé aux admins.';
    return;
  }
  main.classList.add('active');
  closed.classList.remove('active');
}

async function loadPlayer() {
  try {
    const snap = await db.collection(CC.PLAYERS).doc(CASINO.uid).get();
    CASINO.player = snap.exists ? snap.data() : { navarites: 0 };
  } catch (e) {
    CASINO.player = { navarites: 0 };
  }
  // Live subscribe
  if (CASINO.unsubs.player) { try { CASINO.unsubs.player(); } catch {} }
  CASINO.unsubs.player = db.collection(CC.PLAYERS).doc(CASINO.uid).onSnapshot(snap => {
    CASINO.player = snap.exists ? snap.data() : { navarites: 0 };
    renderWallet();
  });
}

async function loadActiveCharacter() {
  try {
    const actSnap = await db.collection(CC.ACTIVE).doc(CASINO.uid).get();
    if (!actSnap.exists) { CASINO.charId = null; CASINO.charData = null; return; }
    const charId = actSnap.data().character_id;
    CASINO.charId = charId;

    const charSnap = await db.collection(CC.CHARS).doc(charId).get();
    CASINO.charData = charSnap.exists ? charSnap.data() : null;

    const key = CASINO.uid + '_' + charId;
    if (CASINO.unsubs.eco) { try { CASINO.unsubs.eco(); } catch {} }
    CASINO.unsubs.eco = db.collection(CC.ECONOMY).doc(key).onSnapshot(snap => {
      CASINO.economy = snap.exists ? snap.data() : { personal: {} };
      renderWallet();
    });
  } catch (e) {
    window._dbg?.warn('[char-load]', e?.message);
  }
}

function getCharKey() {
  if (!CASINO.uid || !CASINO.charId) return null;
  return CASINO.uid + '_' + CASINO.charId;
}
window._getCharKey = getCharKey;

/* ═══ WALLET RENDERING ═══ */
function renderWallet() {
  const personal = (CASINO.economy && CASINO.economy.personal) || {};
  document.getElementById('bal-bronze').textContent = fmtNum(personal.bronze_kanite || 0);
  document.getElementById('bal-silver').textContent = fmtNum(personal.silver_kanite || 0);
  document.getElementById('bal-gold').textContent = fmtNum(personal.gold_kanite || 0);
  document.getElementById('bal-platinum').textContent = fmtNum(personal.platinum_kanite || 0);
  // Navarites
  const nav = extractNavarites(CASINO.player);
  document.getElementById('bal-navarites').textContent = fmtNum(nav);
}
window._renderWallet = renderWallet;

function extractNavarites(player) {
  if (!player) return 0;
  if (typeof player.navarites === 'number') return player.navarites;
  // Fallback: some records store as object
  if (player.navarites && typeof player.navarites === 'object') {
    const v = Object.values(player.navarites).find(x => typeof x === 'number');
    return v || 0;
  }
  return 0;
}
window._extractNavarites = extractNavarites;

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}
window._fmtNum = fmtNum;

/* ═══ MODE (NORMAL / PRIME) ═══ */
window.setMode = function setMode(mode) {
  CASINO.mode = mode;
  document.body.classList.toggle('mode-prime', mode === 'prime');
  document.getElementById('mode-normal').classList.toggle('active', mode === 'normal');
  document.getElementById('mode-prime').classList.toggle('active', mode === 'prime');
  document.getElementById('mode-normal').setAttribute('aria-selected', mode === 'normal');
  document.getElementById('mode-prime').setAttribute('aria-selected', mode === 'prime');

  document.getElementById('wallet-normal').style.display = mode === 'normal' ? 'inline-flex' : 'none';
  document.getElementById('wallet-prime').style.display = mode === 'prime' ? 'inline-flex' : 'none';

  // Toggle Prime-only UI
  document.querySelectorAll('.prime-only').forEach(el => {
    el.style.display = mode === 'prime' ? '' : 'none';
  });

  // If we're on flip panel but mode turned normal, switch to lobby
  if (mode !== 'prime' && CASINO.currentGame === 'flip') {
    selectGame('lobby');
  }

  // Leave any table that doesn't match mode? Keep simple: just notify other modules
  try { window._rlOnModeChange?.(mode); } catch {}
  try { window._bjOnModeChange?.(mode); } catch {}
  try { window._pkOnModeChange?.(mode); } catch {}

  showToast(mode === 'prime' ? '✦ Mode PRIME — Navarites' : '◈ Mode NORMAL — Kanites', 'info', 2000);
};

/* ═══ GAME TABS ═══ */
window.selectGame = function selectGame(game) {
  CASINO.currentGame = game;
  document.querySelectorAll('.game-tab').forEach(b => b.classList.toggle('active', b.dataset.game === game));
  document.querySelectorAll('.game-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + game));

  // Lazy initialize game modules
  if (game === 'roulette') window._rlInit?.();
  if (game === 'blackjack') window._bjInit?.();
  if (game === 'poker') window._pkInit?.();
  if (game === 'flip') window._qdInit?.();
};

/* ═══ CURRENCY HELPERS — SHARED WITH ALL GAMES ═══ */
/**
 * Get player's current balance for a given currency ID.
 * currency: 'bronze_kanite'|'silver_kanite'|'gold_kanite'|'platinum_kanite'|'navarites'
 */
function getBalance(currency) {
  if (currency === 'navarites') return extractNavarites(CASINO.player);
  const personal = (CASINO.economy && CASINO.economy.personal) || {};
  return Number(personal[currency] || 0);
}
window._getBalance = getBalance;

/**
 * Currency ID for current mode + select-box value.
 * In PRIME mode, currency is always 'navarites' regardless of select.
 */
function currentCurrency(selectElId) {
  if (CASINO.mode === 'prime') return 'navarites';
  const sel = selectElId && document.getElementById(selectElId);
  return sel ? sel.value : 'silver_kanite';
}
window._currentCurrency = currentCurrency;

/**
 * Atomic debit: remove `amount` from player's balance in currency.
 * Uses transaction. Throws if insufficient funds.
 */
async function debit(currency, amount) {
  if (!amount || amount <= 0) return;
  if (currency === 'navarites') {
    const ref = db.collection(CC.PLAYERS).doc(CASINO.uid);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const cur = extractNavarites(data);
      if (cur < amount) throw Object.assign(new Error('Navarites insuffisantes'), { _u: true });
      tx.update(ref, { navarites: cur - amount });
    });
  } else {
    const key = getCharKey();
    if (!key) throw Object.assign(new Error('Pas de personnage actif'), { _u: true });
    const ref = db.collection(CC.ECONOMY).doc(key);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : { personal: {} };
      const personal = data.personal || {};
      // Conversion automatique : puise dans les paliers supérieurs/inférieurs si besoin.
      const K = window.JKanite;
      if (!K) {
        const cur = Number(personal[currency] || 0);
        if (cur < amount) throw Object.assign(new Error('Solde insuffisant'), { _u: true });
        tx.set(ref, { personal: { ...personal, [currency]: cur - amount }, family: data.family || {}, royal: data.royal || {} }, { merge: true });
        return;
      }
      const total = K.totalInBronze(personal);
      const cost  = K.priceInBronze({ [currency]: amount });
      if (total < cost) throw Object.assign(new Error('Solde insuffisant'), { _u: true });
      const newPersonal = K.deductWithAutoConversion(personal, { [currency]: amount });
      if (!newPersonal) throw Object.assign(new Error('Conversion impossible'), { _u: true });
      tx.set(ref, { personal: newPersonal, family: data.family || {}, royal: data.royal || {} }, { merge: true });
    });
  }
}
window._debit = debit;

/**
 * Atomic credit: add `amount` to player's balance in currency.
 */
async function credit(currency, amount) {
  if (!amount || amount <= 0) return;
  if (currency === 'navarites') {
    const ref = db.collection(CC.PLAYERS).doc(CASINO.uid);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const cur = extractNavarites(data);
      tx.update(ref, { navarites: cur + amount });
    });
  } else {
    const key = getCharKey();
    if (!key) return;
    const ref = db.collection(CC.ECONOMY).doc(key);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : { personal: {} };
      const personal = data.personal || {};
      // Crédit + compactage vers le haut (100 bronze → 1 silver, etc.)
      const K = window.JKanite;
      const newPersonal = K
        ? K.addWithAutoConvertUp(personal, currency, amount)
        : { ...personal, [currency]: Number(personal[currency] || 0) + amount };
      tx.set(ref, { personal: newPersonal, family: data.family || {}, royal: data.royal || {} }, { merge: true });
    });
  }
}
window._credit = credit;

/**
 * Write a casino log entry. Best-effort, non-blocking.
 */
function logBet(game, amount, currency, result, profit, extra) {
  try {
    db.collection(CC.CASINO_LOGS).add({
      user_id: CASINO.uid,
      username: CASINO.username,
      game,
      mode: CASINO.mode,
      currency,
      amount: Number(amount) || 0,
      profit: Number(profit) || 0,
      result,
      char_id: CASINO.charId || null,
      extra: extra || null,
      at: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch {}
}
window._logBet = logBet;

/* ═══ DEALER IMAGE — The Fool PNJ ═══ */
let _dealerImgUrl = null;
let _dealerImgPromise = null;
async function loadDealerImage() {
  if (_dealerImgUrl) return _dealerImgUrl;
  if (_dealerImgPromise) return _dealerImgPromise;
  _dealerImgPromise = (async () => {
    try {
      const snap = await db.collection('pnj').get();
      let match = null;
      snap.forEach(doc => {
        const d = doc.data() || {};
        const prenom = (d.prenom || d.first_name || '').toLowerCase();
        const nom = (d.nom || d.last_name || '').toLowerCase();
        const full = (prenom + ' ' + nom).trim();
        if (full.includes('fool') || full.includes('the fool') || prenom === 'the' && nom === 'fool') {
          match = d;
        }
      });
      if (match) {
        _dealerImgUrl = match.photoUrl || match.profile_image || null;
      }
    } catch (e) { window._dbg?.warn('[dealer-img]', e?.message); }
    return _dealerImgUrl;
  })();
  return _dealerImgPromise;
}
window._loadDealerImage = loadDealerImage;
window._getDealerImg = () => _dealerImgUrl;

/* ═══ CURRENCY LABEL ═══ */
function currencyLabel(c) {
  switch (c) {
    case 'bronze_kanite':   return '🥉 Bronze';
    case 'silver_kanite':   return '🥈 Silver';
    case 'gold_kanite':     return '🥇 Gold';
    case 'platinum_kanite': return '💎 Platinum';
    case 'navarites':       return '✦ Navarites';
    default: return c;
  }
}
window._currencyLabel = currencyLabel;

/* ═══ BOOT ═══ */
document.addEventListener('DOMContentLoaded', () => {
  const sess = getSess();
  if (sess) { loadCasino(); }
  else { document.getElementById('login-gate').classList.add('active'); }

  // Animated background sparkle
  initHeroSparkles();
});

/* ═══ HERO SPARKLES BACKGROUND ═══ */
function initHeroSparkles() {
  const c = document.getElementById('casino-bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let w, h, sparks;
  function resize() {
    w = c.width = c.offsetWidth;
    h = c.height = c.offsetHeight;
    sparks = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + .5,
      vy: Math.random() * .3 + .1,
      a: Math.random()
    }));
  }
  resize();
  window.addEventListener('resize', resize);
  function draw() {
    ctx.clearRect(0, 0, w, h);
    sparks.forEach(s => {
      s.y -= s.vy;
      s.a += .02;
      if (s.y < 0) { s.y = h; s.x = Math.random() * w; }
      const alpha = .3 + Math.sin(s.a) * .2;
      ctx.fillStyle = `rgba(232,176,74,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}
