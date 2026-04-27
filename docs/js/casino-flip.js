/* ══════════════════════════════════════════════════════════════════════
   casino-flip.js — Jaharta Casino · Quitte ou Double (Pile ou Face)
   Mode PRIME uniquement · Solo · Navarites seulement
   50/50 · win = pot doublé, peut encaisser après chaque win.
   ══════════════════════════════════════════════════════════════════════ */

(function () {

let initialized = false;
let session = null; // { initial, pot, streak, active, history: [] }

window._qdInit = function () {
  if (initialized) return;
  initialized = true;
  resetUI();
};

function resetUI() {
  session = { initial: 0, pot: 0, streak: 0, active: false, history: [] };
  updateUI();
}

window.qdStart = async function () {
  if (CASINO.mode !== 'prime') { showToast('Mode PRIME requis', 'error'); return; }
  const initial = Math.floor(Number(document.getElementById('qd-initial').value) || 0);
  if (initial < 1) { showToast('Mise min : 1 navarite', 'error'); return; }
  if (window._getBalance('navarites') < initial) { showToast('Solde insuffisant', 'error'); return; }
  try {
    await window._debit('navarites', initial);
  } catch (e) { showToast(e.message || 'Débit impossible', 'error'); return; }
  session.initial = initial;
  session.pot = initial;
  session.streak = 0;
  session.active = true;
  updateUI();
  document.getElementById('qd-start').style.display = 'none';
  document.getElementById('qd-pick-row').style.display = 'flex';
  document.getElementById('qd-cashout').style.display = '';
  showToast('Mise placée — choisis pile ou face', 'info');
};

window.qdFlip = function (pick) {
  if (!session.active) return;
  const coin = document.getElementById('qd-coin');
  const resEl = document.getElementById('qd-result');
  resEl.textContent = '';
  resEl.className = 'qd-result';
  // Disable buttons
  document.querySelectorAll('.qd-pick-row .qd-btn').forEach(b => b.disabled = true);
  document.getElementById('qd-cashout').disabled = true;

  // Roll after visual
  const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
  const rotations = 5 + Math.floor(Math.random() * 3);
  const finalTurn = outcome === 'heads' ? 0 : 180;
  const targetDeg = (rotations * 360) + finalTurn;
  coin.style.setProperty('--coin-target', targetDeg + 'deg');
  coin.classList.remove('flipping');
  // Reflow
  void coin.offsetWidth;
  coin.classList.add('flipping');

  setTimeout(async () => {
    coin.classList.remove('flipping');
    coin.style.transform = 'rotateY(' + finalTurn + 'deg)';
    const won = outcome === pick;
    if (won) {
      session.pot *= 2;
      session.streak++;
      resEl.textContent = '✓ ' + (outcome === 'heads' ? 'PILE' : 'FACE') + ' — ×2 !';
      resEl.classList.add('win');
      session.history.push({ outcome, pick, result: 'win', pot: session.pot });
    } else {
      session.history.push({ outcome, pick, result: 'lose', pot: 0 });
      const lost = session.pot;
      window._logBet('flip', session.initial, 'navarites', 'lose', -session.initial, { streak: session.streak });
      session.pot = 0;
      session.active = false;
      resEl.textContent = '✗ ' + (outcome === 'heads' ? 'PILE' : 'FACE') + ' — Perdu !';
      resEl.classList.add('lose');
      showToast('Perdu — ' + lost + ' navarites', 'error');
      document.getElementById('qd-start').style.display = '';
      document.getElementById('qd-pick-row').style.display = 'none';
      document.getElementById('qd-cashout').style.display = 'none';
    }
    document.querySelectorAll('.qd-pick-row .qd-btn').forEach(b => b.disabled = false);
    document.getElementById('qd-cashout').disabled = false;
    updateUI();
  }, 2600);
};

window.qdCashout = async function () {
  if (!session.active || session.pot <= 0) return;
  const amount = session.pot;
  try {
    await window._credit('navarites', amount);
    const profit = amount - session.initial;
    window._logBet('flip', session.initial, 'navarites', 'win', profit, { streak: session.streak });
    showToast('💰 Encaissé ' + amount + ' navarites (+' + profit + ')', 'success');
    session.active = false;
    session.pot = 0;
    document.getElementById('qd-start').style.display = '';
    document.getElementById('qd-pick-row').style.display = 'none';
    document.getElementById('qd-cashout').style.display = 'none';
    updateUI();
  } catch (e) { showToast('Erreur encaissement', 'error'); }
};

function updateUI() {
  document.getElementById('qd-pot').textContent = window._fmtNum(session.pot);
  document.getElementById('qd-streak').textContent = '×' + session.streak;
  const list = document.getElementById('qd-history-list');
  list.innerHTML = '';
  session.history.slice(-12).reverse().forEach(h => {
    const d = document.createElement('span');
    d.className = 'qd-history-item ' + h.result;
    d.textContent = (h.outcome === 'heads' ? 'P' : 'F') + ' → ' + (h.result === 'win' ? '+' : '×');
    list.appendChild(d);
  });
}

})();
