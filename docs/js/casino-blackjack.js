/* ══════════════════════════════════════════════════════════════════════
   casino-blackjack.js — Jaharta Casino · Blackjack
   Shared table (6 seats) · Dealer hits soft 17 · Blackjack pays 3:2
   Host-driven phases: betting → dealing → playing(turn per seat) → dealer → resolve
   ══════════════════════════════════════════════════════════════════════ */

(function () {

// Double tables : séparation normal / prime
const TABLE_ID_BASE = 'blackjack_main';
const tableId = () => TABLE_ID_BASE + '_' + (window.CASINO?.mode || 'normal');
const tableRef = () => db.collection(CC.CASINO_TABLES).doc(tableId());
const heartbeatRef = () => db.collection(CC.CASINO_HEARTBEATS).doc(tableId());

const BETTING_MS   = 25000;
const DEAL_MS      = 1500;
const TURN_MS      = 20000;
const RESOLVE_MS   = 6000;
const SEATS        = 6;

let unsubTable = null;
let unsubHeartbeat = null;
let heartbeat = null;
let state = null;
let lastState = null; // pour le diff render (anti-flash)
let initialized = false;
let hostTimer = null;
let localTimerTimer = null;
let mySeat = null; // seat index
let lastClaimedRound = null;
let _prevMyTurn = false; // détection transition "à toi de jouer"
let _claimingHost = false;

/* ── Init ── */
window._bjInit = function () {
  if (initialized) return;
  initialized = true;
  subscribeTable();
  // Load The Fool dealer image (once, cached)
  window._loadDealerImage?.().then(() => { if (state) renderState(); });
  // Timer tick local — la table principale ne recevant plus de heartbeat,
  // le compte à rebours n'était plus rafraîchi entre les snapshots.
  if (!localTimerTimer) localTimerTimer = setInterval(renderPhaseTimer, 250);
};

function renderPhaseTimer() {
  if (!state) return;
  const timerEl = document.getElementById('bj-timer');
  const barEl = document.getElementById('bj-phase-bar');
  const endTime = state.phase === 'playing' ? state.turn_end : state.phase_end;
  const startTime = state.phase === 'playing' ? (state.turn_end - 20000) : state.phase_started;
  const secLeft = Math.max(0, Math.ceil(((endTime || 0) - Date.now()) / 1000));
  if (timerEl) timerEl.textContent = secLeft;
  if (barEl && endTime && startTime) {
    const dur = Math.max(1, endTime - startTime);
    const pct = 100 - Math.max(0, Math.min(100, ((endTime - Date.now()) / dur) * 100));
    barEl.style.width = pct + '%';
  }
}

window._bjOnModeChange = function () {
  // Re-abonnement sur la table du mode courant. L'état local est purgé pour
  // que le render ne tente pas d'interpréter un state « mélangé ».
  if (unsubTable) { try { unsubTable(); } catch {} ; unsubTable = null; }
  if (unsubHeartbeat) { try { unsubHeartbeat(); } catch {} ; unsubHeartbeat = null; }
  if (hostTimer) { clearInterval(hostTimer); hostTimer = null; }
  heartbeat = null;
  state = null;
  lastState = null;
  mySeat = null;
  _prevMyTurn = false;
  if (initialized) subscribeTable();
};

async function ensureTable() {
  const s = await tableRef().get();
  if (s.exists) return;
  const mode = window.CASINO?.mode || 'normal';
  await tableRef().set({
    game: 'blackjack',
    phase: 'betting',
    phase_started: Date.now(),
    phase_end: Date.now() + BETTING_MS,
    currency: mode === 'prime' ? 'navarites' : 'silver_kanite',
    mode,
    seats: Array(SEATS).fill(null), // { uid, username, avatar, bet, currency, hand, score, status, doubled }
    dealer_hand: [],
    dealer_score: 0,
    dealer_revealed: false,
    turn_seat: -1,
    turn_end: 0,
    deck: [],
    host: null,
    host_ping: 0,
    payouts: null
  });
}

async function subscribeTable() {
  await ensureTable();
  if (unsubTable) { try { unsubTable(); } catch {} }
  unsubTable = tableRef().onSnapshot(snap => {
    state = snap.data();
    if (!state) return;
    renderState();
    checkHost();
    // Detect my seat
    mySeat = null;
    (state.seats || []).forEach((s, i) => { if (s && s.uid === CASINO.uid) mySeat = i; });
  });
  // Sous-doc heartbeat — mise à jour hors-snapshot pour ne pas re-render
  if (unsubHeartbeat) { try { unsubHeartbeat(); } catch {} }
  unsubHeartbeat = heartbeatRef().onSnapshot(snap => {
    heartbeat = snap.exists ? snap.data() : null;
    checkHost();
  });
}

/* ── Host election + loop ── */
function hostPing() {
  return (heartbeat && heartbeat.host_uid === state?.host) ? (heartbeat.ping || 0) : (state?.host_ping || 0);
}
function checkHost() {
  if (!state) return;
  const now = Date.now();
  const ping = hostPing();
  const hostStale = !state.host || (now - ping > 7000);
  if (hostStale && !_claimingHost) {
    _claimingHost = true;
    setTimeout(async () => {
      try {
        await db.runTransaction(async tx => {
          const s = await tx.get(tableRef());
          const hb = await tx.get(heartbeatRef());
          const d = s.data();
          if (!d) return;
          const hbData = hb.exists ? hb.data() : null;
          const livePing = (hbData && hbData.host_uid === d.host) ? (hbData.ping || 0) : (d.host_ping || 0);
          if (d.host && (Date.now() - livePing < 7000)) return;
          tx.update(tableRef(), { host: CASINO.uid });
        });
        try { heartbeatRef().set({ host_uid: CASINO.uid, ping: Date.now() }); } catch {}
      } catch {} finally { _claimingHost = false; }
    }, Math.random() * 500);
  }
  if (state.host === CASINO.uid) {
    if (!hostTimer) hostTimer = setInterval(hostTick, 800);
  } else {
    if (hostTimer) { clearInterval(hostTimer); hostTimer = null; }
  }
}

async function hostTick() {
  if (!state) return;
  const now = Date.now();
  // Heartbeat dans sous-doc — ne re-render pas la table
  try { heartbeatRef().set({ host_uid: CASINO.uid, ping: now }); } catch {}

  // Casino fermé : aucune phase ne progresse
  if (window.CASINO?.isOpen === false) return;

  const seatedCount = (state.seats || []).filter(Boolean).length;
  const seatedWithBets = (state.seats || []).filter(s => s && s.bet > 0).length;

  if (state.phase === 'betting' && now >= state.phase_end) {
    if (seatedWithBets === 0) {
      // No bets — cycle
      await tableRef().update({
        phase: 'betting', phase_started: now, phase_end: now + BETTING_MS
      });
      return;
    }
    // Deal phase
    await dealInitial();
  }
  else if (state.phase === 'dealing' && now >= state.phase_end) {
    // Find first seat with bet > 0 and not BJ
    await advanceTurn(true);
  }
  else if (state.phase === 'playing') {
    // Check if current seat timed out
    if (now >= (state.turn_end || 0)) {
      await seatStand(state.turn_seat, true);
    }
  }
  else if (state.phase === 'dealer' && now >= state.phase_end) {
    await dealerPlay();
  }
  else if (state.phase === 'resolve' && now >= state.phase_end) {
    // Reset for next round — clear bets but keep seats
    const newSeats = (state.seats || []).map(s => s ? { ...s, bet: 0, hand: [], score: 0, status: null, doubled: false } : null);
    await tableRef().update({
      phase: 'betting',
      phase_started: now,
      phase_end: now + BETTING_MS,
      seats: newSeats,
      dealer_hand: [],
      dealer_score: 0,
      dealer_revealed: false,
      turn_seat: -1,
      deck: [],
      payouts: null
    });
  }
}

function freshDeck() {
  const d = [];
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  for (let n = 0; n < 6; n++) { // 6 decks
    for (const s of suits) for (const r of ranks) d.push(r + s);
  }
  // Fisher-Yates
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardValue(c) {
  const r = c.length === 3 ? c.slice(0, 2) : c[0]; // '10' is 2 chars
  if (r === 'A') return 11;
  if (r === 'K' || r === 'Q' || r === 'J' || r === '10') return 10;
  return parseInt(r);
}
function handScore(cards) {
  let total = 0, aces = 0;
  cards.forEach(c => {
    const v = cardValue(c);
    total += v;
    if (v === 11) aces++;
  });
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function isBlackjack(cards) { return cards.length === 2 && handScore(cards) === 21; }

async function dealInitial() {
  const deck = freshDeck();
  const seats = (state.seats || []).map(s => {
    if (!s || !s.bet || s.bet <= 0) return s;
    const h = [deck.pop(), deck.pop()];
    const sc = handScore(h);
    return { ...s, hand: h, score: sc, status: isBlackjack(h) ? 'bj' : 'waiting', doubled: false };
  });
  const dealer_hand = [deck.pop(), deck.pop()];
  await tableRef().update({
    phase: 'dealing',
    phase_started: Date.now(),
    phase_end: Date.now() + DEAL_MS,
    seats,
    dealer_hand,
    dealer_score: 0,
    dealer_revealed: false,
    deck
  });
}

async function advanceTurn(firstTurn) {
  const seats = [...(state.seats || [])];
  let startIdx = firstTurn ? 0 : (state.turn_seat + 1);
  let nextIdx = -1;
  for (let i = startIdx; i < SEATS; i++) {
    const s = seats[i];
    if (s && s.bet > 0 && s.status === 'waiting') { nextIdx = i; break; }
  }
  const now = Date.now();
  if (nextIdx === -1) {
    // All seats played — dealer phase
    await tableRef().update({
      phase: 'dealer',
      phase_started: now,
      phase_end: now + 1500,
      turn_seat: -1,
      dealer_revealed: true
    });
  } else {
    await tableRef().update({
      phase: 'playing',
      turn_seat: nextIdx,
      turn_end: now + TURN_MS
    });
  }
}

async function seatStand(seatIdx, auto) {
  const seats = [...(state.seats || [])];
  if (!seats[seatIdx]) return;
  seats[seatIdx] = { ...seats[seatIdx], status: 'stand' };
  await tableRef().update({ seats });
  // Advance
  await advanceTurn(false);
}

async function dealerPlay() {
  // Dealer hits soft 17+? Standard: dealer hits on soft 17. We'll hit on <17 + soft 17.
  const anyStand = (state.seats || []).some(s => s && s.bet > 0 && s.status === 'stand');
  const deck = [...(state.deck || [])];
  let dh = [...(state.dealer_hand || [])];
  if (anyStand) {
    while (true) {
      const sc = handScore(dh);
      // Check for soft 17
      let aces = 0, total = 0;
      dh.forEach(c => { const v = cardValue(c); total += v; if (v === 11) aces++; });
      const soft = (total === 17 && aces > 0); // before reduction → soft 17 if has ace still at 11
      if (sc < 17) { dh.push(deck.pop()); continue; }
      if (sc === 17 && soft) { dh.push(deck.pop()); continue; }
      break;
    }
  }
  const dscore = handScore(dh);
  // Compute payouts
  const seats = [...(state.seats || [])];
  const payouts = {};
  const finalSeats = seats.map(s => {
    if (!s || !s.bet) return s;
    let result = 'lose', profit = -s.bet;
    const pScore = s.score;
    if (s.status === 'bust') {
      result = 'lose'; profit = -s.bet;
    } else if (s.status === 'bj') {
      if (isBlackjack(dh)) { result = 'push'; profit = 0; }
      else { result = 'won'; profit = Math.floor(s.bet * 1.5); }
    } else {
      if (dscore > 21) { result = 'won'; profit = s.bet; }
      else if (pScore > dscore) { result = 'won'; profit = s.bet; }
      else if (pScore === dscore) { result = 'push'; profit = 0; }
      else { result = 'lose'; profit = -s.bet; }
    }
    if (payouts[s.uid] === undefined) payouts[s.uid] = 0;
    payouts[s.uid] += (profit + (result === 'lose' ? 0 : s.bet)); // returnAmount
    return { ...s, status: result };
  });
  const now = Date.now();
  await tableRef().update({
    phase: 'resolve',
    phase_started: now,
    phase_end: now + RESOLVE_MS,
    dealer_hand: dh,
    dealer_score: dscore,
    deck,
    seats: finalSeats,
    payouts
  });
}

/* ── User actions ── */
window.bjSit = async function () {
  if (!state) return;
  if (mySeat !== null) { showToast('Tu as déjà un siège', 'info'); return; }
  // Allowed only during betting
  if (state.phase !== 'betting') { showToast('Attends la prochaine manche', 'error'); return; }
  // Mode/currency match?
  const selCurrency = CASINO.mode === 'prime' ? 'navarites' : (document.getElementById('bj-currency').value);
  if (state.currency && !Object.values(state.seats || []).some(Boolean) && selCurrency !== state.currency) {
    // If table empty, change currency
  }
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      if (d.phase !== 'betting') throw new Error('Manche en cours');
      const seats = [...(d.seats || [])];
      if (seats.some(x => x && x.uid === CASINO.uid)) throw new Error('Tu es déjà assis');
      const idx = seats.findIndex(x => !x);
      if (idx === -1) throw new Error('Table pleine');
      // If table has active seats with a different currency, refuse mode mismatch
      const anySeat = seats.find(Boolean);
      if (anySeat && anySeat.currency !== selCurrency) throw new Error('Table en ' + window._currencyLabel(anySeat.currency));
      seats[idx] = { uid: CASINO.uid, username: CASINO.username, avatar: CASINO.avatar, bet: 0, currency: selCurrency, hand: [], score: 0, status: null, doubled: false };
      tx.update(tableRef(), { seats, currency: selCurrency });
    });
  } catch (e) { showToast(e.message || 'Erreur', 'error'); }
};

window.bjLeave = async function () {
  if (mySeat === null) return;
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      const seats = [...(d.seats || [])];
      const i = seats.findIndex(x => x && x.uid === CASINO.uid);
      if (i === -1) return;
      // If still in betting and bet > 0, refund
      const seat = seats[i];
      if (d.phase === 'betting' && seat && seat.bet > 0) {
        // refund after tx (not in tx)
        setTimeout(() => { window._credit(seat.currency, seat.bet); }, 100);
      }
      seats[i] = null;
      tx.update(tableRef(), { seats });
    });
  } catch (e) { showToast(e.message, 'error'); }
};

