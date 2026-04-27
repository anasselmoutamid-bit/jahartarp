/* ═══════════════════════════════════════════════════════════════════════
   docs/js/hub-inventory.js — Système Inventaire complet
   ═══════════════════════════════════════════════════════════════════════
   Dépendances : hub.html doit charger SortableJS, Tippy.js, GSAP avant.
   Fonctions exposées : renderInventory, renderCharacterPanel, initCharScanAnimation,
                        renderItemsGrid, initDragDrop, initTooltips, toggleEquip,
                        showItemDetail, closeItemDetail, openDeleteModal, confirmDelete
   ═══════════════════════════════════════════════════════════════════════ */

// ── CONSTANTES SETS & SLOTS ──
const ITEM_SETS={"survie_de_rue": {"name": "Survie de Rue", "rarity": "common", "items": ["casque_chantier_renforce", "plastron_gardien_nuit", "chaussures_securite_lourdes"], "bonuses": {"3": {"stats": {"resistance": 3, "strength": 2}}}}, "coursier_du_nexus": {"name": "Coursier du Nexus", "rarity": "common", "items": ["visiere_messager", "sac_coursier_bandouliere", "baskets_skyyart"], "bonuses": {"3": {"stats": {"speed": 3, "agility": 2}}}}, "arnaqueur": {"name": "Arnaqueur", "rarity": "common", "items": ["lunettes_soleil_marque", "chevaliere_famille", "chaine_argent_terni"], "bonuses": {"3": {"stats": {"charisma": 3, "mana": 1}}}}, "milicien": {"name": "Milicien", "rarity": "uncommon", "items": ["veste_kevlar_tactique", "brassard_protection_milice", "matraque_electrique_milice"], "bonuses": {"3": {"stats": {"resistance": 5, "strength": 3}}}}, "hackeur": {"name": "Hackeur", "rarity": "uncommon", "items": ["gants_hackeur_poche", "smart_watch_nexus_v2", "analyseur_faiblesse_v1"], "bonuses": {"3": {"stats": {"intelligence": 5, "mana": 3}}}}, "pulse_blanc": {"name": "Pulse Blanc", "rarity": "uncommon", "items": ["pulse_blanc_bandeau", "pulse_blanc_combinaison", "pulse_blanc_gants", "pulse_blanc_jambieres", "pulse_blanc_bottes", "pulse_blanc_reacteur"], "bonuses": {"2": {"stats": {"speed": 3}}, "4": {"stats": {"speed": 8}}, "6": {"stats": {"speed": 15}}}}, "flux_indigo": {"name": "Flux Indigo", "rarity": "uncommon", "items": ["flux_indigo_couronne", "flux_indigo_robe", "flux_indigo_bracelet", "flux_indigo_pendentif", "flux_indigo_bague", "flux_indigo_orbe"], "bonuses": {"2": {"stats": {"mana": 3}}, "4": {"stats": {"mana": 8}}, "6": {"stats": {"mana": 15}}}}, "neon_dore": {"name": "Néon Doré", "rarity": "uncommon", "items": ["neon_dore_masque", "neon_dore_veste", "neon_dore_bagues", "neon_dore_collier", "neon_dore_boucles", "neon_dore_cape"], "bonuses": {"2": {"stats": {"charisma": 3}}, "4": {"stats": {"charisma": 8}}, "6": {"stats": {"charisma": 15}}}}, "prestige_digital": {"name": "Prestige Digital", "rarity": "uncommon", "items": ["prestige_digital_masque", "prestige_digital_costume", "prestige_digital_bagues", "prestige_digital_collier", "prestige_digital_bracelet", "prestige_digital_boucles"], "bonuses": {"2": {"stats": {"charisma": 3, "mana": 2}}, "4": {"stats": {"charisma": 7, "mana": 5}}, "6": {"stats": {"charisma": 12, "mana": 10}}}}, "circuit_rouge": {"name": "Circuit Rouge", "rarity": "rare", "items": ["circuit_rouge_casque", "circuit_rouge_plastron", "circuit_rouge_gantelets", "circuit_rouge_jambieres", "circuit_rouge_bottes", "circuit_rouge_marteau"], "bonuses": {"2": {"stats": {"strength": 5}}, "4": {"stats": {"strength": 12}}, "6": {"stats": {"strength": 22}}}}, "filament_cyan": {"name": "Filament Cyan", "rarity": "rare", "items": ["filament_cyan_capuche", "filament_cyan_veste", "filament_cyan_gants", "filament_cyan_brassards", "filament_cyan_bottes", "filament_cyan_dagues"], "bonuses": {"2": {"stats": {"agility": 5}}, "4": {"stats": {"agility": 12}}, "6": {"stats": {"agility": 22}}}}, "reseau_violet": {"name": "Réseau Violet", "rarity": "rare", "items": ["reseau_violet_diademe", "reseau_violet_manteau", "reseau_violet_interface", "reseau_violet_monocle", "reseau_violet_anneau", "reseau_violet_codex"], "bonuses": {"2": {"stats": {"intelligence": 5}}, "4": {"stats": {"intelligence": 12}}, "6": {"stats": {"intelligence": 22}}}}, "bunker_gris": {"name": "Bunker Gris", "rarity": "rare", "items": ["bunker_gris_heaume", "bunker_gris_cuirasse", "bunker_gris_gantelets", "bunker_gris_jambieres", "bunker_gris_bottes", "bunker_gris_bouclier"], "bonuses": {"2": {"stats": {"resistance": 5}}, "4": {"stats": {"resistance": 12}}, "6": {"stats": {"resistance": 22}}}}, "spectre_veloce": {"name": "Spectre Véloce", "rarity": "rare", "items": ["spectre_veloce_capuche", "spectre_veloce_combinaison", "spectre_veloce_gants", "spectre_veloce_bottes", "spectre_veloce_cape", "spectre_veloce_lames"], "bonuses": {"2": {"stats": {"agility": 4, "speed": 4}}, "4": {"stats": {"agility": 10, "speed": 10}}, "6": {"stats": {"agility": 18, "speed": 18}}}}, "rempart_spectral": {"name": "Rempart Spectral", "rarity": "rare", "items": ["rempart_spectral_heaume", "rempart_spectral_armure", "rempart_spectral_bracelet", "rempart_spectral_amulette", "rempart_spectral_bague", "rempart_spectral_bouclier"], "bonuses": {"2": {"stats": {"mana": 4, "resistance": 4}}, "4": {"stats": {"mana": 10, "resistance": 10}}, "6": {"stats": {"mana": 18, "resistance": 18}}}}, "sentinelle_hybride": {"name": "Sentinelle Hybride", "rarity": "rare", "items": ["sentinelle_hybride_casque", "sentinelle_hybride_armure", "sentinelle_hybride_brassards", "sentinelle_hybride_bottes", "sentinelle_hybride_cape", "sentinelle_hybride_bracelet", "sentinelle_hybride_lames"], "bonuses": {"2": {"stats": {"resistance": 3, "speed": 3, "agility": 3}}, "4": {"stats": {"resistance": 8, "speed": 8, "agility": 8}}, "7": {"stats": {"resistance": 15, "speed": 15, "agility": 15}}}}, "harmonie_primaire": {"name": "Harmonie Primaire", "rarity": "rare", "items": ["harmonie_casque", "harmonie_plastron", "harmonie_gants", "harmonie_bottes", "harmonie_cape", "harmonie_collier", "harmonie_anneau", "harmonie_noyau"], "bonuses": {"2": {"stats_all": 2}, "4": {"stats_all": 5}, "6": {"stats_all": 10}, "8": {"stats_all": 18}}}, "chrome_sauvage": {"name": "Chrome Sauvage", "rarity": "epic", "items": ["chrome_sauvage_casque", "chrome_sauvage_armure", "chrome_sauvage_brassards", "chrome_sauvage_gants", "chrome_sauvage_bottes", "chrome_sauvage_hache", "chrome_sauvage_griffes"], "bonuses": {"2": {"stats": {"strength": 8, "agility": 8}}, "4": {"stats": {"strength": 18, "agility": 18}}, "7": {"stats": {"strength": 30, "agility": 30}}}}, "bastion_blinde": {"name": "Bastion Blindé", "rarity": "epic", "items": ["bastion_blinde_heaume", "bastion_blinde_cuirasse", "bastion_blinde_epaulieres", "bastion_blinde_gantelets", "bastion_blinde_jambieres", "bastion_blinde_bottes"], "bonuses": {"2": {"stats": {"strength": 8, "resistance": 8}}, "4": {"stats": {"strength": 18, "resistance": 18}}, "6": {"stats": {"strength": 30, "resistance": 30}}}}, "synapse_arcane": {"name": "Synapse Arcane", "rarity": "epic", "items": ["synapse_arcane_diademe", "synapse_arcane_manteau", "synapse_arcane_gants", "synapse_arcane_bracelet", "synapse_arcane_anneau", "synapse_arcane_sceptre"], "bonuses": {"2": {"stats": {"intelligence": 8, "mana": 8}}, "4": {"stats": {"intelligence": 18, "mana": 18}}, "6": {"stats": {"intelligence": 30, "mana": 30}}}}, "predateur_mecanique": {"name": "Prédateur Mécanique", "rarity": "epic", "items": ["predateur_meca_casque", "predateur_meca_armure", "predateur_meca_brassards", "predateur_meca_gants", "predateur_meca_bottes", "predateur_meca_cape", "predateur_meca_lames"], "bonuses": {"2": {"stats": {"strength": 5, "agility": 5, "speed": 5}}, "4": {"stats": {"strength": 12, "agility": 12, "speed": 12}}, "7": {"stats": {"strength": 22, "agility": 22, "speed": 22}}}}, "conscience_nexus": {"name": "Conscience du Nexus", "rarity": "epic", "items": ["conscience_nexus_diademe", "conscience_nexus_robe", "conscience_nexus_gants", "conscience_nexus_bracelet", "conscience_nexus_collier", "conscience_nexus_anneau", "conscience_nexus_livre"], "bonuses": {"2": {"stats": {"intelligence": 5, "mana": 5, "charisma": 5}}, "4": {"stats": {"intelligence": 12, "mana": 12, "charisma": 12}}, "7": {"stats": {"intelligence": 22, "mana": 22, "charisma": 22}}}}, "protocole_genesis": {"name": "Protocole Genesis", "rarity": "epic", "items": ["genesis_couronne", "genesis_armure", "genesis_gants", "genesis_bracelet", "genesis_jambieres", "genesis_bottes", "genesis_collier", "genesis_noyau"], "bonuses": {"2": {"stats_all": 3}, "4": {"stats_all": 8}, "6": {"stats_all": 15}, "8": {"stats_all": 25}}}, "predateur_urbain": {"name": "Prédateur Urbain", "rarity": "rare", "items": ["casque_combat_spectre", "combinaison_furtive_ombre", "souliers_semelles_silence"], "bonuses": {"3": {"stats": {"agility": 10, "speed": 5}}}}, "centurion_nexus": {"name": "Centurion du Nexus", "rarity": "rare", "items": ["armure_plaques_cinetiques", "jambieres_centurion_nexus", "generateur_bouclier_force"], "bonuses": {"3": {"stats": {"resistance": 10, "strength": 5}}}}, "executeur": {"name": "Exécuteur", "rarity": "epic", "items": ["casque_executeur_nexus", "dagues_jumelles_assassin", "cape_dephasage"], "bonuses": {"3": {"stats": {"agility": 15, "intelligence": 10}}}}, "titan": {"name": "Titan", "rarity": "epic", "items": ["poings_atlas", "exosquelette_jambes_titan", "fendoir_gravite"], "bonuses": {"3": {"stats": {"strength": 15, "resistance": 10}}}}, "velvet_court": {"name": "Velvet Court", "rarity": "legendary", "items": ["velvet_courts_diadem", "velvet_courts_pendant", "velvet_courts_signet"], "bonuses": {"2": {"stats": {"charisma": 30}}, "3": {"stats": {"charisma": 80}, "buff_mult": {"charisma": 1.5}}}}, "phantom_edge": {"name": "Phantom Edge", "rarity": "legendary", "items": ["phantom_edges_cowl", "phantom_edges_bracers", "phantom_edges_stiletto"], "bonuses": {"2": {"stats": {"agility": 30}}, "3": {"stats": {"agility": 80}, "buff_mult": {"agility": 1.5}}}}, "roi_loup": {"name": "Roi-Loup", "rarity": "legendary", "items": ["collier_roi_loup_blanc", "crocs_basilic_ombre", "anneau_chronos"], "bonuses": {"3": {"stats": {"strength": 25, "agility": 25}}}}, "monarque": {"name": "Monarque", "rarity": "legendary", "items": ["couronne_monarque_dechu", "manteau_souverain_ombres", "masque_divinite_mecanique"], "bonuses": {"3": {"stats": {"mana": 25, "charisma": 25}}}}, "iron_vanguard": {"name": "Iron Vanguard", "rarity": "mythic", "items": ["iron_vanguards_helm", "iron_vanguards_fists", "iron_vanguards_warhammer", "iron_vanguards_chestplate", "iron_vanguards_greaves", "iron_vanguards_chains"], "bonuses": {"2": {"stats": {"strength": 50}}, "4": {"stats": {"strength": 120}, "buff_mult": {"strength": 1.5}}, "6": {"stats": {"strength": 200, "resistance": 50}, "buff_mult": {"strength": 2.0}}}}, "nexus_core": {"name": "Nexus", "rarity": "mythic", "items": ["original_fragment_core_nexus", "fragment_of_reality", "ia_conscience_gaia"], "bonuses": {"2": {"stats": {"mana": 50}}, "3": {"stats_all": 25}}}, "principle": {"name": "The Principle", "rarity": "unique", "items": ["wings_principle_speed", "dagger_principle_reality", "mask_principle_attraction", "book_principle_savant"], "bonuses": {"2": {"stats_all": 30}, "4": {"stats_all": 80, "buff_mult_all": 1.25}}}, "time_paradox": {"name": "Time Paradox", "rarity": "unique", "items": ["time_paradox_ring", "time_paradox_watch"], "bonuses": {"2": {"stats": {"speed": 40, "agility": 40}}}}, "hero_of_the_era": {"name": "Hero of the Era", "rarity": "artifact", "items": ["hero_eras_crown", "hero_eras_mantle", "hero_eras_gauntlets", "hero_eras_greaves", "hero_eras_blade", "hero_eras_cloak", "hero_eras_ring", "hero_eras_bracers", "hero_eras_pendant"], "bonuses": {"2": {"stats_all": 30}, "4": {"stats_all": 75}, "6": {"stats_all": 150, "buff_mult_all": 1.25}, "9": {"stats_all": 300, "buff_mult_all": 1.5, "nerf_reduction": 0.25}}}, "destiny": {"name": "Destiny", "rarity": "artifact", "items": ["destinys_gauntelet", "destinys_chains", "destinys_cuffs"], "bonuses": {"2": {"stats_all": 50}, "3": {"stats_all": 150}}}, "origin": {"name": "Origin", "rarity": "artifact", "items": ["origins_chestplate", "origins_ring"], "bonuses": {"2": {"stats": {"mana": 100, "intelligence": 50}}}}, "old_chaos": {"name": "Old Chaos", "rarity": "artifact", "items": ["old_chaos_mask", "old_chaos_ring"], "bonuses": {"2": {"stats": {"strength": 100, "mana": 50}}}}, "equalizer_set": {"name": "Equalizer", "rarity": "artifact", "items": ["equalizer", "fragment_of_reality", "birth_of_the_imaginary"], "bonuses": {"2": {"special": "equalize_to_highest"}, "3": {"special": "equalize_to_highest_plus_10pct"}}}, "baldun": {"name": "Baldun", "rarity": "mastercraft", "items": ["balduns_crown", "balduns_chestplate", "balduns_ring", "balduns_chivalery", "balduns_gauntelet", "balduns_chains", "balduns_cape", "balduns_executionner", "balduns_claws", "balduns_bracelet", "balduns_god_shoes", "great_balduns_core"], "bonuses": {"4": {"stats_all": 500}, "12": {"stats_all": 2000}}}};
const SLOT_LIMITS={
  tete:{label:'Tête',max:3},torse:{label:'Torse',max:1},bras:{label:'Bras',max:4},
  mains:{label:'Mains',max:3},doigts:{label:'Doigts',max:10},poignets:{label:'Poignets',max:2},
  jambes:{label:'Jambes',max:3},pieds:{label:'Pieds',max:2},dos:{label:'Dos',max:1},
  cou:{label:'Cou',max:2},armes_h:{label:'Armes H',max:1},armes_l:{label:'Armes L',max:2},
  oreilles:{label:'Oreilles',max:2},visage:{label:'Visage',max:1},special:{label:'Spécial',max:2},
  /* IRP-exclusifs — mirror cogs/irp_inventory_system.py IRP_SLOT_LIMITS */
  erp:{label:'ERP',max:3,irp:true,requiredTag:'erp'},
  dominion:{label:'Dominion',max:3,irp:true,requiredTag:'dominion'},
  lord:{label:'Seigneurie',max:4,irp:true}
};

