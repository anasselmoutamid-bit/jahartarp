/* ══════════════════════════════════════════════════════════════════════
   casino-poker.js — Jaharta Casino · Texas Hold'em simplifié
   2-6 sièges · Blindes 1/2 (silver_kanite base) · Host-driven
   Streets : preflop → flop → turn → river → showdown
   Pas de side-pots — all-in simplifié (pot complet au plus gros stack).
   ══════════════════════════════════════════════════════════════════════ */

(function () {

// Double tables : séparation normal / prime
const TABLE_ID_BASE = 'poker_main';
const tableId = () => TABLE_ID_BASE + '_' + (window.CASINO?.mode || 'normal');
const tableRef = () => db.collection(CC.CASINO_TABLES).doc(tableId());
const heartbeatRef = () => db.collection(CC.CASINO_HEARTBEATS).doc(tableId());
const SEATS = 6;
const TURN_MS = 25000;
const SHOWDOWN_MS = 8000;
const INTERMISSION_MS = 5000;
const SB_DEFAULT = 1, BB_DEFAULT = 2;

let unsubTable = null;
let unsubHeartbeat = null;
let heartbeat = null;
let state = null;
let initialized = false;
let hostTimer = null;
let localTimerTimer = null;
let mySeat = null;
let _claimedRound = null;
let _prevMyTurn = false;
let _claimingHost = false;

window._pkInit = function () {
  if (initialized) return;
  initialized = true;
  subscribeTable();
  window._loadDealerImage?.().then(() => { if (state) renderState(); });

  const slider = document.getElementById('pk-raise-slider');
  const input = document.getElementById('pk-raise-input');
  slider.addEventListener('input', () => { input.value = slider.value; });
  input.addEventListener('input', () => { slider.value = input.value; });

  if (!localTimerTimer) localTimerTimer = setInterval(renderPhaseTimer, 250);
};

function renderPhaseTimer() {
  if (!state) return;
  const phaseEl = document.getElementById('pk-phase');
  if (!phaseEl) return;
  const isTurnPhase = ['preflop','flop','turn','river'].includes(state.phase);
  const endTime = isTurnPhase ? state.turn_end : state.phase_end;
  // Durée nominale par phase (approximation — les phases_started ne sont pas tracées)
  const nominalDur =
    isTurnPhase            ? TURN_MS :
    state.phase === 'showdown'     ? SHOWDOWN_MS :
    state.phase === 'intermission' ? INTERMISSION_MS :
                                     5000;
  const secLeft = Math.max(0, Math.ceil(((endTime || 0) - Date.now()) / 1000));
  const timerEl = document.getElementById('pk-timer');
  if (timerEl) timerEl.textContent = secLeft;
  const barEl = document.getElementById('pk-phase-bar');
  if (barEl && endTime) {
    const pct = 100 - Math.max(0, Math.min(100, ((endTime - Date.now()) / nominalDur) * 100));
    barEl.style.width = pct + '%';
  }
}

window._pkOnModeChange = function () {
  // Re-abonnement sur la table du mode courant.
  if (unsubTable) { try { unsubTable(); } catch {} ; unsubTable = null; }
  if (unsubHeartbeat) { try { unsubHeartbeat(); } catch {} ; unsubHeartbeat = null; }
  if (hostTimer) { clearInterval(hostTimer); hostTimer = null; }
  heartbeat = null;
  state = null;
  mySeat = null;
  _prevMyTurn = false;
  if (initialized) subscribeTable();
};

async function ensureTable() {
  const s = await tableRef().get();
  if (s.exists) return;
  const mode = window.CASINO?.mode || 'normal';
  await tableRef().set({
    game: 'poker',
    phase: 'waiting', // waiting, preflop, flop, turn, river, showdown, intermission
    phase_end: Date.now() + 5000,
    currency: mode === 'prime' ? 'navarites' : 'silver_kanite',
    mode,
    seats: Array(SEATS).fill(null),
    deck: [],
    board: [],
    pot: 0,
    sb: SB_DEFAULT,
    bb: BB_DEFAULT,
    dealer_seat: -1,
    turn_seat: -1,
    turn_end: 0,
    current_bet: 0,
    min_raise: BB_DEFAULT,
    last_action: null,
    winners: null,
    host: null,
    host_ping: 0
  });
}

async function subscribeTable() {
  await ensureTable();
  if (unsubTable) { try { unsubTable(); } catch {} }
  unsubTable = tableRef().onSnapshot(snap => {
    state = snap.data();
    if (!state) return;
    mySeat = null;
    (state.seats || []).forEach((s, i) => { if (s && s.uid === CASINO.uid) mySeat = i; });
    renderState();
    checkHost();
    if (state.phase === 'showdown' && mySeat !== null) maybeLogResult();
  });
  if (unsubHeartbeat) { try { unsubHeartbeat(); } catch {} }
  unsubHeartbeat = heartbeatRef().onSnapshot(snap => {
    heartbeat = snap.exists ? snap.data() : null;
    checkHost();
  });
}

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
    if (!hostTimer) hostTimer = setInterval(hostTick, 700);
  } else {
    if (hostTimer) { clearInterval(hostTimer); hostTimer = null; }
  }
}