window.bjConfirmBet = async function () {
  if (mySeat === null) { showToast('Prends un siège d\'abord', 'error'); return; }
  if (state.phase !== 'betting') { showToast('Manche en cours', 'error'); return; }
  const amount = Math.floor(Number(document.getElementById('bj-bet-input').value) || 0);
  if (amount < 1) { showToast('Mise min : 1', 'error'); return; }
  const seat = state.seats[mySeat];
  const currency = seat.currency;
  const bal = window._getBalance(currency);
  const diff = amount - (seat.bet || 0);
  if (diff > bal) { showToast('Solde insuffisant', 'error'); return; }
  try {
    if (diff > 0) await window._debit(currency, diff);
    else if (diff < 0) await window._credit(currency, -diff);
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      if (d.phase !== 'betting') throw new Error('Trop tard');
      const seats = [...(d.seats || [])];
      if (!seats[mySeat] || seats[mySeat].uid !== CASINO.uid) throw new Error('Siège perdu');
      seats[mySeat] = { ...seats[mySeat], bet: amount };
      tx.update(tableRef(), { seats });
    });
    showToast('Mise validée : ' + amount, 'success', 2000);
  } catch (e) {
    // Refund if needed
    if (diff > 0) { try { await window._credit(currency, diff); } catch {} }
    showToast(e.message || 'Erreur', 'error');
  }
};