const RARITY_COLORS={
  common:'#6b7280',uncommon:'#60a5fa',rare:'#a78bfa',epic:'#8B5CF6',
  legendary:'#fbbf24',mythic:'#f97316',unique:'#ffd60a',
  artifact:'#ef4444',mastercraft:'#ff006e',signature:'#ffd60a'
};


let INV_TAB='all';
let _invSearchTimer=null;
let _invDetailOpen=null; // itemId actuellement affiché dans le panneau détail
let _tippyInstances=[];
let _sortableGrid=null;
let _sortableSlots={};

/* ── Optimisation rendu ── */
let _invLastHash='';      /* hash des ids+qtés pour éviter re-render inutile */
let _invFirstRender=true; /* GSAP stagger uniquement au 1er affichage ou après filtre */
let _invFilterChanged=false; /* signalé par setInvFilter / invSearchDebounce */

// ── FILTRE CATÉGORIE ──
function setInvFilter(cat){
  INV_TAB=cat;
  _invFilterChanged=true; /* force l'animation GSAP au prochain render */
  document.querySelectorAll('.inv-cat').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  renderItemsGrid();
}

// Recherche avec debounce 200ms
function invSearchDebounce(){
  _invFilterChanged=true;
  clearTimeout(_invSearchTimer);
  _invSearchTimer=setTimeout(()=>renderItemsGrid(),200);
}