async function hostTick() {
  const now = Date.now();
  // Heartbeat dans sous-doc — n'entraîne plus de re-render global de la table
  try { heartbeatRef().set({ host_uid: CASINO.uid, ping: now }); } catch {}

  // Casino fermé : aucune main ne démarre / n'avance
  if (window.CASINO?.isOpen === false) return;

  const activeSeats = (state.seats || []).filter(s => s && s.stack > 0).length;

  if (state.phase === 'waiting' || state.phase === 'intermission') {
    if (now >= (state.phase_end || 0) && activeSeats >= 2) {
      await startHand();
    }
  } else if (['preflop', 'flop', 'turn', 'river'].includes(state.phase)) {
    // Turn timeout → auto fold (or check if possible)
    if (now >= (state.turn_end || 0)) {
      await autoAction();
    }
  } else if (state.phase === 'showdown') {
    if (now >= (state.phase_end || 0)) {
      await tableRef().update({
        phase: 'intermission',
        phase_end: now + INTERMISSION_MS,
        winners: null,
        last_action: null
      });
    }
  }
}

/* ═══ DECK + HAND EVALUATION ═══ */
const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS = ['s','h','d','c'];
function freshDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Evaluate 7-card hand → returns [category, ...tiebreakers]
// category: 8=straight flush, 7=four kind, 6=full house, 5=flush, 4=straight, 3=three kind, 2=two pair, 1=pair, 0=high
function evalHand(cards) {
  const rankIdx = c => RANKS.indexOf(c[0]);
  const suitIdx = c => c[1];
  // Count by rank
  const byR = {}, byS = {};
  cards.forEach(c => {
    const r = rankIdx(c), s = suitIdx(c);
    (byR[r] = byR[r] || []).push(c);
    (byS[s] = byS[s] || []).push(c);
  });
  const counts = Object.entries(byR).map(([r, a]) => [+r, a.length]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  // Flush?
  let flushCards = null;
  for (const s in byS) if (byS[s].length >= 5) {
    flushCards = byS[s].slice().sort((a, b) => rankIdx(b) - rankIdx(a)).slice(0, 5);
  }
  // Straight helper — given sorted unique ranks, find best straight (returns high rank or -1)
  function bestStraight(ranksArr) {
    const u = [...new Set(ranksArr)].sort((a, b) => b - a);
    // Wheel: A=12 also acts as -1
    if (u.includes(12)) u.push(-1);
    for (let i = 0; i <= u.length - 5; i++) {
      if (u[i] - u[i + 4] === 4) return u[i];
    }
    return -1;
  }
  // Straight flush
  if (flushCards) {
    const flushSuit = suitIdx(flushCards[0]);
    const flushAll = cards.filter(c => suitIdx(c) === flushSuit).map(rankIdx);
    const sf = bestStraight(flushAll);
    if (sf >= 0) return [8, sf];
  }
  // Four of a kind
  if (counts[0][1] === 4) {
    const quad = counts[0][0];
    const kicker = counts.find(x => x[0] !== quad)[0];
    return [7, quad, kicker];
  }
  // Full house
  if (counts[0][1] === 3 && counts[1] && counts[1][1] >= 2) {
    return [6, counts[0][0], counts[1][0]];
  }
  // Flush
  if (flushCards) {
    const r = flushCards.map(rankIdx);
    return [5, ...r];
  }
  // Straight
  const allR = cards.map(rankIdx);
  const st = bestStraight(allR);
  if (st >= 0) return [4, st];
  // Three of a kind
  if (counts[0][1] === 3) {
    const triple = counts[0][0];
    const kickers = counts.filter(x => x[0] !== triple).map(x => x[0]).slice(0, 2);
    return [3, triple, ...kickers];
  }
  // Two pair
  if (counts[0][1] === 2 && counts[1] && counts[1][1] === 2) {
    const highP = counts[0][0], lowP = counts[1][0];
    const kicker = counts.find(x => x[0] !== highP && x[0] !== lowP)[0];
    return [2, highP, lowP, kicker];
  }
  // Pair
  if (counts[0][1] === 2) {
    const pair = counts[0][0];
    const kickers = counts.filter(x => x[0] !== pair).map(x => x[0]).slice(0, 3);
    return [1, pair, ...kickers];
  }
  // High card
  const sorted = [...allR].sort((a, b) => b - a).slice(0, 5);
  return [0, ...sorted];
}
function compareHands(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}
function handName(e) {
  const names = ['Carte haute','Paire','Deux paires','Brelan','Suite','Couleur','Full','Carré','Quinte flush'];
  return names[e[0]] || '?';
}

/* ═══ HOST: START HAND ═══ */
async function startHand() {
  const now = Date.now();
  const seats = [...(state.seats || [])];
  const activeSeats = seats.map((s, i) => (s && s.stack > 0 ? i : -1)).filter(i => i >= 0);
  if (activeSeats.length < 2) {
    await tableRef().update({ phase: 'waiting', phase_end: now + 3000 });
    return;
  }

  // Next dealer
  let dealer = state.dealer_seat;
  const idxInActive = activeSeats.indexOf(dealer);
  dealer = activeSeats[(idxInActive + 1) % activeSeats.length];
  if (dealer === -1 || !seats[dealer]) dealer = activeSeats[0];

  // SB / BB
  const aIdx = activeSeats.indexOf(dealer);
  const sbSeat = activeSeats.length === 2 ? dealer : activeSeats[(aIdx + 1) % activeSeats.length];
  const bbSeat = activeSeats[(activeSeats.indexOf(sbSeat) + 1) % activeSeats.length];
  const firstToAct = activeSeats[(activeSeats.indexOf(bbSeat) + 1) % activeSeats.length];

  const deck = freshDeck();
  seats.forEach((s, i) => {
    if (!s) return;
    if (s.stack > 0) {
      s.hole = [deck.pop(), deck.pop()];
      s.folded = false;
      s.current_bet = 0;
      s.total_bet = 0;
      s.acted = false;
      s.status = null;
    } else {
      s.folded = true; // sit out
    }
  });
  // Post blinds
  const sb = state.sb || SB_DEFAULT, bb = state.bb || BB_DEFAULT;
  const postSB = Math.min(sb, seats[sbSeat].stack);
  seats[sbSeat].stack -= postSB;
  seats[sbSeat].current_bet = postSB;
  seats[sbSeat].total_bet = postSB;
  const postBB = Math.min(bb, seats[bbSeat].stack);
  seats[bbSeat].stack -= postBB;
  seats[bbSeat].current_bet = postBB;
  seats[bbSeat].total_bet = postBB;

  await tableRef().update({
    phase: 'preflop',
    seats,
    deck,
    board: [],
    pot: postSB + postBB,
    dealer_seat: dealer,
    turn_seat: firstToAct,
    turn_end: now + TURN_MS,
    current_bet: bb,
    min_raise: bb,
    last_action: { seat: bbSeat, action: 'BB', amount: bb },
    winners: null
  });
}

async function autoAction() {
  const seats = [...(state.seats || [])];
  const i = state.turn_seat;
  if (i < 0 || !seats[i]) return;
  const seat = seats[i];
  const toCall = (state.current_bet || 0) - (seat.current_bet || 0);
  // Auto-check if free, else auto-fold
  if (toCall <= 0) {
    await actOn(i, { action: 'check' }, true);
  } else {
    await actOn(i, { action: 'fold' }, true);
  }
}

/* ═══ PLAYER ACTIONS ═══ */
window.pkSit = async function () {
  if (!state) return;
  if (mySeat !== null) { showToast('Tu es déjà assis', 'info'); return; }
  const buyin = Math.max(20, Math.floor(Number(document.getElementById('pk-buyin-input').value) || 100));
  const currency = CASINO.mode === 'prime' ? 'navarites' : document.getElementById('pk-currency').value;
  if (window._getBalance(currency) < buyin) { showToast('Solde insuffisant', 'error'); return; }
  try {
    await window._debit(currency, buyin);
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      const seats = [...(d.seats || [])];
      if (seats.some(x => x && x.uid === CASINO.uid)) throw new Error('Déjà assis');
      // Currency lock: if table has active seat, must match
      const existing = seats.find(Boolean);
      if (existing && existing.currency !== currency) throw new Error('Table en ' + window._currencyLabel(existing.currency));
      const idx = seats.findIndex(x => !x);
      if (idx === -1) throw new Error('Table pleine');
      seats[idx] = {
        uid: CASINO.uid, username: CASINO.username, avatar: CASINO.avatar,
        currency, stack: buyin, hole: [], current_bet: 0, total_bet: 0,
        folded: true, acted: false, status: 'waiting', joined_at: Date.now()
      };
      tx.update(tableRef(), { seats, currency });
    });
    showToast('Assis avec ' + buyin + ' ' + window._currencyLabel(currency), 'success');
  } catch (e) {
    try { await window._credit(currency, buyin); } catch {}
    showToast(e.message || 'Erreur', 'error');
  }
};

