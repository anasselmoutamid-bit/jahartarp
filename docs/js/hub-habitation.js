/* ═══════════════════════════════════════════════════════════════════════
   hub-habitation.js — Onglet Habitation (lecture seule)
   ═══════════════════════════════════════════════════════════════════════
   Affiche le statut de l'habitation du perso actif. La création / paiement
   / déménagement se font côté Discord via /habitation. Le site visualise.
   ═════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  /* Catalogue des qualités (mirror du bot, garde la cohérence visuelle) */
  var HABITATIONS = {
    premium:  { name:'Premium',                forum_id:'1498369083299856520', price:'50 Gold Kanite / mois',  color:'#FFD60A', emoji:'💎', tagline:"Luxe absolu. Le sommet de Jaharta." },
    luxe:     { name:'Luxe',                   forum_id:'1498369084058767560', price:'10 Gold Kanite / mois',  color:'#8B5CF6', emoji:'🏛️', tagline:"Confort raffiné pour gens établis." },
    simple:   { name:'Maison Simple',          forum_id:'1498369084503359571', price:'1 Gold Kanite / mois',   color:'#4DA3FF', emoji:'🏠', tagline:"Le quotidien d'une famille du nexus." },
    studio:   { name:'Studio Miteux',          forum_id:'1498369084868530271', price:'10 Silver Kanite / mois',color:'#9AA0B8', emoji:'🚪', tagline:"Quatre murs et un toit." },
    taudis:   { name:'Taudis Inhospitalier',   forum_id:'1498369085820370955', price:'1 Silver Kanite / mois', color:'#6B7280', emoji:'⛓️', tagline:"Si tu peux y dormir, t'es chanceux." }
  };

  function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _activeCharKey(){
    var uid = (typeof UID !== 'undefined' && UID) ? UID : window.UID;
    var cid = (typeof CHAR_ID !== 'undefined' && CHAR_ID) ? CHAR_ID : window.CHAR_ID;
    if(!uid || !cid) return null;
    return String(uid) + '_' + String(cid);
  }

  async function _fetchActive(charKey){
    var dbref = (typeof db !== 'undefined') ? db : window.db;
    if(!dbref) return null;
    try{
      var snap = await dbref.collection('habitations_active').doc(charKey).get();
      if(snap.exists){
        var d = snap.data();
        return d && d.habitation_id ? d.habitation_id : null;
      }
    }catch(e){ window._dbg && window._dbg.warn && window._dbg.warn('[HAB]', e); }
    return null;
  }

  async function _fetchHabitation(habitationId){
    var dbref = (typeof db !== 'undefined') ? db : window.db;
    if(!dbref) return null;
    try{
      var snap = await dbref.collection('habitations').doc(habitationId).get();
      if(snap.exists) return snap.data();
    }catch(e){ window._dbg && window._dbg.warn && window._dbg.warn('[HAB]', e); }
    return null;
  }

  function _renderNoActiveChar(container){
    container.innerHTML =
      '<div class="hab-empty">' +
        '<div class="hab-empty-icon">🏠</div>' +
        '<div class="hab-empty-title">Aucun personnage actif</div>' +
        '<div class="hab-empty-text">Sélectionne un personnage actif pour gérer son habitation.</div>' +
      '</div>';
  }

  function _renderNoHabitation(container){
    var cards = Object.keys(HABITATIONS).map(function(key){
      var q = HABITATIONS[key];
      return (
        '<div class="hab-quality-card" style="--qc:'+q.color+'">' +
          '<div class="hab-quality-head">' +
            '<span class="hab-quality-emoji">'+q.emoji+'</span>' +
            '<span class="hab-quality-name">'+_esc(q.name)+'</span>' +
          '</div>' +
          '<div class="hab-quality-price">'+_esc(q.price)+'</div>' +
          '<div class="hab-quality-tag">'+_esc(q.tagline)+'</div>' +
        '</div>'
      );
    }).join('');

    container.innerHTML =
      '<div class="hab-create-banner">' +
        '<div class="hab-create-title">// MARCHÉ DE L\'IMMOBILIER · NEXUS</div>' +
        '<div class="hab-create-sub">Aucune habitation enregistrée pour ce personnage.</div>' +
        '<div class="hab-create-hint">Création réservée à Discord : utilise <code>/habitation</code> ou le bouton <strong>Habitation</strong> dans <code>/profile</code>.</div>' +
      '</div>' +
      '<div class="hab-quality-grid">' + cards + '</div>';
  }

  function _formatDateAbs(iso){
    try{
      var d = new Date(iso);
      return d.toLocaleString('fr-FR', { dateStyle:'long', timeStyle:'short' });
    }catch(_){ return iso || '—'; }
  }

  function _daysLeft(iso){
    try{
      var until = new Date(iso).getTime();
      var diff = until - Date.now();
      if(diff <= 0) return { expired:true, days:0 };
      return { expired:false, days:Math.ceil(diff/86400000) };
    }catch(_){ return { expired:true, days:0 }; }
  }

  function _renderHabitation(container, hab){
    var q = HABITATIONS[hab.quality] || { name:hab.quality, color:'#9aa0b8', emoji:'🏠', price:'—' };
    var paidUntil = hab.paid_until;
    var dl = paidUntil ? _daysLeft(paidUntil) : { expired:true, days:0 };
    var locked = !!hab.locked;
    var abandoned = !!hab.abandoned;
    var invitees = Array.isArray(hab.invitees) ? hab.invitees : [];
    var threadId = hab.thread_id;

    var statusBadge;
    if(abandoned){
      statusBadge = '<span class="hab-status hab-status-abandoned">ABANDONNÉE</span>';
    } else if(locked){
      statusBadge = '<span class="hab-status hab-status-locked">🔒 VERROUILLÉE</span>';
    } else if(dl.expired){
      statusBadge = '<span class="hab-status hab-status-warning">⚠ LOYER EXPIRÉ</span>';
    } else {
      statusBadge = '<span class="hab-status hab-status-active">🟢 ACTIVE</span>';
    }

    var img = hab.image_url ? '<img src="'+_esc(hab.image_url)+'" alt="" onerror="this.style.display=\'none\'">' : '';
    var rentInfo = '';
    if(paidUntil){
      var line = abandoned
        ? '<span class="hab-rent-expired">— Habitation abandonnée —</span>'
        : (dl.expired
            ? '<span class="hab-rent-expired">Loyer expiré · à régler</span>'
            : '<span class="hab-rent-ok">Encore <strong>'+dl.days+' jour'+(dl.days>1?'s':'')+'</strong></span>');
      rentInfo =
        '<div class="hab-rent">' +
          '<div class="hab-rent-label">PAYÉ JUSQU\'AU</div>' +
          '<div class="hab-rent-date">'+_esc(_formatDateAbs(paidUntil))+'</div>' +
          '<div class="hab-rent-state">'+line+'</div>' +
        '</div>';
    }

    var inviteList = invitees.length
      ? '<div class="hab-invitees"><div class="hab-invitees-label">INVITÉS ('+invitees.length+')</div>' +
        '<div class="hab-invitees-list">' +
          invitees.slice(0,12).map(function(uid){ return '<span class="hab-invitee">'+_esc(uid)+'</span>'; }).join('') +
          (invitees.length>12 ? '<span class="hab-invitee hab-invitee-more">+'+(invitees.length-12)+'</span>' : '') +
        '</div></div>'
      : '';

    var threadLink = threadId
      ? '<a class="hab-thread-link" href="https://discord.com/channels/@me/'+_esc(threadId)+'" target="_blank" rel="noopener">↗ Ouvrir le post Discord</a>'
      : '';

    container.innerHTML =
      '<div class="hab-card" style="--qc:'+q.color+'">' +
        '<div class="hab-card-head">' +
          '<div class="hab-card-corner hab-card-corner-tl"></div>' +
          '<div class="hab-card-corner hab-card-corner-tr"></div>' +
          '<div class="hab-card-corner hab-card-corner-bl"></div>' +
          '<div class="hab-card-corner hab-card-corner-br"></div>' +
          '<div class="hab-card-title">' +
            '<span class="hab-card-emoji">'+q.emoji+'</span>' +
            '<span class="hab-card-name">'+_esc(hab.name||'Habitation')+'</span>' +
          '</div>' +
          '<div class="hab-card-meta">'+_esc(q.name)+' · '+_esc(q.price)+'</div>' +
          statusBadge +
        '</div>' +
        (img ? '<div class="hab-card-img">'+img+'</div>' : '') +
        '<div class="hab-card-body">' +
          '<div class="hab-desc">'+_esc(hab.description||'Pas de description.')+'</div>' +
          rentInfo +
          inviteList +
          (threadLink ? '<div class="hab-actions">'+threadLink+'</div>' : '') +
          '<div class="hab-hint">⚙ Paiement, déménagement et invitations : <code>/habitation</code> sur Discord.</div>' +
        '</div>' +
      '</div>';
  }

  async function loadHabitation(){
    var container = document.getElementById('habitation-content');
    if(!container) return;
    var charKey = _activeCharKey();
    if(!charKey){
      _renderNoActiveChar(container);
      return;
    }
    container.innerHTML = '<div class="hab-loading"><div class="sk" style="height:120px;border-radius:6px;margin-bottom:14px"></div><div class="sk" style="height:60px;border-radius:6px"></div></div>';
    try{
      var habitationId = await _fetchActive(charKey);
      if(!habitationId){
        _renderNoHabitation(container);
        return;
      }
      var hab = await _fetchHabitation(habitationId);
      if(!hab){
        _renderNoHabitation(container);
        return;
      }
      _renderHabitation(container, hab);
    }catch(e){
      window._dbg && window._dbg.error && window._dbg.error('[HAB]', e);
      container.innerHTML = '<div class="hab-empty"><div class="hab-empty-icon">⚠</div><div class="hab-empty-title">Erreur de chargement</div><div class="hab-empty-text">'+_esc(e && e.message || '')+'</div></div>';
    }
  }

  window._loadHabitation = loadHabitation;
})();