// ── RENDER INVENTAIRE COMPLET ──
function renderInventory(){
  if(!INV_DATA)return;
  renderCharacterPanel();
  renderItemsGrid();
  renderStatsSummary();
  renderSetsPanel();
  // Mise à jour compteur équipés
  const eqCount=(INV_DATA.equipped_assets||[]).length;
  const el=document.getElementById('inv-equip-count');
  if(el) el.textContent=`${eqCount} item${eqCount!==1?'s':''} équipé${eqCount!==1?'s':''}`;
  // Réinitialiser drag & drop et tooltips après rendu
  requestAnimationFrame(()=>{
    initDragDrop();
    initTooltips();
    // Ré-afficher le panneau détail si un item était sélectionné
    if(_invDetailOpen) showItemDetail(_invDetailOpen,false);
  });
}

// ── RENDER PANNEAU PERSONNAGE (silhouette + slots) ──
function renderCharacterPanel(){
  const equipped=INV_DATA.equipped_assets||[];
  const bySlot={};
  equipped.forEach(id=>{
    const it=ALL_ITEMS_DATA[id]||{};
    const slot=it.slot;
    if(!slot)return;
    if(!bySlot[slot])bySlot[slot]=[];
    bySlot[slot].push(id);
  });

  const slotOrder=['tete','visage','cou','oreilles','torse','dos','bras','mains','poignets','doigts','jambes','pieds','armes_h','armes_l','special','erp','dominion','lord'];
  slotOrder.forEach(slotId=>{
    const cellsCont=document.getElementById('sz-'+slotId);
    if(!cellsCont)return;
    const def=SLOT_LIMITS[slotId];if(!def)return;
    const occupants=bySlot[slotId]||[];
    let html='';
    for(let i=0;i<def.max;i++){
      const itemId=occupants[i]||null;
      const it=itemId?ALL_ITEMS_DATA[itemId]||{}:{};
      if(itemId){
        html+=`<div class="slot-cell occupied" data-item-id="${itemId}" data-slot="${slotId}" onclick="showItemDetail('${itemId}')" title="${e(it.name||itemId)}">${it.image?`<img src="${e(it.image)}" alt="${e(it.name||itemId)}" class="slot-cell-img">`:(it.emoji||'📦')}</div>`;
      } else {
        html+=`<div class="slot-cell empty-cell" data-slot="${slotId}" data-index="${i}"></div>`;
      }
    }
    cellsCont.innerHTML=html;
  });
  // Lancer l'animation de scan si GSAP est disponible
  initCharScanAnimation();
}