window.pkLeave = async function () {
  if (mySeat === null) return;
  const seat = state.seats[mySeat];
  const stack = seat.stack || 0;
  const currency = seat.currency;
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      const d = s.data();
      const seats = [...(d.seats || [])];
      const i = seats.findIndex(x => x && x.uid === CASINO.uid);
      if (i === -1) return;
      // If mid-hand and player not folded, fold them first (forfeit total_bet)
      const active = ['preflop','flop','turn','river'].includes(d.phase);
      if (active && !seats[i].folded) {
        seats[i].folded = true;
      }
      seats[i] = null;
      tx.update(tableRef(), { seats });
    });
    if (stack > 0) { try { await window._credit(currency, stack); showToast('Retiré ' + stack + ' ' + window._currencyLabel(currency), 'success'); } catch {} }
  } catch (e) { showToast(e.message, 'error'); }
};

window.pkFold = () => act('fold');
window.pkCheck = () => act('check');
window.pkCall = () => act('call');
window.pkRaise = () => {
  const amt = Math.floor(Number(document.getElementById('pk-raise-input').value) || 0);
  act('raise', amt);
};

async function act(action, amount) {
  if (mySeat === null) return;
  if (state.turn_seat !== mySeat) { showToast('Pas ton tour', 'error'); return; }
  try { await actOn(mySeat, { action, amount }, false); } catch (e) { showToast(e.message || 'Erreur', 'error'); }
}