window.bjHit = async function () {
  if (!isMyTurn()) return;
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      if (d.turn_seat !== mySeat || d.phase !== 'playing') throw new Error('Pas ton tour');
      const seats = [...(d.seats || [])];
      const seat = { ...seats[mySeat] };
      const deck = [...(d.deck || [])];
      const card = deck.pop();
      seat.hand = [...seat.hand, card];
      seat.score = handScore(seat.hand);
      if (seat.score > 21) seat.status = 'bust';
      seats[mySeat] = seat;
      tx.update(tableRef(), { seats, deck, turn_end: Date.now() + TURN_MS });
    });
    // If busted, advance turn
    const cur = (await tableRef().get()).data();
    if (cur.seats[mySeat].status === 'bust') {
      await advanceTurn(false);
    }
  } catch (e) { showToast(e.message, 'error'); }
};

window.bjStand = async function () {
  if (!isMyTurn()) return;
  await seatStand(mySeat, false);
};

window.bjDouble = async function () {
  if (!isMyTurn()) return;
  const seat = state.seats[mySeat];
  if (!seat || seat.hand.length !== 2) { showToast('Doubler uniquement au 1er tour', 'error'); return; }
  const currency = seat.currency;
  const bal = window._getBalance(currency);
  if (bal < seat.bet) { showToast('Solde insuffisant pour doubler', 'error'); return; }
  try {
    await window._debit(currency, seat.bet);
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      if (d.turn_seat !== mySeat || d.phase !== 'playing') throw new Error('Pas ton tour');
      const seats = [...(d.seats || [])];
      const sSeat = { ...seats[mySeat] };
      const deck = [...(d.deck || [])];
      const card = deck.pop();
      sSeat.hand = [...sSeat.hand, card];
      sSeat.score = handScore(sSeat.hand);
      sSeat.bet = sSeat.bet * 2;
      sSeat.doubled = true;
      sSeat.status = sSeat.score > 21 ? 'bust' : 'stand';
      seats[mySeat] = sSeat;
      tx.update(tableRef(), { seats, deck });
    });
    await advanceTurn(false);
  } catch (e) {
    try { await window._credit(seat.currency, seat.bet); } catch {}
    showToast(e.message, 'error');
  }
};