// ── ANIMATION SCAN SILHOUETTE (GSAP) ──
function initCharScanAnimation(){
  // Human body hover label (from Human-Body-Rendering-HTML)
  const body=document.querySelector('.human-body');
  const lbl=document.getElementById('cyb-body-label');
  if(!body||!lbl)return;
  if(body._hbInit)return; // already initialized
  body._hbInit=true;
  const LABELS={head:'TÊTE','left-shoulder':'ÉPAULE GAUCHE','right-shoulder':'ÉPAULE DROITE',
    'left-arm':'BRAS GAUCHE','right-arm':'BRAS DROIT',chest:'TORSE',stomach:'ABDOMEN',
    'left-leg':'JAMBE GAUCHE','right-leg':'JAMBE DROITE','left-hand':'MAIN GAUCHE',
    'right-hand':'MAIN DROITE','left-foot':'PIED GAUCHE','right-foot':'PIED DROIT'};
  body.querySelectorAll('svg').forEach(svg=>{
    svg.addEventListener('mouseenter',function(){
      const pos=this.getAttribute('data-position')||'';
      lbl.textContent=LABELS[pos]||pos.toUpperCase();
      lbl.style.opacity='1';
    });
    svg.addEventListener('mouseleave',function(){lbl.style.opacity='0';});
  });
}

// ── RENDER GRILLE ITEMS ──
function renderItemsGrid(){
  if(!INV_DATA)return;
  const items=INV_DATA.items||{};
  const equipped=new Set(INV_DATA.equipped_assets||[]);

  // Construire liste unifiée (inventaire + équipés)
  const allEntries=new Map(Object.entries(items));
  equipped.forEach(id=>{if(!allEntries.has(id))allEntries.set(id,0);});
  let entries=Array.from(allEntries.entries());

  // Filtre catégorie
  if(INV_TAB==='equipped'){
    entries=Array.from(equipped).map(id=>[id,0]);
  } else if(INV_TAB==='equipment'){
    entries=entries.filter(([id])=>(ALL_ITEMS_DATA[id]||{}).slot);
  } else if(INV_TAB==='consumable'){
    entries=entries.filter(([id])=>['consumable','food','usable'].includes((ALL_ITEMS_DATA[id]||{}).type));
  } else if(INV_TAB==='other'){
    entries=entries.filter(([id])=>{const it=ALL_ITEMS_DATA[id]||{};return !it.slot&&!['consumable','food','usable'].includes(it.type);});
  }

  // Filtre rareté
  const fRarity=(document.getElementById('inv-filter-rarity')||{}).value||'';
  if(fRarity) entries=entries.filter(([id])=>(ALL_ITEMS_DATA[id]||{}).rarity?.toLowerCase()===fRarity);
  // Filtre slot
  const fSlot=(document.getElementById('inv-filter-slot')||{}).value||'';
  if(fSlot) entries=entries.filter(([id])=>(ALL_ITEMS_DATA[id]||{}).slot===fSlot);
  // Filtre texte
  const fText=((document.getElementById('inv-search')||{}).value||'').toLowerCase().trim();
  if(fText) entries=entries.filter(([id])=>(ALL_ITEMS_DATA[id]||{}).name?.toLowerCase().includes(fText)||id.toLowerCase().includes(fText));

  // Tri
  const sortMode=(document.getElementById('inv-sort')||{}).value||'rarity';
  const RORD={common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5,unique:6,artifact:7,mastercraft:8,signature:9};
  entries.sort((a,b)=>{
    if(sortMode==='name'){
      return (ALL_ITEMS_DATA[a[0]]?.name||a[0]).localeCompare(ALL_ITEMS_DATA[b[0]]?.name||b[0]);
    } else if(sortMode==='slot'){
      const sa=ALL_ITEMS_DATA[a[0]]?.slot||'zzz';
      const sb=ALL_ITEMS_DATA[b[0]]?.slot||'zzz';
      return sa.localeCompare(sb);
    }
    // default: rareté décroissante
    return (RORD[(ALL_ITEMS_DATA[b[0]]||{}).rarity?.toLowerCase()]||0)-(RORD[(ALL_ITEMS_DATA[a[0]]||{}).rarity?.toLowerCase()]||0);
  });

  const grid=document.getElementById('inv-grid');
  if(!entries.length){grid.innerHTML='<div class="inv-empty-msg">Aucun item trouvé</div>';_invLastHash='';return;}

  /* ── Dirty check : évite de reconstruire le DOM si les données n'ont pas changé ── */
  const newHash=entries.map(([id,qty])=>id+':'+qty).join('|');
  const dataChanged=newHash!==_invLastHash;
  _invLastHash=newHash;

  if(dataChanged){
    /* Détruire anciens tooltips avant de reconstruire le DOM */
    _destroyTooltips();

    /* DocumentFragment — batch insertion, un seul reflow */
    const frag=document.createDocumentFragment();
    entries.forEach(([id,qty])=>{
      const it=ALL_ITEMS_DATA[id]||{};
      const isEq=equipped.has(id);
      const rarity=(it.rarity||'common').toLowerCase();
      const rc=RARITY_COLORS[rarity]||'#6b7280';
      const slotLabel=it.slot?SLOT_LIMITS[it.slot]?.label||it.slot:'';
      const div=document.createElement('div');
      div.className='inv-item rarity-'+rarity+(isEq?' equipped':'')+((_invDetailOpen===id)?' selected':'');
      div.dataset.itemId=id;
      div.dataset.rarity=rarity;
      div.dataset.slot=it.slot||'';
      div.draggable=true;
      div.setAttribute('onclick',"showItemDetail('"+id+"')");
      div.innerHTML=
        (isEq?'<span class="inv-badge-equipped"></span>':'')+
        (id.startsWith('irp_')?'<span class="inv-badge-irp" style="position:absolute;top:4px;right:4px;font-family:var(--font-m);font-size:0.38rem;letter-spacing:0.08em;color:#dc143c;background:rgba(220,20,60,0.12);border:1px solid rgba(220,20,60,0.25);border-radius:3px;padding:1px 5px;pointer-events:none;z-index:2;white-space:nowrap">EXCLU IRP</span>':'')+
        (qty>0?'<button class="inv-item-delete" onclick="openDeleteModal(\''+id+'\',event)" title="Supprimer de l\'inventaire" aria-label="Supprimer '+e(it.name||id)+'"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="10" height="10"><path d="M2 4h12M6 4V2h4v2M5 4l1 9h4l1-9"/></svg></button>':'')+
        '<span class="inv-item-emoji">'+(it.image?'<img src="'+e(it.image)+'" alt="'+e(it.name||id)+'" class="inv-item-img">':(it.emoji||'📦'))+'</span>'+
        '<div class="inv-item-name" style="color:'+rc+'">'+e(it.name||id)+'</div>'+
        (slotLabel?'<div class="inv-item-slot">'+slotLabel+'</div>':'')+
        (qty>1?'<span class="inv-badge-qty">×'+qty+'</span>':'');
      frag.appendChild(div);
    });
    grid.innerHTML='';
    grid.appendChild(frag);
  } else {
    /* Données identiques — seul le selected change (ouverture panneau détail) */
    grid.querySelectorAll('.inv-item').forEach(el=>{
      el.classList.toggle('selected',el.dataset.itemId===_invDetailOpen);
    });
  }

  /* ── GSAP stagger — uniquement au premier render ou après changement de filtre/données ── */
  const shouldAnimate=(_invFirstRender||_invFilterChanged||dataChanged)&&!prefersReducedMotion;
  if(shouldAnimate&&typeof gsap!=='undefined'){
    gsap.from('#inv-grid .inv-item',{opacity:0,y:14,duration:0.24,stagger:{each:0.018,from:'start',amount:0.35},ease:'power2.out',clearProps:'opacity,transform'});
  }
  _invFirstRender=false;
  _invFilterChanged=false;
}