async function actOn(seatIdx, { action, amount }, isAuto) {
  await db.runTransaction(async tx => {
    const s = await tx.get(tableRef());
    const d = s.data();
    if (d.turn_seat !== seatIdx) throw new Error('Pas le tour de ce siège');
    if (!['preflop','flop','turn','river'].includes(d.phase)) throw new Error('Phase invalide');
    const seats = [...(d.seats || [])];
    const seat = { ...seats[seatIdx] };
    const toCall = (d.current_bet || 0) - (seat.current_bet || 0);

    let newPot = d.pot || 0;
    let newCurrentBet = d.current_bet || 0;
    let newMinRaise = d.min_raise || d.bb;
    let actionLabel = action;

    if (action === 'fold') {
      seat.folded = true;
      seat.status = 'fold';
    } else if (action === 'check') {
      if (toCall > 0) throw new Error('Tu dois caller');
      seat.status = 'check';
    } else if (action === 'call') {
      const pay = Math.min(toCall, seat.stack);
      seat.stack -= pay;
      seat.current_bet += pay;
      seat.total_bet += pay;
      newPot += pay;
      seat.status = pay === 0 ? 'check' : 'call';
      actionLabel = seat.status;
    } else if (action === 'raise') {
      const raiseTo = Math.floor(amount || 0);
      if (raiseTo <= newCurrentBet) throw new Error('Raise doit dépasser la mise');
      const needed = raiseTo - seat.current_bet;
      if (needed > seat.stack) throw new Error('Pas assez pour raise');
      const raiseDelta = raiseTo - newCurrentBet;
      if (raiseDelta < newMinRaise && raiseDelta < seat.stack) throw new Error('Raise min : ' + newMinRaise);
      seat.stack -= needed;
      seat.current_bet = raiseTo;
      seat.total_bet += needed;
      newPot += needed;
      newCurrentBet = raiseTo;
      newMinRaise = raiseDelta;
      // Reset acted for other active players
      seats.forEach((x, i) => { if (x && !x.folded && i !== seatIdx) x.acted = false; });
      seat.status = seat.stack === 0 ? 'allin' : 'raise';
      actionLabel = seat.status;
    }
    seat.acted = true;
    seats[seatIdx] = seat;

    // Check if round complete
    const liveSeats = seats.map((x, i) => ({ x, i })).filter(o => o.x && !o.x.folded);
    const onlyOneLeft = liveSeats.length === 1;

    // End hand if only one left
    if (onlyOneLeft) {
      const winner = liveSeats[0].i;
      seats[winner].stack += newPot;
      seats[winner].status = 'winner';
      tx.update(tableRef(), {
        phase: 'showdown',
        phase_end: Date.now() + SHOWDOWN_MS,
        seats,
        pot: 0,
        winners: [{ seat: winner, amount: newPot, hand_name: '(fold win)', hand_cards: [] }],
        last_action: { seat: seatIdx, action: actionLabel, amount: seat.current_bet }
      });
      return;
    }

    // Round complete? All non-folded with stack>0 have acted and matched current_bet OR all-in
    const roundDone = liveSeats.every(o => o.x.acted && (o.x.current_bet === newCurrentBet || o.x.stack === 0));
    if (roundDone) {
      // Advance street
      const deck = [...(d.deck || [])];
      let board = [...(d.board || [])];
      let nextPhase = d.phase;
      if (d.phase === 'preflop') {
        deck.pop(); board.push(deck.pop(), deck.pop(), deck.pop()); nextPhase = 'flop';
      } else if (d.phase === 'flop') {
        deck.pop(); board.push(deck.pop()); nextPhase = 'turn';
      } else if (d.phase === 'turn') {
        deck.pop(); board.push(deck.pop()); nextPhase = 'river';
      } else {
        nextPhase = 'showdown';
      }
      // Reset round
      seats.forEach(x => { if (x) { x.current_bet = 0; x.acted = false; if (!x.folded) x.status = null; } });

      if (nextPhase === 'showdown') {
        // Evaluate
        const evals = liveSeats.map(o => ({
          seatIdx: o.i,
          seat: seats[o.i],
          e: evalHand([...(seats[o.i].hole || []), ...board])
        }));
        evals.sort((a, b) => compareHands(b.e, a.e));
        // Find all tied at top
        const top = evals[0];
        const winners = evals.filter(x => compareHands(x.e, top.e) === 0);
        const share = Math.floor(newPot / winners.length);
        const remainder = newPot - (share * winners.length);
        winners.forEach((w, idx) => {
          seats[w.seatIdx].stack += share + (idx === 0 ? remainder : 0);
          seats[w.seatIdx].status = 'winner';
        });
        tx.update(tableRef(), {
          phase: 'showdown',
          phase_end: Date.now() + SHOWDOWN_MS,
          seats,
          board,
          deck,
          pot: 0,
          current_bet: 0,
          min_raise: d.bb,
          winners: winners.map(w => ({
            seat: w.seatIdx,
            amount: share + (winners.indexOf(w) === 0 ? remainder : 0),
            hand_name: handName(w.e),
            hand_cards: (seats[w.seatIdx].hole || [])
          })),
          last_action: { seat: seatIdx, action: actionLabel, amount: seat.current_bet }
        });
        return;
      }

      // Next street: turn_seat = first player after dealer, not folded, not all-in
      const nextSeat = findNextToAct(seats, d.dealer_seat, true, newPot);
      tx.update(tableRef(), {
        phase: nextPhase,
        seats,
        board,
        deck,
        pot: newPot,
        current_bet: 0,
        min_raise: d.bb,
        turn_seat: nextSeat,
        turn_end: Date.now() + TURN_MS,
        last_action: { seat: seatIdx, action: actionLabel, amount: seat.current_bet || 0 }
      });
      return;
    }

    // Next turn
    const nextSeat = findNextActive(seats, seatIdx);
    tx.update(tableRef(), {
      seats,
      pot: newPot,
      current_bet: newCurrentBet,
      min_raise: newMinRaise,
      turn_seat: nextSeat,
      turn_end: Date.now() + TURN_MS,
      last_action: { seat: seatIdx, action: actionLabel, amount: seat.current_bet }
    });
  });
}