function isMyTurn() {
  return state && state.phase === 'playing' && state.turn_seat === mySeat && mySeat !== null;
}

/* ── Render ── */
function renderState() {
  const phaseEl = document.getElementById('bj-phase');
  const timerEl = document.getElementById('bj-timer');
  const sitBtn = document.getElementById('bj-sit-btn');
  const leaveBtn = document.getElementById('bj-leave-btn');

  phaseEl.textContent = phaseLabel(state.phase);
  phaseEl.className = 'bj-phase ' + (state.phase || '');

  const endTime =
    state.phase === 'playing' ? state.turn_end :
    state.phase_end;
  const secLeft = Math.max(0, Math.ceil(((endTime || 0) - Date.now()) / 1000));
  timerEl.textContent = secLeft;

  // Détection transition « À toi de jouer » — toast une seule fois par tour
  const myTurnNow = (state.phase === 'playing' && state.turn_seat === mySeat && mySeat !== null);
  if (myTurnNow && !_prevMyTurn) {
    try { showToast('🎯 À toi de jouer !', 'info', 3000); } catch {}
  }
  _prevMyTurn = myTurnNow;

  sitBtn.style.display = mySeat === null ? '' : 'none';
  leaveBtn.style.display = mySeat !== null ? '' : 'none';

  // Dealer — diff par signature pour ne pas rejouer l'animation .deal-in
  const dh = state.dealer_hand || [];
  const revealed = state.dealer_revealed;
  const dhEl = document.getElementById('bj-dealer-hand');
  const dhSig = (revealed ? 'R:' : 'H:') + dh.join(',');
  if (dhEl.dataset.sig !== dhSig) {
    dhEl.dataset.sig = dhSig;
    dhEl.innerHTML = '';
    dh.forEach((c, i) => {
      const hide = !revealed && i === 1;
      dhEl.appendChild(buildCard(hide ? null : c));
    });
  }
  document.getElementById('bj-dealer-score').textContent = revealed ? handScore(dh) : '';

  // Dealer avatar (The Fool)
  const dealerImgEl = document.getElementById('bj-dealer-avatar');
  if (dealerImgEl) {
    const url = window._getDealerImg?.();
    if (url && dealerImgEl.dataset.src !== url) {
      dealerImgEl.dataset.src = url;
      dealerImgEl.style.backgroundImage = `url("${url}")`;
      dealerImgEl.classList.add('loaded');
    }
  }

  // Seats — diff par sous-section pour ne pas rejouer les animations de cartes
  const seatsEl = document.getElementById('bj-seats');
  const seats = state.seats || [];
  while (seatsEl.children.length < seats.length) seatsEl.appendChild(document.createElement('div'));
  while (seatsEl.children.length > seats.length) seatsEl.removeChild(seatsEl.lastChild);
  seats.forEach((s, i) => {
    const d = seatsEl.children[i];
    if (!s) {
      if (d.dataset.mode !== 'empty' || d.dataset.idx !== String(i)) {
        d.dataset.mode = 'empty';
        d.dataset.idx = String(i);
        d.className = 'bj-seat empty';
        d.innerHTML = '<div class="seat-empty-label">Siège ' + (i + 1) + '<br><span>vide</span></div>';
      }
      return;
    }
    const meCls = s.uid === CASINO.uid ? ' me' : '';
    const turnCls = state.turn_seat === i ? ' active' : '';
    const statusCls = s.status === 'bust' ? ' busted' : (s.status === 'won' ? ' won' : (s.status === 'push' ? ' push' : (s.status === 'lose' ? ' lost' : '')));
    const className = 'bj-seat' + meCls + turnCls + statusCls;
    if (d.dataset.mode !== 'occupied') {
      d.dataset.mode = 'occupied';
      d.innerHTML = '<div class="bj-seat-hand"></div><div class="bj-seat-score"></div><div class="bj-seat-player"></div><div class="bj-seat-status-wrap"></div>';
    }
    if (d.className !== className) d.className = className;

    // Main — ne rebuild que si les cartes changent
    const handArr = s.hand || [];
    const handSig = handArr.join(',');
    const handDiv = d.firstElementChild;
    if (handDiv.dataset.sig !== handSig) {
      handDiv.dataset.sig = handSig;
      handDiv.innerHTML = handArr.map(c => `<div class="card ${isRed(c) ? 'red-suit' : 'black-suit'}"><span class="card-rank">${rank(c)}</span><span class="card-suit">${suit(c)}</span><span class="card-big-suit">${suit(c)}</span></div>`).join('');
    }

    // Score
    const scoreSig = handArr.length ? String(s.score) : '';
    const scoreDiv = handDiv.nextElementSibling;
    if (scoreDiv.dataset.sig !== scoreSig) {
      scoreDiv.dataset.sig = scoreSig;
      scoreDiv.textContent = scoreSig;
      scoreDiv.style.display = scoreSig ? '' : 'none';
    }

    // Joueur (avatar + nom + mise)
    const avatarKey = s.avatar || ('ph:' + ((s.username || '?')[0] || '?'));
    const playerSig = avatarKey + '|' + (s.username || '') + '|' + (s.bet || 0) + '|' + (s.currency || '');
    const playerDiv = scoreDiv.nextElementSibling;
    if (playerDiv.dataset.sig !== playerSig) {
      playerDiv.dataset.sig = playerSig;
      const avatarHtml = s.avatar
        ? `<img class="seat-avatar" src="${escape(s.avatar)}" alt="" onerror="this.style.display='none'">`
        : `<div class="seat-avatar seat-avatar-ph">${escape((s.username || '?')[0].toUpperCase())}</div>`;
      playerDiv.innerHTML = `
        ${avatarHtml}
        <div class="bj-seat-meta">
          <div class="bj-seat-name">${escape(s.username || 'Joueur')}</div>
          <div class="bj-seat-bet">${window._fmtNum(s.bet || 0)} ${currencySymbol(s.currency)}</div>
        </div>`;
    }

    // Statut (bj/bust/stand)
    const statusLabel = s.status === 'bj' ? 'BLACKJACK' : (s.status === 'bust' ? 'BUST' : (s.status === 'stand' ? 'STAND' : ''));
    const statusSig = statusLabel ? (s.status + '|' + statusLabel) : '';
    const statusWrap = playerDiv.nextElementSibling;
    if (statusWrap.dataset.sig !== statusSig) {
      statusWrap.dataset.sig = statusSig;
      statusWrap.innerHTML = statusLabel ? `<div class="bj-seat-status ${s.status}">${statusLabel}</div>` : '';
    }
  });

  // Controls
  const betPanel = document.getElementById('bj-bet-panel');
  const actionPanel = document.getElementById('bj-action-panel');
  if (state.phase === 'betting' && mySeat !== null) {
    betPanel.style.display = 'flex';
    actionPanel.style.display = 'none';
  } else if (state.phase === 'playing' && isMyTurn()) {
    betPanel.style.display = 'none';
    actionPanel.style.display = 'flex';
    const seat = state.seats[mySeat];
    document.getElementById('bj-double').disabled = !(seat && seat.hand.length === 2);
  } else {
    betPanel.style.display = 'none';
    actionPanel.style.display = 'none';
  }

  // Resolve-phase payout claim
  if (state.phase === 'resolve' && state.payouts && mySeat !== null) {
    maybeClaimPayout();
  }
}