// ── RENDER STATS SUMMARY ──
function renderStatsSummary(){
  const equipped=INV_DATA.equipped_assets||[];
  const totals={};
  const ALL_STAT_KEYS=['strength','agility','speed','intelligence','mana','resistance','charisma'];
  const charStats=(CHAR&&CHAR.stats)||{};
  const auraEnabled=parseInt(charStats.aura||0)>0;

  // 1) Standard equipment bonuses (skip signature + equalizer)
  equipped.forEach(id=>{
    const it=ALL_ITEMS_DATA[id]||{};
    if((it.rarity||'').toLowerCase()==='signature')return;
    if(id==='equalizer')return;
    const effects=it.stat_effects||it.stats||{};
    Object.entries(effects).forEach(([s,v])=>{
      try{totals[s]=(totals[s]||0)+parseInt(String(v).replace('+',''));}catch(_){}
    });
  });

  // 2) Signature items
  const existBuf={...totals};
  const sigB=calculateSignatureBonuses(equipped,charStats,auraEnabled,existBuf);
  Object.entries(sigB).forEach(([s,v])=>{totals[s]=(totals[s]||0)+v;});

  // 3) Set bonuses (highest threshold only)
  const setResult=calculateSetBonuses(equipped);
  Object.entries(setResult.stats).forEach(([s,v])=>{totals[s]=(totals[s]||0)+v;});

  // 4) Mythic+ effects
  const mythicResult=calculateMythicEffects(equipped,charStats,totals,auraEnabled);

  // 5) Apply buff multipliers + Equalizer
  applyBuffMultipliersAndEqualizer(totals,charStats,equipped,mythicResult.itemBuffMult,setResult,auraEnabled);

  const entries=Object.entries(totals).filter(([,v])=>v>0);
  const el=document.getElementById('equip-bonus-grid');
  if(!el)return;
  if(!entries.length){el.innerHTML='<div class="empty" style="grid-column:1/-1;font-size:.44rem">Aucun bonus</div>';return;}
  el.innerHTML=entries.map(([s,v])=>`
    <div class="equip-bonus-block">
      <div class="equip-bonus-val">+${v}</div>
      <div class="equip-bonus-name">${SI[s]||''} ${SL[s]||s}</div>
    </div>`).join('');
}

// ── RENDER SETS (accordéon) ──
function renderSetsPanel(){
  const equipped=new Set(INV_DATA.equipped_assets||[]);
  const activeSets=[];
  const rc={common:'#6b7280',uncommon:'#60a5fa',rare:'#a78bfa',epic:'#8B5CF6',legendary:'#fbbf24',mythic:'#f97316',unique:'#ffd60a',artifact:'#ef4444',mastercraft:'#ff006e'};

  Object.entries(ITEM_SETS).forEach(([setId,setDef])=>{
    const count=setDef.items.filter(i=>equipped.has(i)||(INV_DATA.items||{})[i]).length;
    if(count<1)return;
    const thresholds=Object.keys(setDef.bonuses).map(Number).sort((a,b)=>a-b);
    const equippedCount=setDef.items.filter(i=>equipped.has(i)).length;
    const activeThresh=thresholds.filter(t=>equippedCount>=t);
    activeSets.push({setId,setDef,count,thresholds,activeThresh,equippedCount});
  });

  activeSets.sort((a,b)=>(b.equippedCount-a.equippedCount)||(b.count-a.count));

  const el=document.getElementById('sets-grid');if(!el)return;
  if(!activeSets.length){el.innerHTML='<div class="empty" style="font-size:.44rem">Aucune pièce de set</div>';return;}

  el.innerHTML=activeSets.map(({setId,setDef,count,thresholds,activeThresh,equippedCount})=>{
    const color=rc[setDef.rarity]||'#6b7280';
    const isActive=equippedCount>=2;
    const total=setDef.items.length;

    const threshHtml=thresholds.map(t=>`<span class="set-thresh ${activeThresh.includes(t)?'active':'inactive'}">${t}pc</span>`).join('');

    const bonusHtml=activeThresh.map(t=>{
      const b=setDef.bonuses[String(t)]||setDef.bonuses[t];
      const parts=[];
      if(b.stats)Object.entries(b.stats).forEach(([s,v])=>parts.push(`+${v} ${SI[s]||s}`));
      if(b.stats_all)parts.push(`+${b.stats_all} tous stats`);
      if(b.buff_mult)Object.entries(b.buff_mult).forEach(([s,m])=>parts.push(`buffs ${s} ×${m}`));
      if(b.buff_mult_all)parts.push(`buffs ×${b.buff_mult_all}`);
      if(b.nerf_reduction)parts.push(`-${Math.round(b.nerf_reduction*100)}% nerfs`);
      if(b.special)parts.push(`✦ Effet spécial`);
      return parts.length?`<div class="set-bonus-line">${t}pc : ${parts.join(' · ')}</div>`:'';
    }).join('');

    const piecesHtml=setDef.items.map(id=>{
      const hasEquipped=equipped.has(id);
      const hasInInv=!!(INV_DATA.items||{})[id];
      const have=hasEquipped||hasInInv;
      const it=ALL_ITEMS_DATA[id]||{};
      return`<span class="set-piece ${have?'have':'missing'}">${e(it.name||id.replace(/_/g,' '))}</span>`;
    }).join('');

    // Nb d'items du set équipables (dans l'inventaire, pas encore équipés)
    const equipable=setDef.items.filter(id=>!equipped.has(id)&&!!(INV_DATA.items||{})[id]).length;

    return`<div class="set-card" style="border-left:3px solid ${color}">
      <div class="set-header" onclick="toggleSetAccordion('${setId}')">
        <div class="set-header-left">
          <span class="set-name" style="color:${color}">${e(setDef.name)}</span>
          <span class="set-rarity-tag" style="color:${color}">${setDef.rarity.toUpperCase()}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="set-count ${isActive?'active':'inactive'}">${equippedCount}/${total}</span>
          <span class="set-chevron" id="chev-${setId}">▾</span>
        </div>
      </div>
      <div class="set-body" id="setbody-${setId}">
        <div class="set-thresholds">${threshHtml}</div>
        ${bonusHtml?`<div class="set-bonus-list">${bonusHtml}</div>`:''}
        <div class="set-items">${piecesHtml}</div>
        ${equipable>0?`<button class="set-equip-all-btn" onclick="event.stopPropagation();equipWholeSet('${setId}')">⚡ Équiper le set (${equipable} item${equipable>1?'s':''})</button>`:''}
      </div>
    </div>`;
  }).join('');

  // Ouvrir automatiquement les sets actifs (≥2 pièces équipées)
  activeSets.filter(s=>s.equippedCount>=2).forEach(s=>{
    const body=document.getElementById('setbody-'+s.setId);
    const chev=document.getElementById('chev-'+s.setId);
    if(body){body.classList.add('open');if(chev)chev.classList.add('open');}
  });
}

function toggleSetAccordion(setId){
  const body=document.getElementById('setbody-'+setId);
  const chev=document.getElementById('chev-'+setId);
  if(!body)return;
  const isOpen=body.classList.toggle('open');
  if(chev)chev.classList.toggle('open',isOpen);
}