function findNextActive(seats, fromIdx) {
  for (let n = 1; n <= SEATS; n++) {
    const i = (fromIdx + n) % SEATS;
    const s = seats[i];
    if (s && !s.folded && s.stack > 0) return i;
    if (s && !s.folded && s.stack === 0) continue; // all-in, skip
  }
  return fromIdx;
}
function findNextToAct(seats, dealer, postflop) {
  // Post-flop action starts from first active seat left of dealer
  const n = SEATS;
  for (let k = 1; k <= n; k++) {
    const i = (dealer + k) % n;
    const s = seats[i];
    if (s && !s.folded && s.stack > 0) return i;
  }
  return -1;
}

/* ═══ RENDER ═══ */
function renderState() {
  const phaseEl = document.getElementById('pk-phase');
  phaseEl.textContent = phaseLabel(state.phase);
  phaseEl.className = 'pk-phase ' + (state.phase || '');
  document.getElementById('pk-pot').textContent = window._fmtNum(state.pot || 0);
  document.getElementById('pk-sb').textContent = state.sb || SB_DEFAULT;
  document.getElementById('pk-bb').textContent = state.bb || BB_DEFAULT;

  // Détection transition « À toi de jouer »
  const myTurnNow = (['preflop','flop','turn','river'].includes(state.phase)
                    && state.turn_seat === mySeat && mySeat !== null);
  if (myTurnNow && !_prevMyTurn) {
    try { showToast('🎯 À toi de jouer !', 'info', 3000); } catch {}
  }
  _prevMyTurn = myTurnNow;

  const dealerImgEl = document.getElementById('pk-dealer-avatar');
  if (dealerImgEl) {
    const url = window._getDealerImg?.();
    if (url && dealerImgEl.dataset.src !== url) {
      dealerImgEl.dataset.src = url;
      dealerImgEl.style.backgroundImage = `url("${url}")`;
      dealerImgEl.classList.add('loaded');
    }
  }

  const endTime = state.turn_end || state.phase_end;
  // No top-level timer element (we use phase label)

  document.getElementById('pk-sit-btn').style.display = mySeat === null ? '' : 'none';
  document.getElementById('pk-leave-btn').style.display = mySeat !== null ? '' : 'none';
  document.getElementById('pk-buyin').style.display = mySeat === null ? '' : 'none';

  // Community — diff par signature pour éviter de rejouer l'animation .deal-in
  const cEl = document.getElementById('pk-community');
  const board = state.board || [];
  const boardSig = board.join(',');
  if (cEl.dataset.sig !== boardSig) {
    cEl.dataset.sig = boardSig;
    cEl.innerHTML = '';
    board.forEach(c => cEl.appendChild(buildPokerCard(c)));
    for (let i = board.length; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'card back';
      d.style.opacity = '.2';
      cEl.appendChild(d);
    }
  }

  // Seats — chaque section du siège (cartes / joueur / mise / badges) a sa propre signature
  const seatsEl = document.getElementById('pk-seats');
  const seats = state.seats || [];
  while (seatsEl.children.length < seats.length) seatsEl.appendChild(document.createElement('div'));
  while (seatsEl.children.length > seats.length) seatsEl.removeChild(seatsEl.lastChild);
  seats.forEach((s, i) => {
    const d = seatsEl.children[i];
    if (!s) {
      if (d.dataset.mode !== 'empty' || d.dataset.idx !== String(i)) {
        d.dataset.mode = 'empty';
        d.dataset.idx = String(i);
        d.className = 'pk-seat empty';
        d.innerHTML = '<div class="seat-empty-label">Siège ' + (i + 1) + '<br><span>vide</span></div>';
      }
      return;
    }
    const isMe = s.uid === CASINO.uid;
    const meCls = isMe ? ' me' : '';
    const turnCls = state.turn_seat === i && ['preflop','flop','turn','river'].includes(state.phase) ? ' turn' : '';
    const foldCls = s.folded ? ' folded' : '';
    const className = 'pk-seat' + meCls + turnCls + foldCls;
    if (d.dataset.mode !== 'occupied') {
      d.dataset.mode = 'occupied';
      d.innerHTML = '<div class="pk-seat-cards"></div><div class="pk-seat-player"></div><div class="pk-seat-bet-wrap"></div><div class="pk-seat-badges"></div>';
    }
    if (d.className !== className) d.className = className;

    // Cartes : ne rebuild que si la signature change (hole / showHole)
    const showHole = isMe || (state.phase === 'showdown' && !s.folded);
    const holeArr = s.hole || [];
    const cardSig = showHole ? 'S:' + holeArr.join(',') : (holeArr.length ? 'B:' + holeArr.length : 'N');
    const cardsDiv = d.firstElementChild;
    if (cardsDiv.dataset.sig !== cardSig) {
      cardsDiv.dataset.sig = cardSig;
      cardsDiv.className = 'pk-seat-cards';
      if (holeArr.length) {
        cardsDiv.innerHTML = holeArr.map(c => showHole ? buildPokerCardHTML(c) : '<div class="card back"></div>').join('');
      } else {
        cardsDiv.innerHTML = '<div class="card back" style="opacity:.15"></div><div class="card back" style="opacity:.15"></div>';
      }
    }

    // Player (avatar + nom + stack)
    const avatarKey = s.avatar || ('ph:' + ((s.username || '?')[0] || '?'));
    const playerSig = avatarKey + '|' + (s.username || '') + '|' + (s.stack || 0) + '|' + (s.currency || '');
    const playerDiv = cardsDiv.nextElementSibling;
    if (playerDiv.dataset.sig !== playerSig) {
      playerDiv.dataset.sig = playerSig;
      playerDiv.className = 'pk-seat-player';
      const avatarHtml = s.avatar
        ? `<img class="seat-avatar" src="${escape(s.avatar)}" alt="" onerror="this.style.display='none'">`
        : `<div class="seat-avatar seat-avatar-ph">${escape((s.username || '?')[0].toUpperCase())}</div>`;
      playerDiv.innerHTML = `
        ${avatarHtml}
        <div class="pk-seat-meta">
          <div class="pk-seat-name">${escape(s.username || 'Joueur')}</div>
          <div class="pk-seat-stack">${window._fmtNum(s.stack || 0)} ${currencySymbol(s.currency)}</div>
        </div>`;
    }

    // Mise en cours
    const betSig = (s.current_bet || 0) + '|' + (s.currency || '');
    const betWrap = playerDiv.nextElementSibling;
    if (betWrap.dataset.sig !== betSig) {
      betWrap.dataset.sig = betSig;
      betWrap.innerHTML = s.current_bet > 0
        ? `<div class="pk-seat-bet">MISE : ${window._fmtNum(s.current_bet)} ${currencySymbol(s.currency)}</div>`
        : '';
    }

    // Badges (dealer + last_action)
    const laMatch = state.last_action?.seat === i ? (state.last_action?.action || '') : '';
    const badgesSig = (state.dealer_seat === i ? 'D' : '') + '|' + laMatch;
    const badgesDiv = betWrap.nextElementSibling;
    if (badgesDiv.dataset.sig !== badgesSig) {
      badgesDiv.dataset.sig = badgesSig;
      badgesDiv.className = 'pk-seat-badges';
      const badges = [];
      if (state.dealer_seat === i) badges.push('<span class="pk-badge dealer">D</span>');
      if (laMatch) {
        const cls = ['fold','check','call','raise','allin'].includes(laMatch) ? laMatch : '';
        badges.push('<span class="pk-seat-action ' + cls + '">' + laMatch.toUpperCase() + '</span>');
      }
      badgesDiv.innerHTML = badges.join('');
    }
  });

  // Actions
  const actionsEl = document.getElementById('pk-actions');
  if (mySeat !== null && state.turn_seat === mySeat && ['preflop','flop','turn','river'].includes(state.phase)) {
    actionsEl.style.display = 'flex';
    const seat = state.seats[mySeat];
    const toCall = (state.current_bet || 0) - (seat.current_bet || 0);
    document.getElementById('pk-check').style.display = toCall <= 0 ? '' : 'none';
    document.getElementById('pk-call').style.display = toCall > 0 ? '' : 'none';
    document.getElementById('pk-call').textContent = 'Call ' + (toCall > 0 ? toCall : '');
    const raiseSlider = document.getElementById('pk-raise-slider');
    const raiseInput = document.getElementById('pk-raise-input');
    const minRaise = Math.max((state.current_bet || 0) + (state.min_raise || state.bb || 2), state.bb || 2);
    const maxRaise = seat.stack + seat.current_bet;
    raiseSlider.min = minRaise; raiseSlider.max = maxRaise;
    raiseInput.min = minRaise; raiseInput.max = maxRaise;
    if (+raiseSlider.value < minRaise) { raiseSlider.value = minRaise; raiseInput.value = minRaise; }
    if (+raiseSlider.value > maxRaise) { raiseSlider.value = maxRaise; raiseInput.value = maxRaise; }
  } else {
    actionsEl.style.display = 'none';
  }

  // Winner announcement
  if (state.phase === 'showdown' && state.winners) {
    const w = state.winners[0];
    const seat = state.seats[w.seat];
    if (seat) {
      const name = seat.username || 'Joueur';
      const hand = w.hand_name && w.hand_name !== '(fold win)' ? ' (' + w.hand_name + ')' : '';
      // Toast once per round
      if (_lastShownShowdown !== state.phase_end) {
        _lastShownShowdown = state.phase_end;
        showToast('🏆 ' + name + ' gagne ' + window._fmtNum(w.amount) + hand, 'success', SHOWDOWN_MS - 1000);
      }
    }
  }
}
let _lastShownShowdown = null;