let _claimRound = null;
async function maybeClaimPayout() {
  const rk = state.phase_started + ':' + mySeat;
  if (_claimRound === rk) return;
  _claimRound = rk;
  const mySeatData = state.seats[mySeat];
  const payoutObj = state.payouts[CASINO.uid] || 0;
  // payouts[uid] was "returnAmount" per seat from dealer resolve; since one user = one seat at a time, it's direct
  if (payoutObj > 0) {
    try { await window._credit(mySeatData.currency, payoutObj); } catch (e) { window._dbg?.warn('[bj-credit]', e.message); }
  }
  const net = payoutObj - (mySeatData.bet || 0);
  window._logBet('blackjack', mySeatData.bet, mySeatData.currency, mySeatData.status || 'lose', net, { dealer: state.dealer_score, player: mySeatData.score });
  if (net > 0) showToast('🎉 ' + (mySeatData.status === 'bj' ? 'Blackjack ! ' : '') + '+' + window._fmtNum(net) + ' ' + window._currencyLabel(mySeatData.currency), 'success');
  else if (net === 0) showToast('Égalité (push)', 'info');
  else showToast('Perdu — ' + window._fmtNum(-net), 'error');
}

function phaseLabel(p) {
  switch (p) {
    case 'betting': return 'PLACEZ VOS MISES';
    case 'dealing': return 'DISTRIBUTION…';
    case 'playing': {
      const seat = state.seats[state.turn_seat];
      return 'TOUR : ' + (seat ? seat.username : '---').toUpperCase();
    }
    case 'dealer': return 'CROUPIER JOUE';
    case 'resolve': return 'RÉSOLUTION';
    default: return p || '';
  }
}