// ── ÉQUIPER TOUT UN SET ──
async function equipWholeSet(setId){
  if(!UID||!CHAR_ID)return;
  const setDef=ITEM_SETS[setId];
  if(!setDef)return;
  const newEquipped=[...(INV_DATA.equipped_assets||[])];
  const newItems={...(INV_DATA.items||{})};
  const HIGH_TIER=new Set(['legendary','mythic','unique','signature','artifact','mastercraft']);
  const charLvl=CHAR?(levelFromXp(CHAR.xp||0).level):1;
  let count=0;
  for(const itemId of setDef.items){
    if(newEquipped.includes(itemId))continue;
    if(!newItems[itemId])continue;
    const it=ALL_ITEMS_DATA[itemId]||{};
    const slot=it.slot;
    // Vérifier limites de slot
    if(slot){
      const def=SLOT_LIMITS[slot];
      if(def){
        const inSlot=newEquipped.filter(id=>(ALL_ITEMS_DATA[id]||{}).slot===slot).length;
        if(inSlot>=def.max)continue;
      }
    }
    // Vérifier restriction high-tier par niveau
    const itemRarity=(it.rarity||'common').toLowerCase();
    if(HIGH_TIER.has(itemRarity)){
      const RARITY_LIMITS=[[300,null],[100,15],[50,5],[10,1],[0,0]];
      let htLimit=0;
      for(const[thr,lim] of RARITY_LIMITS){if(charLvl>=thr){htLimit=lim;break;}}
      if(htLimit!==null){
        const htCount=newEquipped.filter(id=>{const r=(ALL_ITEMS_DATA[id]||{}).rarity||'';return HIGH_TIER.has(r.toLowerCase());}).length;
        if(htCount>=htLimit)continue;
      }
    }
    newEquipped.push(itemId);
    newItems[itemId]-=1;
    if(newItems[itemId]<=0)delete newItems[itemId];
    count++;
  }
  if(count===0){showEquipToast('❌ Aucun item à équiper',true);return;}
  const key=(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  try{
    await db.collection(C.INV).doc(key).update({equipped_assets:newEquipped,items:newItems});
    INV_DATA.equipped_assets=newEquipped;
    INV_DATA.items=newItems;
    showEquipToast(`✓ ${count} item${count>1?'s':''} équipé${count>1?'s':''}`);
    cacheInvalidate('_inventory');
    renderInventory();
  }catch(err){
    window._dbg?.error('[EQUIP_SET]',err);
    showEquipToast('❌ Erreur — réessaye',true);
  }
}

// ── PANNEAU DÉTAIL ITEM ──
function showItemDetail(itemId,animate=true){
  _invDetailOpen=itemId;
  const it=ALL_ITEMS_DATA[itemId]||{};
  const equipped=INV_DATA.equipped_assets||[];
  const items=INV_DATA.items||{};
  const isEq=equipped.includes(itemId);
  const rarity=(it.rarity||'common').toLowerCase();
  const rc=RARITY_COLORS[rarity]||'#6b7280';
  const effects=it.stat_effects||it.stats||{};
  const effEntries=Object.entries(effects);
  const maxStatVal=effEntries.length?Math.max(...effEntries.map(([,v])=>parseInt(v)||0)):1;
  const slotLabel=it.slot?SLOT_LIMITS[it.slot]?.label||it.slot:'';
  const qty=items[itemId]||0;
  const hasSlot=!!it.slot;

  const statsHtml=effEntries.length?`
    <div class="inv-detail-stats-title">Statistiques</div>
    ${effEntries.map(([s,v])=>{
      const pct=Math.min(100,Math.round((parseInt(v)||0)/Math.max(maxStatVal,1)*100));
      return`<div class="inv-detail-stat-row">
        <span class="inv-detail-stat-icon">${SI[s]||'•'}</span>
        <span class="inv-detail-stat-name">${SL[s]||s}</span>
        <div class="inv-detail-stat-bar"><div class="inv-detail-stat-fill" data-pct="${pct}" style="width:0%"></div></div>
        <span class="inv-detail-stat-val">+${v}</span>
      </div>`;
    }).join('')}`:'<div class="inv-detail-no-stats">Aucune statistique</div>';

  const actionsHtml=(hasSlot?`
    <button class="inv-detail-btn ${isEq?'unequip':'equip'}" onclick="toggleEquip('${itemId}')">
      ${isEq?'⊖ Déséquiper':'⊕ Équiper'}
    </button>
  `:(qty>0?`<div class="inv-detail-no-stats" style="margin-top:4px">Gérable depuis l'onglet Mon Shop</div>`:''))
  +(qty>0?`<button class="inv-detail-btn delete" onclick="openDeleteModal('${itemId}',event)">⊗ Supprimer</button>`:'');

  document.getElementById('inv-detail-content').innerHTML=`
    ${it.image?`<img src="${e(it.image)}" alt="${e(it.name||itemId)}" class="inv-detail-img" style="width:64px;height:64px;object-fit:contain;border-radius:8px;margin-bottom:8px">`:`<span class="inv-detail-emoji" style="color:${rc}">${it.emoji||'📦'}</span>`}
    <div class="inv-detail-name" style="color:${rc}">${e(it.name||itemId)}</div>
    <div class="inv-detail-rarity" style="color:${rc}">${rarity}</div>
    ${slotLabel?`<div class="inv-detail-slot-tag">📍 ${slotLabel}</div>`:''}
    ${it.description?`<div class="inv-detail-desc" style="font-size:.38rem;color:var(--text3);margin:6px 0;line-height:1.4;font-style:italic">${e(it.description)}</div>`:''}
    <div class="inv-detail-sep"></div>
    ${statsHtml}
    ${qty>0?`<div class="inv-detail-qty-info">Quantité en inventaire : ×${qty}</div>`:''}
    ${isEq?'<div class="inv-detail-qty-info" style="color:var(--cyan)">⚡ Actuellement équipé</div>':''}
    <div class="inv-detail-actions">${actionsHtml}</div>
  `;

  // Ouvrir panneau
  const panel=document.getElementById('inv-detail-panel');
  const overlay=document.getElementById('inv-detail-overlay');
  panel.classList.add('open');
  overlay.classList.add('open');

  // Surbrillance item sélectionné dans la grille
  document.querySelectorAll('#inv-grid .inv-item').forEach(el=>{
    el.classList.toggle('selected',el.dataset.itemId===itemId);
  });

  // GSAP : animation barres de stats
  if(animate&&typeof gsap!=='undefined'&&!prefersReducedMotion){
    gsap.set(panel,{x:60,opacity:0.6});
    gsap.to(panel,{x:0,opacity:1,duration:0.35,ease:'power3.out',overwrite:true});
    requestAnimationFrame(()=>{
      document.querySelectorAll('.inv-detail-stat-fill').forEach(bar=>{
        gsap.to(bar,{width:bar.dataset.pct+'%',duration:0.7,ease:'power2.out',delay:0.15});
      });
    });
  } else {
    document.querySelectorAll('.inv-detail-stat-fill').forEach(bar=>{
      bar.style.width=bar.dataset.pct+'%';
    });
  }
}

function closeItemDetail(){
  _invDetailOpen=null;
  const panel=document.getElementById('inv-detail-panel');
  const overlay=document.getElementById('inv-detail-overlay');
  if(typeof gsap!=='undefined'&&!prefersReducedMotion){
    gsap.to(panel,{x:60,opacity:0,duration:0.28,ease:'power2.in',overwrite:true,onComplete:()=>{
      panel.classList.remove('open');
      gsap.set(panel,{clearProps:'transform,opacity'});
    }});
  } else {
    panel.classList.remove('open');
  }
  overlay.classList.remove('open');
  document.querySelectorAll('#inv-grid .inv-item.selected').forEach(el=>el.classList.remove('selected'));
}

// ── DRAG & DROP (SortableJS) ──
function initDragDrop(){
  if(typeof Sortable==='undefined')return;
  // Désactiver D&D sur appareils tactiles (téléphone, tablette)
  if(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches)return;

  // Détruire instances précédentes
  if(_sortableGrid){try{_sortableGrid.destroy();}catch(_){}_sortableGrid=null;}
  Object.values(_sortableSlots).forEach(s=>{try{s.destroy();}catch(_){}});
  _sortableSlots={};

  const grid=document.getElementById('inv-grid');
  if(!grid)return;

  // SortableJS sur la grille (source)
  _sortableGrid=Sortable.create(grid,{
    group:{name:'jaharta-inv',pull:'clone',put:false},
    animation:150,
    distance:12, // min 12px pour distinguer clic de drag
    sort:false,
    ghostClass:'dragging',
    onStart(evt){
      const itemId=evt.item.dataset.itemId;
      if(!itemId)return;
      const it=ALL_ITEMS_DATA[itemId]||{};
      // Mettre en surbrillance les zones compatibles
      document.querySelectorAll('.slot-zone').forEach(zone=>{
        zone.classList.toggle('drag-over',zone.dataset.slot===it.slot);
      });
    },
    onEnd(){
      document.querySelectorAll('.slot-zone').forEach(z=>z.classList.remove('drag-over'));
    }
  });

  // SortableJS sur chaque zone de slot (cible)
  const slotOrder=['tete','visage','cou','oreilles','torse','dos','bras','mains','poignets','doigts','jambes','pieds','armes_h','armes_l','special','erp','dominion','lord'];
  slotOrder.forEach(slotId=>{
    const cells=document.getElementById('sz-'+slotId);
    if(!cells)return;
    _sortableSlots[slotId]=Sortable.create(cells,{
      group:{name:'jaharta-inv',pull:false,put:['jaharta-inv']},
      animation:150,
      onAdd(evt){
        // Récupérer l'itemId depuis l'élément draggué
        const itemId=evt.item.dataset.itemId;
        // Supprimer l'élément ajouté par SortableJS (on gère le DOM via renderInventory)
        evt.item.remove();
        if(!itemId)return;
        const it=ALL_ITEMS_DATA[itemId]||{};
        // Vérifier que le slot correspond
        if(it.slot!==slotId){
          showEquipToast(`❌ Slot incompatible (${SLOT_LIMITS[it.slot]?.label||it.slot||'?'} ≠ ${SLOT_LIMITS[slotId]?.label||slotId})`,true);
          return;
        }
        // Déléguer à toggleEquip (qui vérifie limites et écrit Firestore)
        toggleEquip(itemId);
      }
    });
  });
}

// ── TOOLTIPS (Tippy.js) ──
function _destroyTooltips(){
  _tippyInstances.forEach(t=>{try{t.destroy();}catch(_){}});
  _tippyInstances=[];
}

function initTooltips(){
  if(typeof tippy==='undefined')return;
  _destroyTooltips();

  const items=document.querySelectorAll('#inv-grid .inv-item');
  if(!items.length)return;

  const instances=tippy(Array.from(items),{
    theme:'cy',
    placement:'top',
    delay:[220,0],
    arrow:true,
    allowHTML:true,
    content(el){
      const id=el.dataset.itemId;
      const it=ALL_ITEMS_DATA[id]||{};
      const rarity=(it.rarity||'common').toLowerCase();
      const rc=RARITY_COLORS[rarity]||'#6b7280';
      const effects=it.stat_effects||it.stats||{};
      const effHtml=Object.entries(effects).slice(0,4).map(([s,v])=>`
        <div class="inv-tip-stat"><span>${SI[s]||''} ${SL[s]||s}</span><span class="inv-tip-val">+${v}</span></div>`).join('');
      const slotLabel=it.slot?SLOT_LIMITS[it.slot]?.label||it.slot:'';
      return`<div>
        <div class="inv-tip-name" style="color:${rc}">${e(it.name||id)}</div>
        <div class="inv-tip-rarity" style="color:${rc}">${rarity}</div>
        ${slotLabel?`<div class="inv-tip-slot">📍 ${slotLabel}</div>`:''}
        ${effHtml?`<div style="margin-top:5px;border-top:1px solid rgba(0,229,255,0.1);padding-top:5px">${effHtml}</div>`:''}
      </div>`;
    }
  });
  _tippyInstances=Array.isArray(instances)?instances:[instances];

  // Tooltips sur les cellules de slots occupées
  const cells=document.querySelectorAll('.slot-cell.occupied');
  if(cells.length){
    const cellInst=tippy(Array.from(cells),{
      theme:'cy',
      placement:'right',
      delay:[150,0],
      arrow:true,
      allowHTML:true,
      content(el){
        const id=el.dataset.itemId;
        const it=ALL_ITEMS_DATA[id]||{};
        const rc=RARITY_COLORS[(it.rarity||'common').toLowerCase()]||'#6b7280';
        return`<div><div class="inv-tip-name" style="color:${rc}">${e(it.name||id)}</div><div style="font-size:.4rem;color:var(--text3);margin-top:3px">Clic pour voir / déséquiper</div></div>`;
      }
    });
    const arr=Array.isArray(cellInst)?cellInst:[cellInst];
    _tippyInstances.push(...arr);
  }
}

// ── EQUIP / UNEQUIP via Firestore ──
async function toggleEquip(itemId){
  if(!UID||!CHAR_ID)return;
  const equipped=INV_DATA.equipped_assets||[];
  const items=INV_DATA.items||{};
  const it=ALL_ITEMS_DATA[itemId]||{};
  const isEq=equipped.includes(itemId);
  const key=(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);

  // Feedback visuel immédiat sur l'item dans la grille
  const itemEl=document.querySelector(`#inv-grid .inv-item[data-item-id="${itemId}"]`);
  if(itemEl&&typeof gsap!=='undefined'){
    gsap.to(itemEl,{scale:0.88,opacity:0.5,duration:0.15,yoyo:true,repeat:1,ease:'power2.inOut'});
  }

  try{
    let newEquipped=[...equipped];
    let newItems={...items};

    if(isEq){
      // Déséquiper
      newEquipped=newEquipped.filter(id=>id!==itemId);
      newItems[itemId]=(newItems[itemId]||0)+1;
      await db.collection(C.INV).doc(key).update({equipped_assets:newEquipped,items:newItems});
      INV_DATA.equipped_assets=newEquipped;
      INV_DATA.items=newItems;
      showEquipToast(`✓ ${it.name||itemId} déséquipé`);
    } else {
      // Vérifier limites de slot
      const slot=it.slot;
      if(slot){
        const def=SLOT_LIMITS[slot];
        if(def){
          const inSlot=equipped.filter(id=>(ALL_ITEMS_DATA[id]||{}).slot===slot).length;
          if(inSlot>=def.max){showEquipToast(`❌ Slot ${def.label} plein (${inSlot}/${def.max})`,true);return;}
          /* Slots IRP erp/dominion : tag obligatoire (lord accepte tout) */
          if(def.requiredTag){
            const rawTags=it.tags;
            const tags=Array.isArray(rawTags)?rawTags:(typeof rawTags==='string'?[rawTags]:[]);
            const has=tags.some(t=>String(t).toLowerCase()===def.requiredTag);
            if(!has){showEquipToast(`❌ Slot ${def.label} — item non tagué ${def.requiredTag.toUpperCase()}`,true);return;}
          }
        }
      }
      // Vérifier restriction high-tier par niveau
      const HIGH_TIER=new Set(['legendary','mythic','unique','signature','artifact','mastercraft']);
      const itemRarity=(it.rarity||'common').toLowerCase();
      if(HIGH_TIER.has(itemRarity)){
        const charLvl=CHAR?(levelFromXp(CHAR.xp||0).level):1;
        const RARITY_LIMITS=[[300,null],[100,15],[50,5],[10,1],[0,0]];
        let htLimit=0;
        for(const[thr,lim] of RARITY_LIMITS){if(charLvl>=thr){htLimit=lim;break;}}
        if(htLimit!==null){
          const htCount=equipped.filter(id=>{const r=(ALL_ITEMS_DATA[id]||{}).rarity||'';return HIGH_TIER.has(r.toLowerCase());}).length;
          if(htCount>=htLimit){
            showEquipToast(htLimit===0?`❌ Niveau ${charLvl} : aucun item Legendary+ autorisé`:`❌ Limite Legendary+ atteinte (${htCount}/${htLimit}) — niveau ${charLvl}`,true);
            return;
          }
        }
      }
      if(!items[itemId]&&!equipped.includes(itemId)){showEquipToast('❌ Item introuvable',true);return;}
      newEquipped=[...newEquipped,itemId];
      if(newItems[itemId]>0){
        newItems[itemId]-=1;
        if(newItems[itemId]<=0)delete newItems[itemId];
      }
      await db.collection(C.INV).doc(key).update({equipped_assets:newEquipped,items:newItems});
      INV_DATA.equipped_assets=newEquipped;
      INV_DATA.items=newItems;
      showEquipToast(`✓ ${it.name||itemId} équipé`);

      // Flash sur la cellule de slot
      if(typeof gsap!=='undefined'){
        const slotEl=document.getElementById('sz-'+it.slot);
        if(slotEl)gsap.fromTo(slotEl,{boxShadow:'0 0 0 rgba(0,229,255,0)'},{boxShadow:'0 0 20px rgba(0,229,255,0.35)',duration:0.3,yoyo:true,repeat:1,ease:'power2.out'});
      }
    }
    cacheInvalidate('_inventory');
    renderInventory();
  }catch(err){
    window._dbg?.error('[EQUIP]',err);
    showEquipToast('❌ Erreur — réessaye',true);
    // Forcer re-render pour resynchroniser le DOM
    renderInventory();
  }
}

function formatEffects(effects){
  if(!effects)return'';
  return Object.entries(effects).slice(0,2).map(([s,v])=>`+${v}${SI[s]||s}`).join(' ');
}

function showEquipToast(msg,isError=false){
  let t=document.getElementById('equip-toast');
  if(!t){t=document.createElement('div');t.id='equip-toast';t.className='equip-toast';document.body.appendChild(t);}
  t.textContent=msg;
  t.className='equip-toast show'+(isError?' error':'');
  clearTimeout(t._t);t._t=setTimeout(()=>{t.className='equip-toast';},2500);
}

// ── SUPPRESSION ITEM ──
let _deleteTarget=null; // { itemId, maxQty }

function openDeleteModal(itemId,event){
  if(event){event.stopPropagation();}
  const items=INV_DATA.items||{};
  const qty=items[itemId]||0;
  if(qty<=0){showEquipToast('❌ Cet item n\'est pas dans l\'inventaire',true);return;}
  const it=ALL_ITEMS_DATA[itemId]||{};
  const rarity=(it.rarity||'common').toLowerCase();
  const rc=RARITY_COLORS[rarity]||'#6b7280';
  _deleteTarget={itemId,maxQty:qty};
  // Populer le modal
  const emojiEl=document.getElementById('inv-del-emoji');
  const nameEl=document.getElementById('inv-del-name');
  const metaEl=document.getElementById('inv-del-meta');
  if(emojiEl)emojiEl.textContent=it.emoji||'📦';
  if(nameEl){nameEl.textContent=it.name||itemId;nameEl.style.color=rc;}
  if(metaEl)metaEl.textContent=`${rarity.toUpperCase()} · En inventaire : ×${qty}`;
  // Quantité
  const qtyInput=document.getElementById('inv-del-qty');
  const qtyWrap=document.getElementById('inv-del-qty-wrap');
  if(qtyInput){qtyInput.min=1;qtyInput.max=qty;qtyInput.value=1;}
  if(qtyWrap)qtyWrap.classList.toggle('visible',qty>1);
  // Ouvrir
  const overlay=document.getElementById('inv-delete-overlay');
  if(overlay)overlay.classList.add('open');
}

function closeDeleteModal(){
  const overlay=document.getElementById('inv-delete-overlay');
  if(overlay)overlay.classList.remove('open');
  _deleteTarget=null;
}

function adjustDeleteQty(delta){
  if(!_deleteTarget)return;
  const input=document.getElementById('inv-del-qty');
  if(!input)return;
  const newVal=Math.max(1,Math.min(_deleteTarget.maxQty,parseInt(input.value||1)+delta));
  input.value=newVal;
}

function clampDeleteQty(){
  if(!_deleteTarget)return;
  const input=document.getElementById('inv-del-qty');
  if(!input)return;
  let v=parseInt(input.value)||1;
  if(v<1)v=1;
  if(v>_deleteTarget.maxQty)v=_deleteTarget.maxQty;
  input.value=v;
}

async function confirmDelete(){
  if(!_deleteTarget||!UID||!CHAR_ID)return;
  const{itemId,maxQty}=_deleteTarget;
  const qtyInput=document.getElementById('inv-del-qty');
  const qtyToDelete=Math.max(1,Math.min(maxQty,parseInt((qtyInput&&qtyInput.value)||1)));
  closeDeleteModal();
  const it=ALL_ITEMS_DATA[itemId]||{};
  try{
    const newItems={...(INV_DATA.items||{})};
    const current=newItems[itemId]||0;
    const remaining=Math.max(0,current-qtyToDelete);
    if(remaining<=0){delete newItems[itemId];}
    else{newItems[itemId]=remaining;}
    const key=(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
    await db.collection(C.INV).doc(key).update({items:newItems});
    INV_DATA.items=newItems;
    showEquipToast(`✓ ×${qtyToDelete} ${it.name||itemId} supprimé${qtyToDelete>1?'s':''}`);
    if(_invDetailOpen===itemId)closeItemDetail();
    cacheInvalidate('_inventory');
    renderInventory();
  }catch(err){
    window._dbg?.error('[DELETE]',err);
    showEquipToast('❌ Erreur lors de la suppression',true);
  }
}