async function maybeLogResult() {
  if (!state || !state.winners || mySeat === null) return;
  const rk = state.phase_end;
  if (_claimedRound === rk) return;
  _claimedRound = rk;
  const seat = state.seats[mySeat];
  if (!seat) return;
  const iWon = state.winners.some(w => w.seat === mySeat);
  if (iWon || seat.total_bet > 0) {
    const w = state.winners.find(x => x.seat === mySeat);
    const profit = (w ? w.amount : 0) - (seat.total_bet || 0);
    window._logBet('poker', seat.total_bet || 0, seat.currency, iWon ? 'win' : 'lose', profit, { hand_name: w?.hand_name || null });
  }
}

function phaseLabel(p) {
  switch (p) {
    case 'waiting': return 'EN ATTENTE DE JOUEURS';
    case 'preflop': return 'PRE-FLOP';
    case 'flop': return 'FLOP';
    case 'turn': return 'TURN';
    case 'river': return 'RIVER';
    case 'showdown': return 'ABATTAGE';
    case 'intermission': return 'PAUSE';
    default: return p || '';
  }
}

function buildPokerCard(c) {
  const d = document.createElement('div');
  d.className = 'card deal-in ' + (isRedPk(c) ? 'red-suit' : 'black-suit');
  d.innerHTML = `<span class="card-rank">${displayRank(c)}</span><span class="card-suit">${displaySuit(c)}</span><span class="card-big-suit">${displaySuit(c)}</span>`;
  return d;
}
function buildPokerCardHTML(c) {
  return `<div class="card deal-in ${isRedPk(c) ? 'red-suit' : 'black-suit'}"><span class="card-rank">${displayRank(c)}</span><span class="card-suit">${displaySuit(c)}</span><span class="card-big-suit">${displaySuit(c)}</span></div>`;
}
function displayRank(c) { return c[0] === 'T' ? '10' : c[0]; }
function displaySuit(c) { const m = { s: '♠', h: '♥', d: '♦', c: '♣' }; return m[c[1]] || c[1]; }
function isRedPk(c) { return c[1] === 'h' || c[1] === 'd'; }
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