function buildCard(c) {
  const d = document.createElement('div');
  if (!c) { d.className = 'card back'; return d; }
  d.className = 'card deal-in ' + (isRed(c) ? 'red-suit' : 'black-suit');
  d.innerHTML = `<span class="card-rank">${rank(c)}</span><span class="card-suit">${suit(c)}</span><span class="card-big-suit">${suit(c)}</span>`;
  return d;
}
function rank(c) { return c.length === 3 ? c.slice(0, 2) : c[0]; }
function suit(c) { return c[c.length - 1]; }
function isRed(c) { const s = suit(c); return s === '♥' || s === '♦'; }

function currencySymbol(c) {
  if (c === 'navarites') return '✦';
  if (c === 'bronze_kanite') return '🥉';
  if (c === 'silver_kanite') return '🥈';
  if (c === 'gold_kanite') return '🥇';
  if (c === 'platinum_kanite') return '💎';
  return '';
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* Timer tick global retiré — le setInterval de renderPhaseTimer (250ms) dans _bjInit s'en charge. */

/* ── Force close (casino fermé) ──────────────────────────────────────
   Rembourse mes mises (si j'étais assis avec un bet) + quitte le siège +
   reset transactionnel de la table. */
async function forceClose() {
  if (!state) return;
  // 1) Si j'ai un siège avec mise, rembourser
  let myBet = 0;
  let myCurrency = state.currency || 'silver_kanite';
  const seats = state.seats || [];
  seats.forEach(s => {
    if (s && s.uid === CASINO.uid) {
      myBet = Number(s.bet || 0);
      myCurrency = s.currency || myCurrency;
    }
  });
  if (myBet > 0) {
    try {
      await window._credit(myCurrency, myBet);
      showToast('Mise remboursée : ' + window._fmtNum(myBet) + ' ' + window._currencyLabel(myCurrency), 'info', 4000);
    } catch (e) { window._dbg?.warn('[bj-refund]', e?.message); }
  }
  // 2) Reset table (premier client gagne)
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      if (!s.exists) return;
      const d = s.data();
      const seatsEmpty = (d.seats || []).every(x => x === null);
      const alreadyReset = d.phase === 'betting' && seatsEmpty && !d.payouts;
      if (alreadyReset) return;
      const now = Date.now();
      tx.update(tableRef(), {
        phase: 'betting',
        phase_started: now,
        phase_end: now + BETTING_MS,
        seats: Array(SEATS).fill(null),
        dealer_hand: [],
        dealer_score: 0,
        dealer_revealed: false,
        turn_seat: -1,
        turn_end: 0,
        deck: [],
        payouts: null,
        host: null
      });
    });
  } catch (e) { window._dbg?.warn('[bj-reset]', e?.message); }
  mySeat = null;
  _prevMyTurn = false;
}
window._bjForceClose = forceClose;

})();
