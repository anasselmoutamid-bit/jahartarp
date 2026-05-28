/* ══════════════════════════════════════════════════════════════════════
   hub-companions.js — Actions compagnons côté hub
   - Activer un compagnon (changer active_companion)
   - Toggle synchronisation (avec cap axiome)
   - Nourrir (modal — sélectionne un item food de l'inventaire)
   Lit/écrit COMP_USER et companions_user/{UID_CHARID}.
   Réutilise _feedActiveCompanionWithFood depuis hub-inventory.js.
   ══════════════════════════════════════════════════════════════════════ */

/* Définit l'active_companion à `compId`. Si déjà actif → no-op. */
async function setActiveCompanion(compId){
  if(!UID||!CHAR_ID||!COMP_USER) return;
  if(!(COMP_USER.owned_companions||{})[compId]){ showEquipToast('❌ Compagnon non possédé', true); return; }
  if(COMP_USER.active_companion===compId) return;
  const key = (window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  try{
    await db.collection(C.COMP).doc(key).set({ active_companion: compId }, { merge: true });
    COMP_USER.active_companion = compId;
    showEquipToast(`✓ Compagnon actif : ${(COMP_CFG?.companions?.[compId]?.name)||compId}`);
    cacheInvalidate('_companions');
    if(typeof loadCompanions==='function') loadCompanions();
  }catch(err){
    window._dbg?.error('[COMP_ACTIVATE]',err);
    showEquipToast('❌ Erreur changement actif', true);
  }
}

/* Toggle synchronized. Applique le cap (axiome Linked Path / Amitié Plurielle /
   Meute Grandissante / 1 par défaut). */
async function toggleCompanionSync(compId){
  if(!UID||!CHAR_ID||!COMP_USER) return;
  const owned = COMP_USER.owned_companions||{};
  const cd = owned[compId];
  if(!cd){ showEquipToast('❌ Compagnon non possédé', true); return; }
  const wasSync = !!cd.synchronized;

  /* Si on essaie de synchroniser → vérifier le cap */
  if(!wasSync){
    let maxSync = 1;
    try{
      const ax = window.AxiomeSkills;
      if(ax && ax.getCompanionsMaxSync) maxSync = ax.getCompanionsMaxSync(CHAR||{}) || 1;
    }catch(_){}
    const currentSyncCount = Object.entries(owned)
      .filter(function(kv){ return kv[0]!==compId && kv[1] && kv[1].synchronized; })
      .length;
    if(currentSyncCount >= maxSync){
      showEquipToast(`❌ Limite sync atteinte (${currentSyncCount}/${maxSync===Infinity?'∞':maxSync})`, true);
      return;
    }
  }

  const newOwned = Object.assign({}, owned);
  newOwned[compId] = Object.assign({}, cd, { synchronized: !wasSync });
  const key = (window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  try{
    await db.collection(C.COMP).doc(key).set({ owned_companions: newOwned }, { merge: true });
    COMP_USER.owned_companions = newOwned;
    showEquipToast(wasSync ? '✓ Désynchronisé' : '✓ Synchronisé');
    cacheInvalidate('_companions');
    if(typeof loadCompanions==='function') loadCompanions();
  }catch(err){
    window._dbg?.error('[COMP_SYNC]',err);
    showEquipToast('❌ Erreur sync', true);
  }
}

/* ── Modal Nourrir ─────────────────────────────────────────────────────
   Avant ouverture : si `targetCompId` est passé et différent de l'actif,
   on lui propose de l'activer (sinon le food irait au mauvais compagnon).
   La modal liste tous les items type=food possédés en inventaire.
   Click sur un item → consomme + ajoute companion_xp au compagnon actif. */
function openFeedModal(targetCompId){
  if(!INV_DATA||!COMP_USER){ showEquipToast('❌ Charger inventaire+compagnons d\'abord',true); return; }
  // Si on a un target différent de l'actif → demande confirm puis active
  if(targetCompId && targetCompId !== COMP_USER.active_companion){
    const nm = (COMP_CFG?.companions?.[targetCompId]?.name) || targetCompId;
    if(!window.confirm(`Activer "${nm}" pour le nourrir ?`)) return;
    setActiveCompanion(targetCompId).then(()=>openFeedModal());
    return;
  }

  /* Construit/réutilise l'overlay */
  let ov = document.getElementById('feed-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'feed-overlay';
    ov.className = 'feed-overlay';
    ov.addEventListener('click', function(ev){ if(ev.target===ov) closeFeedModal(); });
    document.body.appendChild(ov);
  }

  const items = INV_DATA.items||{};
  const acId = COMP_USER.active_companion;
  const acName = acId ? ((COMP_CFG?.companions?.[acId]?.name) || acId) : '—';
  const foods = [];
  for(const id in items){
    const d = ALL_ITEMS_DATA[id]; if(!d) continue;
    if(String(d.type||'').toLowerCase() !== 'food') continue;
    const xp = parseInt(d.companion_xp)||0;
    if(xp<=0) continue; /* food sans XP → ignore */
    foods.push({ id, data: d, qty: items[id]||0, xp });
  }
  foods.sort(function(a,b){ return b.xp - a.xp; });

  let body;
  if(!acId){
    body = '<div class="feed-empty">Aucun compagnon actif. Active un compagnon depuis la liste, puis reviens nourrir.</div>';
  } else if(!foods.length){
    body = '<div class="feed-empty">Aucun item type <i>food</i> dans ton inventaire.<br><br>Procure-toi en via le marché ou tes drops.</div>';
  } else {
    body = '<div class="feed-grid">' + foods.map(function(f){
      const safeId = String(f.id).replace(/'/g, "\\'");
      const ic = (typeof getItemIcon==='function') ? getItemIcon(f.data, 34) : (f.data.image ? `<img src="${e(f.data.image)}" alt="">` : (f.data.emoji||'🍖'));
      return `<div class="feed-item" onclick="feedActiveCompanion('${safeId}')" title="Nourrir ${e(acName)} avec ${e(f.data.name||f.id)}">
        <span class="feed-item-icon">${ic}</span>
        <span class="feed-item-name">${e(f.data.name||f.id)}</span>
        <span class="feed-item-meta">×${f.qty}</span>
        <span class="feed-item-xp">+${f.xp} XP</span>
      </div>`;
    }).join('') + '</div>';
  }

  ov.innerHTML = `<div class="feed-modal">
    <div class="feed-modal-hdr">
      <div>
        <div class="feed-modal-title">🍖 Nourrir le compagnon</div>
        <div class="feed-modal-sub">Compagnon actif : <span style="color:var(--green)">${e(acName)}</span></div>
      </div>
      <button class="feed-modal-close" onclick="closeFeedModal()">✕</button>
    </div>
    <div class="feed-modal-body">${body}</div>
  </div>`;
  ov.classList.add('open');
}

function closeFeedModal(){
  const ov = document.getElementById('feed-overlay');
  if(ov) ov.classList.remove('open');
}

/* Appelé depuis la grille de la modal Nourrir. */
async function feedActiveCompanion(foodId){
  const data = ALL_ITEMS_DATA[foodId];
  if(!data){ showEquipToast('❌ Item introuvable',true); return; }
  const name = data.name || foodId.replace(/_/g,' ');
  const ok = await window._feedActiveCompanionWithFood(foodId, data, name);
  /* Après feed, on rafraîchit la modal pour refléter la nouvelle qty (ou la
     ferme si plus aucun food) */
  if(ok){
    const remaining = Object.keys(INV_DATA.items||{}).some(function(id){
      const d = ALL_ITEMS_DATA[id]; if(!d) return false;
      return String(d.type||'').toLowerCase()==='food' && (INV_DATA.items[id]||0)>0 && (parseInt(d.companion_xp)||0)>0;
    });
    if(!remaining){ closeFeedModal(); }
    else { openFeedModal(); }
  }
}

window.setActiveCompanion = setActiveCompanion;
window.toggleCompanionSync = toggleCompanionSync;
window.openFeedModal = openFeedModal;
window.closeFeedModal = closeFeedModal;
window.feedActiveCompanion = feedActiveCompanion;