/* ── Force close (casino fermé) ──────────────────────────────────────
   Rembourse mon stack (s'il reste) + vide le siège + reset transactionnel
   de la table. Les mises engagées dans le pot sont perdues côté joueurs
   sortants — ce qui est cohérent avec la règle « la partie est coupée ». */
async function forceClose() {
  if (!state) return;
  // 1) Si j'ai un siège avec stack > 0, rembourser le stack
  let myStack = 0;
  let myCurrency = state.currency || 'silver_kanite';
  (state.seats || []).forEach(s => {
    if (s && s.uid === CASINO.uid) {
      myStack = Number(s.stack || 0);
      myCurrency = s.currency || myCurrency;
    }
  });
  if (myStack > 0) {
    try {
      await window._credit(myCurrency, myStack);
      showToast('Stack remboursé : ' + window._fmtNum(myStack) + ' ' + window._currencyLabel(myCurrency), 'info', 4000);
    } catch (e) { window._dbg?.warn('[pk-refund]', e?.message); }
  }
  // 2) Reset complet (premier client gagne)
  try {
    await db.runTransaction(async tx => {
      const s = await tx.get(tableRef());
      if (!s.exists) return;
      const d = s.data();
      const seatsEmpty = (d.seats || []).every(x => x === null);
      const alreadyReset = d.phase === 'waiting' && seatsEmpty && !d.winners;
      if (alreadyReset) return;
      const now = Date.now();
      tx.update(tableRef(), {
        phase: 'waiting',
        phase_end: now + 5000,
        seats: Array(SEATS).fill(null),
        deck: [],
        board: [],
        pot: 0,
        dealer_seat: -1,
        turn_seat: -1,
        turn_end: 0,
        current_bet: 0,
        min_raise: d.bb || BB_DEFAULT,
        last_action: null,
        winners: null,
        host: null
      });
    });
  } catch (e) { window._dbg?.warn('[pk-reset]', e?.message); }
  mySeat = null;
  _prevMyTurn = false;
}
window._pkForceClose = forceClose;

})();
