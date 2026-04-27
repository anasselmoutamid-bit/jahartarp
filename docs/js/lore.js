
/* ═══ ADMIN TOAST ═══ */
function showLoreToast(msg,type){
  var t=document.getElementById('admin-toast');if(!t)return;
  t.textContent=msg;t.className='admin-toast '+(type||'');
  void t.offsetWidth;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show')},2600);
}

/* ═══ ESCAPE HTML ═══ */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

/* ═══ DISCORD-STYLE MARKDOWN PARSER ═══ */
function parseDiscordMd(text, accentColor){
  if(!text) return '';
  var s = esc(text);
  /* Code blocks ``` */
  s = s.replace(/```([^`]*?)```/gs, function(m,c){ return '<pre><code>'+c+'</code></pre>'; });
  /* Inline code */
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  /* Spoiler ||text|| */
  s = s.replace(/\|\|([^|]+)\|\|/g, '<span class="cm-md-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
  /* Headers # ## ### — must be at line start */
  s = s.replace(/^### (.+)$/gm, '<div class="cm-md-h cm-md-h3">$1</div>');
  s = s.replace(/^## (.+)$/gm, '<div class="cm-md-h cm-md-h2">$1</div>');
  s = s.replace(/^# (.+)$/gm, '<div class="cm-md-h cm-md-h1">$1</div>');
  /* Bold + italic ***text*** */
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  /* Bold **text** */
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  /* Italic *text* */
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  /* Underline __text__ */
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  /* Strikethrough ~~text~~ */
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  /* Blockquote > at start */
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  /* Unordered list - item */
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  s = s.replace(/<\/ul>\s*<ul>/g, '');
  /* Line breaks — preserve newlines */
  s = s.replace(/\n/g, '<br>');
  /* Clean up double <br> after block elements */
  s = s.replace(/(<\/div>)<br>/g, '$1');
  s = s.replace(/(<\/pre>)<br>/g, '$1');
  s = s.replace(/(<\/blockquote>)<br>/g, '$1');
  s = s.replace(/(<\/ul>)<br>/g, '$1');
  return '<div class="cm-md" style="--mc:'+(accentColor||'var(--violet)')+'">'+s+'</div>';
}

/* ═══ REPEATER BUILDER HELPERS ═══ */
var _repCounter = 0;

/* Key-Value repeater (for stats: {clé: valeur, ...}) */
function buildKVRepeater(fieldKey, label, data){
  var items = [];
  if(data && typeof data === 'object' && !Array.isArray(data)){
    var keys = Object.keys(data);
    keys.forEach(function(k){ items.push({k:k, v:String(data[k])}); });
  }
  var id = 'rep-'+fieldKey;
  var html = '<div class="cm-edit-row"><label class="cm-edit-label">'+label+'</label>';
  html += '<div class="cm-repeater" id="'+id+'">';
  items.forEach(function(item){ html += kvRowHtml(fieldKey, item.k, item.v); });
  html += '</div>';
  html += '<button type="button" class="cm-rep-add" onclick="addKVRow(\''+fieldKey+'\')">Ajouter</button></div>';
  return html;
}
function kvRowHtml(fieldKey, k, v){
  var rid = 'rep-'+fieldKey+'-'+(++_repCounter);
  return '<div class="cm-repeater-item" data-rep="'+fieldKey+'"><div class="cm-rep-field"><label>Nom</label><input type="text" value="'+esc(k||'')+'" data-rk="key"></div><div class="cm-rep-field"><label>Valeur</label><input type="text" value="'+esc(v||'')+'" data-rk="val"></div><button type="button" class="cm-rep-remove" onclick="this.parentElement.remove()" title="Supprimer">✕</button></div>';
}
window.addKVRow = function(fieldKey){
  var c = document.getElementById('rep-'+fieldKey);
  if(c) c.insertAdjacentHTML('beforeend', kvRowHtml(fieldKey,'',''));
};
function collectKV(fieldKey){
  var obj = {};
  document.querySelectorAll('.cm-repeater-item[data-rep="'+fieldKey+'"]').forEach(function(row){
    var k = row.querySelector('[data-rk="key"]').value.trim();
    var v = row.querySelector('[data-rk="val"]').value.trim();
    if(k) obj[k] = isNaN(v) ? v : Number(v);
  });
  return Object.keys(obj).length ? obj : null;
}

/* Simple object-list repeater (for villes: [{name,desc},...]) */
function buildObjListRepeater(fieldKey, label, fields, data){
  var items = Array.isArray(data) ? data : [];
  var id = 'rep-'+fieldKey;
  var html = '<div class="cm-edit-row"><label class="cm-edit-label">'+label+'</label>';
  html += '<div class="cm-repeater" id="'+id+'">';
  items.forEach(function(item){ html += objRowHtml(fieldKey, fields, item); });
  html += '</div>';
  html += '<button type="button" class="cm-rep-add" onclick="addObjRow(\''+fieldKey+'\',\''+esc(JSON.stringify(fields))+'\')">Ajouter</button></div>';
  return html;
}
function objRowHtml(fieldKey, fields, data){
  var rid = 'rep-'+fieldKey+'-'+(++_repCounter);
  var html = '<div class="cm-repeater-item" data-rep="'+fieldKey+'">';
  fields.forEach(function(f){
    var val = data ? (data[f.key]||'') : '';
    if(f.type === 'textarea'){
      html += '<div class="cm-rep-field"><label>'+f.label+'</label><textarea data-rk="'+f.key+'" rows="'+(f.rows||2)+'" placeholder="'+(f.placeholder||'')+'">'+esc(val)+'</textarea></div>';
    } else {
      html += '<div class="cm-rep-field"><label>'+f.label+'</label><input type="text" value="'+esc(val)+'" data-rk="'+f.key+'" placeholder="'+(f.placeholder||'')+'"></div>';
    }
  });
  html += '<button type="button" class="cm-rep-remove" onclick="this.parentElement.remove()" title="Supprimer">✕</button></div>';
  return html;
}
window.addObjRow = function(fieldKey, fieldsJson){
  var fields = JSON.parse(fieldsJson.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
  var c = document.getElementById('rep-'+fieldKey);
  if(c) c.insertAdjacentHTML('beforeend', objRowHtml(fieldKey, fields, null));
};
function collectObjList(fieldKey, fields){
  var arr = [];
  document.querySelectorAll('.cm-repeater-item[data-rep="'+fieldKey+'"]').forEach(function(row){
    var obj = {};
    fields.forEach(function(f){ obj[f.key] = row.querySelector('[data-rk="'+f.key+'"]').value.trim(); });
    if(Object.values(obj).some(function(v){return v})) arr.push(obj);
  });
  return arr;
}

/* Grouped repeater (for dynasties: [{gen:'...', members:[{name,title,desc},...]},...]) */
function buildGroupRepeater(fieldKey, label, groupLabel, memberFields, data){
  var groups = Array.isArray(data) ? data : [];
  var id = 'repg-'+fieldKey;
  var html = '<div class="cm-edit-row"><label class="cm-edit-label">'+label+'</label>';
  html += '<div id="'+id+'">';
  groups.forEach(function(g){ html += groupHtml(fieldKey, groupLabel, memberFields, g); });
  html += '</div>';
  html += '<button type="button" class="cm-rep-add" onclick="addGroup(\''+fieldKey+'\',\''+esc(groupLabel)+'\',\''+esc(JSON.stringify(memberFields))+'\')">Ajouter une section</button></div>';
  return html;
}
function groupHtml(fieldKey, groupLabel, memberFields, data){
  var gid = 'grp-'+(++_repCounter);
  var html = '<div class="cm-rep-group" data-repg="'+fieldKey+'" id="'+gid+'">';
  html += '<div class="cm-rep-group-header"><div class="cm-rep-field"><label>'+groupLabel+'</label><input type="text" value="'+esc(data?data.gen||'':'')+'" data-rk="gen"></div><button type="button" class="cm-rep-group-remove" onclick="this.closest(\'.cm-rep-group\').remove()" title="Supprimer section">✕</button></div>';
  html += '<div class="cm-repeater" data-repgm="'+gid+'">';
  if(data && data.members){
    data.members.forEach(function(m){ html += objRowHtml(gid+'-m', memberFields, m); });
  }
  html += '</div>';
  html += '<button type="button" class="cm-rep-add" onclick="addGroupMember(\''+gid+'\',\''+esc(JSON.stringify(memberFields))+'\')">Ajouter un membre</button>';
  html += '</div>';
  return html;
}
window.addGroup = function(fieldKey, groupLabel, memberFieldsJson){
  var mf = JSON.parse(memberFieldsJson.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
  var c = document.getElementById('repg-'+fieldKey);
  if(c) c.insertAdjacentHTML('beforeend', groupHtml(fieldKey, groupLabel, mf, null));
};
window.addGroupMember = function(gid, memberFieldsJson){
  var mf = JSON.parse(memberFieldsJson.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
  var c = document.querySelector('[data-repgm="'+gid+'"]');
  if(c) c.insertAdjacentHTML('beforeend', objRowHtml(gid+'-m', mf, null));
};
function collectGroupRepeater(fieldKey, memberFields){
  var arr = [];
  document.querySelectorAll('.cm-rep-group[data-repg="'+fieldKey+'"]').forEach(function(grp){
    var gen = grp.querySelector('[data-rk="gen"]').value.trim();
    var repContainer = grp.querySelector('.cm-repeater');
    var members = [];
    repContainer.querySelectorAll('.cm-repeater-item').forEach(function(row){
      var obj = {};
      memberFields.forEach(function(f){ var el=row.querySelector('[data-rk="'+f.key+'"]'); if(el) obj[f.key]=el.value.trim(); });
      if(Object.values(obj).some(function(v){return v})) members.push(obj);
    });
    if(gen || members.length) arr.push({gen:gen, members:members});
  });
  return arr;
}

/* ═══ FORM FIELD SCHEMAS — par catégorie ═══ */
/* Types: text, textarea, color, number, repeater_kv, repeater_obj, repeater_group */
var LORE_FIELDS={
  empires:[
    {key:'name',label:'Nom *',type:'text',required:true},
    {key:'sub',label:'Sous-titre',type:'text'},
    {key:'ico',label:'Icône',type:'text',placeholder:'🏰',half:true},
    {key:'color',label:'Couleur',type:'color',def:'#FF4757',half:true},
    {key:'imageUrl',label:'Image (URL)',type:'text',placeholder:'https://...'},
    {key:'desc',label:'Description courte *',type:'textarea',required:true},
    {key:'full',label:'Description complète',type:'textarea',rows:4},
    {key:'tags',label:'Tags (virgules)',type:'text',isArray:true},
    {key:'status',label:'Statut',type:'text'},
    {key:'lois',label:'Lois',type:'textarea',rows:3},
    {key:'hierarch',label:'Hiérarchie',type:'textarea',rows:3},
    {key:'stats',label:'Statistiques',type:'repeater_kv'},
    {key:'villes',label:'Villes',type:'repeater_obj',fields:[
      {key:'name',label:'Nom de la ville'},
      {key:'imageUrl',label:'Image (URL)',placeholder:'https://...'},
      {key:'desc',label:'Description courte'},
      {key:'full',label:'Description complète',type:'textarea',rows:3}
    ]}
  ],
  organisations:[
    {key:'name',label:'Nom *',type:'text',required:true},
    {key:'sub',label:'Sous-titre',type:'text'},
    {key:'ico',label:'Icône',type:'text',placeholder:'⚔️',half:true},
    {key:'color',label:'Couleur',type:'color',def:'#4DA3FF',half:true},
    {key:'imageUrl',label:'Image (URL)',type:'text',placeholder:'https://...'},
    {key:'desc',label:'Description courte *',type:'textarea',required:true},
    {key:'full',label:'Description complète',type:'textarea',rows:4},
    {key:'tags',label:'Tags',type:'text',isArray:true},
    {key:'status',label:'Statut',type:'text'},
    {key:'lois',label:'Lois',type:'textarea',rows:3},
    {key:'hierarch',label:'Hiérarchie',type:'textarea',rows:3},
    {key:'etendue',label:'Étendue',type:'textarea',rows:3},
    {key:'membres',label:'Membres',type:'textarea',rows:3}
  ],
  dynasties:[
    {key:'name',label:'Nom *',type:'text',required:true},
    {key:'sub',label:'Sous-titre',type:'text'},
    {key:'ico',label:'Icône',type:'text',placeholder:'👑',half:true},
    {key:'color',label:'Couleur',type:'color',def:'#ffd60a',half:true},
    {key:'imageUrl',label:'Image (URL)',type:'text',placeholder:'https://...'},
    {key:'empire',label:'Empire',type:'text'},
    {key:'members',label:'Générations & Membres',type:'repeater_group',groupLabel:'Nom de la génération',memberFields:[
      {key:'name',label:'Nom'},
      {key:'title',label:'Titre'},
      {key:'imageUrl',label:'Image (URL)',placeholder:'https://...'},
      {key:'desc',label:'Description',type:'textarea',rows:2}
    ]}
  ],
  histoire:[
    {key:'name',label:'Nom *',type:'text',required:true},
    {key:'sub',label:'Sous-titre',type:'text'},
    {key:'ico',label:'Icône',type:'text',placeholder:'📜',half:true},
    {key:'color',label:'Couleur',type:'color',def:'#44ff88',half:true},
    {key:'imageUrl',label:'Image (URL)',type:'text',placeholder:'https://...'},
    {key:'desc',label:'Description courte *',type:'textarea',required:true},
    {key:'full',label:'Description complète',type:'textarea',rows:4},
    {key:'tags',label:'Tags',type:'text',isArray:true},
    {key:'status',label:'Statut',type:'text'}
  ],
  pantheon:[
    {key:'name',label:'Nom *',type:'text',required:true},
    {key:'domain',label:'Domaine',type:'text'},
    {key:'ico',label:'Icône',type:'text',placeholder:'✨',half:true},
    {key:'color',label:'Couleur',type:'color',def:'#8B5CF6',half:true},
    {key:'imageUrl',label:'Image (URL)',type:'text',placeholder:'https://...'},
    {key:'desc',label:'Description *',type:'textarea',required:true,rows:4},
    {key:'details',label:'Sections détaillées',type:'repeater_kv_textarea'}
  ],
  chronologie:[
    {key:'title',label:'Titre *',type:'text',required:true},
    {key:'era',label:'Tag ère',type:'text'},
    {key:'color',label:'Couleur',type:'color',def:'#00e5cc',half:true},
    {key:'order',label:'Ordre',type:'number',def:0,half:true},
    {key:'desc',label:'Description *',type:'textarea',required:true,rows:4},
    {key:'events',label:'Événements (1/ligne)',type:'textarea',rows:4,isLines:true}
  ],
  glossaire:[
    {key:'term',label:'Terme *',type:'text',required:true},
    {key:'def',label:'Définition *',type:'textarea',required:true,rows:4},
    {key:'cat',label:'Catégorie',type:'text',def:'Général'}
  ]
};

/* ═══ BUILD FORM HTML ═══ */
function buildFormHtml(cat,data){
  var fields=LORE_FIELDS[cat];if(!fields)return '';
  var html='<div class="cm-edit-form">';
  fields.forEach(function(f){
    var val='';
    if(data){
      val=data[f.key];
      if(f.isArray&&Array.isArray(val))val=val.join(', ');
      else if(f.isLines&&Array.isArray(val))val=val.join('\n');
      else if(val==null)val='';
    }else{
      val=f.def||'';
    }

    /* Repeater types — no wrapping div needed, they build their own */
    if(f.type==='repeater_kv'){
      html+=buildKVRepeater(f.key, f.label, data?data[f.key]:null);
      return;
    }
    if(f.type==='repeater_kv_textarea'){
      html+=buildKVTextareaRepeater(f.key, f.label, data?data[f.key]:null);
      return;
    }
    if(f.type==='repeater_obj'){
      html+=buildObjListRepeater(f.key, f.label, f.fields, data?data[f.key]:null);
      return;
    }
    if(f.type==='repeater_group'){
      html+=buildGroupRepeater(f.key, f.label, f.groupLabel, f.memberFields, data?data[f.key]:null);
      return;
    }

    var cls='cm-edit-row'+(f.half?' half':'');
    html+='<div class="'+cls+'">';
    html+='<label class="cm-edit-label">'+f.label+'</label>';
    if(f.type==='textarea'){
      html+='<textarea class="cm-edit-textarea" id="lf-'+f.key+'" rows="'+(f.rows||2)+'" placeholder="'+(f.placeholder||'Supporte le **markdown** Discord')+'">'+esc(val)+'</textarea>';
    }else if(f.type==='color'){
      html+='<input class="cm-edit-input" type="color" id="lf-'+f.key+'" value="'+(val||f.def||'#8B5CF6')+'">';
    }else if(f.type==='number'){
      html+='<input class="cm-edit-input" type="number" id="lf-'+f.key+'" value="'+(val||0)+'">';
    }else{
      html+='<input class="cm-edit-input" type="text" id="lf-'+f.key+'" value="'+esc(val)+'" placeholder="'+(f.placeholder||'')+'">';
    }
    html+='</div>';
  });
  html+='</div>';
  return html;
}

/* KV Textarea repeater (for pantheon details — key + long textarea body) */
function buildKVTextareaRepeater(fieldKey, label, data){
  var items = [];
  if(data && typeof data === 'object' && !Array.isArray(data)){
    var keys = Object.keys(data);
    keys.forEach(function(k){ items.push({k:k, v:String(data[k])}); });
  }
  var id = 'rep-'+fieldKey;
  var html = '<div class="cm-edit-row"><label class="cm-edit-label">'+label+'</label>';
  html += '<div class="cm-repeater" id="'+id+'">';
  items.forEach(function(item){ html += kvTextareaRowHtml(fieldKey, item.k, item.v); });
  html += '</div>';
  html += '<button type="button" class="cm-rep-add" onclick="addKVTextareaRow(\''+fieldKey+'\')">Ajouter une section</button></div>';
  return html;
}
function kvTextareaRowHtml(fieldKey, k, v){
  _repCounter++;
  return '<div class="cm-repeater-item" data-rep="'+fieldKey+'" style="flex-direction:column;align-items:stretch"><div style="display:flex;gap:8px;align-items:flex-end"><div class="cm-rep-field"><label>Titre de section</label><input type="text" value="'+esc(k||'')+'" data-rk="key"></div><button type="button" class="cm-rep-remove" onclick="this.closest(\'.cm-repeater-item\').remove()" title="Supprimer" style="margin-top:0">✕</button></div><div class="cm-rep-field"><label>Contenu</label><textarea data-rk="val" rows="3" placeholder="Supporte le **markdown** Discord">'+esc(v||'')+'</textarea></div></div>';
}
window.addKVTextareaRow = function(fieldKey){
  var c = document.getElementById('rep-'+fieldKey);
  if(c) c.insertAdjacentHTML('beforeend', kvTextareaRowHtml(fieldKey,'',''));
};
function collectKVTextarea(fieldKey){
  var obj = {};
  document.querySelectorAll('.cm-repeater-item[data-rep="'+fieldKey+'"]').forEach(function(row){
    var k = row.querySelector('[data-rk="key"]').value.trim();
    var v = row.querySelector('[data-rk="val"]').value;
    if(k) obj[k] = v;
  });
  return Object.keys(obj).length ? obj : null;
}

/* ═══ COLLECT FORM DATA ═══ */
function collectFormData(cat){
  var fields=LORE_FIELDS[cat];if(!fields)return null;
  var data={};var valid=true;
  fields.forEach(function(f){
    /* Repeater types */
    if(f.type==='repeater_kv'){
      data[f.key]=collectKV(f.key);
      return;
    }
    if(f.type==='repeater_kv_textarea'){
      data[f.key]=collectKVTextarea(f.key);
      return;
    }
    if(f.type==='repeater_obj'){
      data[f.key]=collectObjList(f.key, f.fields);
      return;
    }
    if(f.type==='repeater_group'){
      data[f.key]=collectGroupRepeater(f.key, f.memberFields);
      return;
    }

    var el=document.getElementById('lf-'+f.key);if(!el)return;
    var v=el.value;
    /* For textareas, preserve the raw value including whitespace/newlines */
    var trimmed = v.trim();
    if(f.required&&!trimmed){valid=false;el.style.borderColor='var(--red)';return;}
    el.style.borderColor='';
    if(f.isArray){data[f.key]=trimmed?trimmed.split(',').map(function(s){return s.trim()}).filter(Boolean):[];}
    else if(f.isLines){data[f.key]=v?v.split('\n').map(function(s){return s.trim()}).filter(Boolean):[];}
    else if(f.type==='number'){data[f.key]=parseInt(trimmed)||0;}
    else if(f.type==='textarea'){data[f.key]=v;}  /* preserve spaces & newlines */
    else{data[f.key]=trimmed;}
  });
  if(!valid)return null;
  data.category=cat;
  return data;
}

/* ═══ OPEN EDIT LORE ═══ */
window.openEditLore=function(cat,id){
  var items=DATA[cat];if(!items)return;
  var item=items.find(function(x){return x.id===id});if(!item)return;
  var catLabels={empires:'Empire',organisations:'Organisation',dynasties:'Dynastie',histoire:'Événement',pantheon:'Primordial',chronologie:'Ère',glossaire:'Terme'};
  var html='<h2 class="cm-h2">✎ Modifier : '+esc(item.name||item.title||item.term||'?')+'</h2>';
  html+=buildFormHtml(cat,item);
  html+='<div class="cm-edit-actions"><button class="cm-cancel-btn" onclick="closePopup()">Annuler</button><button class="cm-save-btn" id="btn-save-edit" onclick="saveLoreEdit(\''+cat+'\',\''+id+'\')">Sauvegarder</button></div>';
  openPopup(html,'',item.color||'var(--violet)');
};

/* ═══ SAVE EDIT ═══ */
window.saveLoreEdit=async function(cat,id){
  var btn=document.getElementById('btn-save-edit');if(btn){btn.disabled=true;btn.textContent='Sauvegarde...';}
  var data=collectFormData(cat);
  if(!data){if(btn){btn.disabled=false;btn.textContent='Sauvegarder';}showLoreToast('Champs requis manquants ou JSON invalide','error');return;}
  delete data.category; /* ne pas écraser la catégorie */
  var ok=await window._loreUpdateDoc(id,data);
  if(ok){showLoreToast('Modifié avec succès','success');closePopup();}
  else{showLoreToast('Erreur lors de la sauvegarde','error');if(btn){btn.disabled=false;btn.textContent='Sauvegarder';}}
};

/* ═══ OPEN CREATE LORE ═══ */
window.openCreateLore=function(cat){
  var catLabels={empires:'un Empire',organisations:'une Organisation',dynasties:'une Dynastie',histoire:'un Événement',pantheon:'un Primordial',chronologie:'une Ère',glossaire:'un Terme'};
  var catColors={empires:'#FF4757',organisations:'#4DA3FF',dynasties:'#ffd60a',histoire:'#44ff88',pantheon:'#8B5CF6',chronologie:'#00e5cc',glossaire:'#ff6b9d'};
  var html='<h2 class="cm-h2">+ Créer '+esc(catLabels[cat]||cat)+'</h2>';
  html+=buildFormHtml(cat,null);
  html+='<div class="cm-edit-actions"><button class="cm-cancel-btn" onclick="closePopup()">Annuler</button><button class="cm-save-btn" id="btn-save-create" onclick="saveLoreCreate(\''+cat+'\')">Créer</button></div>';
  openPopup(html,'',catColors[cat]||'var(--violet)');
};

/* ═══ SAVE CREATE ═══ */
window.saveLoreCreate=async function(cat){
  var btn=document.getElementById('btn-save-create');if(btn){btn.disabled=true;btn.textContent='Création...';}
  var data=collectFormData(cat);
  if(!data){if(btn){btn.disabled=false;btn.textContent='Créer';}showLoreToast('Champs requis manquants ou JSON invalide','error');return;}
  var id=await window._loreAddDoc(data);
  if(id){showLoreToast('Créé avec succès !','success');closePopup();}
  else{showLoreToast('Erreur lors de la création','error');if(btn){btn.disabled=false;btn.textContent='Créer';}}
};

/* ═══ DELETE LORE ═══ */
window.deleteLoreItem=function(cat,id,name){
  showConfirm('Supprimer définitivement « '+(name||'?')+' » ?',async function(){
    var ok=await window._loreDeleteDoc(id);
    if(ok){showLoreToast('Supprimé','error');}
    else{showLoreToast('Erreur lors de la suppression','error');}
  });
};

/* ═══ ADMIN BUTTONS HTML HELPER ═══ */
function adminBtns(cat,id,name){
  if(!window._isAdmin)return '';
  return '<div class="lore-card-admin-actions"><button class="lore-admin-btn" title="Modifier" onclick="event.stopPropagation();openEditLore(\''+cat+'\',\''+esc(id)+'\')">✎</button><button class="lore-admin-btn delete" title="Supprimer" onclick="event.stopPropagation();deleteLoreItem(\''+cat+'\',\''+esc(id)+'\',\''+esc(name)+'\')">✕</button></div>';
}

/* ═══ RENDER ═══ */
function makeCard(d,type){
  var catMap={empire:'empires',org:'organisations',dynastie:'dynasties',dynasty:'dynasties',histoire:'histoire'};
  var cat=catMap[type]||type;
  var nm=d.name||d.title||d.term||'?';
  var tagsHtml=d.tags&&d.tags.length?'<div class="lc-tags">'+d.tags.map(function(t){return '<span class="lc-tag">'+esc(t)+'</span>'}).join('')+'</div>':'';
  var imgHtml=d.imageUrl?'<div class="lc-img" style="background-image:url(\''+esc(d.imageUrl)+'\')"><div class="lc-img-ov" style="background:linear-gradient(180deg,transparent 30%,rgba(6,10,24,0.95) 100%)"></div></div>':'';
  var logoHtml=d.imageUrl?'':'<div class="lc-logo"><div class="lc-ico-wrap">'+d.ico+'</div><span class="lc-trail"></span></div>';
  return '<div class="lore-card rv'+(d.imageUrl?' has-img':'')+'" style="--lc:'+esc(d.color)+'" data-type="'+esc(type)+'" data-id="'+esc(d.id)+'">'+adminBtns(cat,d.id,nm)+'<div class="lc-border"></div>'+imgHtml+'<div class="lc-content">'+logoHtml+'<div class="lc-title">'+esc(nm)+'</div><div class="lc-subtitle">'+esc(d.sub||'')+'</div><p class="lc-desc">'+esc(d.desc||'')+'</p>'+tagsHtml+'<div class="lc-footer"><span class="lc-status"><span class="lc-dot" style="background:'+esc(d.color)+';box-shadow:0 0 6px '+esc(d.color)+'"></span>'+esc(d.status||'')+'</span><span class="lc-arrow">&rarr;</span></div></div></div>';
}
function renderGrid(id,items,type){var g=document.getElementById(id);if(!g)return;g.innerHTML=items.map(function(d){return makeCard(d,type)}).join('');revealCards(g)}
function revealCards(c){var cards=c.querySelectorAll('.rv,.chrono-era,.pth-flip');cards.forEach(function(el,i){el.classList.remove('visible');el.style.animationDelay=(.05+i*.1)+'s';setTimeout(function(){el.classList.add('visible')},80+i*100)})}

/* ═══ POPUP ═══ */
var overlay=document.getElementById('cyber-overlay');
var modal=document.getElementById('cyber-modal');
var cmContent=document.getElementById('cm-content');
var cmActions=document.getElementById('cm-actions');

function openPopup(html,actionsHtml,color){
  modal.style.setProperty('--mc',color||'var(--violet)');
  cmContent.innerHTML=html;
  cmActions.innerHTML=actionsHtml||'<button class="cm-btn" onclick="closePopup()"><span class="cm-btn-bg"></span><kbd>esc</kbd><span>Fermer</span></button>';
  overlay.classList.add('open');
  document.body.style.overflow='hidden';
}
function closePopup(){
  overlay.classList.remove('open');
  overlay.classList.add('closing');
  document.body.style.overflow='';
  setTimeout(function(){ overlay.classList.remove('closing'); }, 500);
}
overlay.addEventListener('click',function(e){if(e.target===overlay)closePopup()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay.classList.contains('open'))closePopup()});

/* ═══ EMPIRE POPUP + CITIES DRILL-DOWN ═══ */
function openEmpire(id){
  var e=DATA.empires.find(function(x){return x.id===id});if(!e)return;
  var stats='';if(e.stats){var k=Object.keys(e.stats);stats='<div class="cm-stat-row">'+k.map(function(s){return '<div class="cm-stat"><span class="cm-stat-val" style="color:'+e.color+'">'+e.stats[s]+'</span><span class="cm-stat-lbl">'+s+'</span></div>'}).join('')+'</div>'}
  var imgBanner=e.imageUrl?'<div style="margin:-32px -32px 20px;height:180px;background:url(\''+e.imageUrl+'\') center/cover;position:relative;border-radius:0"><div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(4,8,20,0.95) 100%)"></div></div>':'';
  var html=imgBanner+'<h2 class="cm-h2">'+e.name+'</h2>'+(e.tags?'<div class="cm-tags">'+e.tags.map(function(t){return '<span class="cm-tag">'+t+'</span>'}).join('')+'</div>':'')+stats+'<div class="cm-text">'+parseDiscordMd(e.full||e.desc,e.color)+'</div>';
  if(e.lois)html+='<h3 class="cm-h3">Lois</h3><div class="cm-text">'+parseDiscordMd(e.lois,e.color)+'</div>';
  if(e.hierarch)html+='<h3 class="cm-h3">Hi&eacute;rarchie</h3><div class="cm-text">'+parseDiscordMd(e.hierarch,e.color)+'</div>';
  var actions='<button class="cm-btn" onclick="closePopup()"><span class="cm-btn-bg"></span><kbd>esc</kbd><span>Retour</span></button>';
  if(e.villes&&e.villes.length)actions+='<button class="cm-btn" onclick="closePopup();showCities(\''+id+'\')"><span class="cm-btn-bg"></span><kbd>&rarr;</kbd><span>Voir villes</span></button>';
  if(window._isAdmin)actions+='<button class="cm-btn" onclick="closePopup();openEditLore(\'empires\',\''+id+'\')"><span class="cm-btn-bg"></span><kbd>✎</kbd><span>Modifier</span></button>';
  openPopup(html,actions,e.color);
}
function showCities(id){
  var e=DATA.empires.find(function(x){return x.id===id});if(!e||!e.villes)return;
  var grid=document.getElementById('empires-grid');var content=document.getElementById('empires-content');
  var existing=content.querySelector('.back-nav');if(existing)existing.remove();
  var bn=document.createElement('div');bn.className='back-nav';bn.textContent='Retour aux Empires';
  bn.onclick=function(){renderGrid('empires-grid',DATA.empires,'empire');this.remove()};
  content.insertBefore(bn,grid);
  /* Store ville data for click handler */
  window._cityData = e.villes;
  window._cityColor = e.color;
  window._cityEmpireId = id;
  grid.innerHTML=e.villes.map(function(v,i){
    var imgHtml=v.imageUrl?'<div class="lc-img" style="background-image:url(\''+v.imageUrl+'\')"><div class="lc-img-ov" style="background:linear-gradient(180deg,transparent 30%,rgba(6,10,24,0.95) 100%)"></div></div>':'';
    var logoHtml=v.imageUrl?'':'<div class="lc-logo"><div class="lc-ico-wrap">🏙️</div><span class="lc-trail"></span></div>';
    return '<div class="lore-card rv'+(v.imageUrl?' has-img':'')+'" style="--lc:'+e.color+'" data-type="city" data-city-idx="'+i+'"><div class="lc-border"></div>'+imgHtml+'<div class="lc-content">'+logoHtml+'<div class="lc-title">'+v.name+'</div><div class="lc-subtitle">'+e.name+'</div><p class="lc-desc">'+(v.desc||'')+'</p><div class="lc-footer"><span class="lc-status"><span class="lc-dot" style="background:'+e.color+';box-shadow:0 0 6px '+e.color+'"></span>Ville</span><span class="lc-arrow">&rarr;</span></div></div></div>';
  }).join('');revealCards(grid);
}

/* ═══ ORG POPUP ═══ */
function openOrg(id){
  var o=DATA.organisations.find(function(x){return x.id===id});if(!o)return;
  var imgBanner=o.imageUrl?'<div style="margin:-32px -32px 20px;height:180px;background:url(\''+o.imageUrl+'\') center/cover;position:relative"><div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(4,8,20,0.95) 100%)"></div></div>':'';
  var html=imgBanner+'<h2 class="cm-h2">'+o.name+'</h2>'+(o.tags?'<div class="cm-tags">'+o.tags.map(function(t){return '<span class="cm-tag">'+t+'</span>'}).join('')+'</div>':'')+'<div class="cm-text">'+parseDiscordMd(o.full||o.desc,o.color)+'</div>';
  if(o.lois)html+='<h3 class="cm-h3">Lois &amp; R&egrave;gles</h3><div class="cm-text">'+parseDiscordMd(o.lois,o.color)+'</div>';
  if(o.hierarch)html+='<h3 class="cm-h3">Hi&eacute;rarchie</h3><div class="cm-text">'+parseDiscordMd(o.hierarch,o.color)+'</div>';
  if(o.etendue)html+='<h3 class="cm-h3">&Eacute;tendue</h3><div class="cm-text">'+parseDiscordMd(o.etendue,o.color)+'</div>';
  if(o.membres)html+='<h3 class="cm-h3">Membres</h3><div class="cm-text">'+parseDiscordMd(o.membres,o.color)+'</div>';
  var actions='<button class="cm-btn" onclick="closePopup()"><span class="cm-btn-bg"></span><kbd>esc</kbd><span>Fermer</span></button>';
  if(window._isAdmin)actions+='<button class="cm-btn" onclick="closePopup();openEditLore(\'organisations\',\''+id+'\')"><span class="cm-btn-bg"></span><kbd>✎</kbd><span>Modifier</span></button>';
  openPopup(html,actions,o.color);
}

/* ═══ HISTOIRE POPUP ═══ */
function openHistoire(id){
  var h=DATA.histoire.find(function(x){return x.id===id});if(!h)return;
  var imgBanner=h.imageUrl?'<div style="margin:-32px -32px 20px;height:180px;background:url(\''+h.imageUrl+'\') center/cover;position:relative"><div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(4,8,20,0.95) 100%)"></div></div>':'';
  var html=imgBanner+'<h2 class="cm-h2">'+h.name+'</h2>'+(h.tags?'<div class="cm-tags">'+h.tags.map(function(t){return '<span class="cm-tag">'+t+'</span>'}).join('')+'</div>':'')+'<div class="cm-text">'+parseDiscordMd(h.full||h.desc,h.color)+'</div>';
  var actions='<button class="cm-btn" onclick="closePopup()"><span class="cm-btn-bg"></span><kbd>esc</kbd><span>Fermer</span></button>';
  if(window._isAdmin)actions+='<button class="cm-btn" onclick="closePopup();openEditLore(\'histoire\',\''+id+'\')"><span class="cm-btn-bg"></span><kbd>✎</kbd><span>Modifier</span></button>';
  openPopup(html,actions,h.color);
}

/* ═══ DYNASTIES ═══ */
function renderDynasties(){renderGrid('dynasties-grid',DATA.dynasties.map(function(d){return{id:d.id,name:d.name,sub:d.sub,ico:d.ico,color:d.color,imageUrl:d.imageUrl,desc:d.empire?'Empire: '+d.empire:'',tags:['Lign\u00e9e royale'],status:(d.members||[]).length+' g\u00e9n\u00e9rations',_cat:'dynasties'}}),'dynasty')}
function showDynastyMembers(id){
  var d=DATA.dynasties.find(function(x){return x.id===id});if(!d||!d.members)return;
  var grid=document.getElementById('dynasties-grid');var membersDiv=document.getElementById('dynasty-members');
  grid.style.display='none';membersDiv.style.display='block';
  var html='<div class="back-nav" onclick="hideDynastyMembers()">Retour aux Dynasties</div><div class="section-head"><span class="sh-num">\u25C6</span><h2 class="sh-title">'+esc(d.name)+'</h2><div class="sh-line"></div></div>';
  d.members.forEach(function(gen,gi){
    html+='<div class="dynasty-gen-sep" style="--lc:'+esc(d.color)+'"><span class="dynasty-gen-label">'+esc(gen.gen)+'</span></div>';
    if(gi>0)html+='<div class="dynasty-connector" style="background:linear-gradient(180deg,'+esc(d.color)+',transparent)"></div>';
    html+='<div class="lore-grid">';gen.members.forEach(function(m){
      html+=makeCard({id:m.name,name:m.name,sub:m.title,ico:d.ico,color:d.color,imageUrl:m.imageUrl,desc:m.desc,tags:[],status:'Membre'},'dynasty-member');
    });html+='</div>';
  });
  membersDiv.innerHTML=html;revealCards(membersDiv);
}
function hideDynastyMembers(){document.getElementById('dynasties-grid').style.display='';document.getElementById('dynasty-members').style.display='none';renderDynasties()}

/* ═══ PANTHEON FLIP — exact gacha pattern with facedown class ═══ */
function renderPantheon(){
  var g=document.getElementById('pantheon-grid');
  g.innerHTML=DATA.pantheon.map(function(p){
    var details='';if(p.details){var dk=Object.keys(p.details);details=dk.map(function(k){return '<div class="pth-detail-section"><div class="pth-detail-label" onclick="event.stopPropagation();this.classList.toggle(\'expanded\')">'+k.charAt(0).toUpperCase()+k.slice(1)+'</div><div class="pth-detail-content">'+parseDiscordMd(p.details[k],p.color)+'</div></div>'}).join('')}
    var adminHtml='';
    if(window._isAdmin){adminHtml='<div class="lore-card-admin-actions" style="position:absolute;top:8px;right:8px;z-index:10;display:flex;gap:6px;opacity:0;transition:opacity .3s"><button class="lore-admin-btn" title="Modifier" onclick="event.stopPropagation();openEditLore(\'pantheon\',\''+p.id+'\')">✎</button><button class="lore-admin-btn delete" title="Supprimer" onclick="event.stopPropagation();deleteLoreItem(\'pantheon\',\''+p.id+'\',\''+esc(p.name)+'\')">✕</button></div>';}
    var photoContent = p.imageUrl
      ? '<img src="'+p.imageUrl+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">'
      : '<span class="pth-photo-ico">'+p.ico+'</span>';
    return '<div class="pth-flip" style="--rc:'+p.color+';position:relative" onmouseenter="this.querySelector(\'.lore-card-admin-actions\')&&(this.querySelector(\'.lore-card-admin-actions\').style.opacity=1)" onmouseleave="this.querySelector(\'.lore-card-admin-actions\')&&(this.querySelector(\'.lore-card-admin-actions\').style.opacity=0)">'+adminHtml+'<div class="pth-inner" onclick="flipCard(this)"><div class="pth-face pth-front"><div class="pth-scanlines"></div><div class="pth-sweep"></div><div class="pth-photo">'+photoContent+'<div class="pth-photo-ov"></div></div><div class="pth-domain-badge"><span class="pth-domain-val">'+((p.domain||'').split(' ')[0]||'\u2726')+'</span><span class="pth-domain-lbl">Primordial</span></div><div class="pth-body"><div class="pth-fn">'+(p.domain||'')+'</div><div class="pth-ln">'+p.name+'</div><p class="pth-desc">'+p.desc+'</p><div class="pth-hint">// CLIQUER POUR D\u00c9TAILS</div></div></div><div class="pth-face pth-back"><div class="pth-back-title">'+p.name+'</div>'+details+'<div class="pth-back-flip" onclick="event.stopPropagation();flipCard(this.closest(\'.pth-inner\'))">// RETOURNER LA CARTE</div></div></div></div>';
  }).join('');
}
function flipCard(inner){
  var isFd=inner.classList.contains('facedown');
  inner.classList.remove('flipping-to-back','flipping-to-front');
  void inner.offsetWidth;
  if(isFd){inner.classList.remove('facedown');inner.classList.add('flipping-to-front')}
  else{inner.classList.add('facedown');inner.classList.add('flipping-to-back')}
}

/* ═══ CHRONOLOGIE ═══ */
function renderChronologie(){
  var t=document.getElementById('chrono-timeline');
  t.innerHTML=DATA.chronologie.map(function(c){
    var ab=window._isAdmin?'<div style="display:inline-flex;gap:6px;margin-left:12px;vertical-align:middle"><button class="lore-admin-btn" title="Modifier" onclick="event.stopPropagation();openEditLore(\'chronologie\',\''+c.id+'\')">✎</button><button class="lore-admin-btn delete" title="Supprimer" onclick="event.stopPropagation();deleteLoreItem(\'chronologie\',\''+c.id+'\',\''+esc(c.title)+'\')">✕</button></div>':'';
    return '<div class="chrono-era rv" style="--ec:'+c.color+'"><div class="chrono-era-tag">'+c.era+'</div><div class="chrono-era-title">'+c.title+ab+'</div><div class="chrono-era-desc">'+parseDiscordMd(c.desc,c.color)+'</div>'+(c.events?'<div class="chrono-events">'+c.events.map(function(e){return '<div class="chrono-event">'+parseDiscordMd(e,c.color)+'</div>'}).join('')+'</div>':'')+'</div>';
  }).join('');revealCards(t);
}

/* ═══ GLOSSAIRE ═══ */
function renderGlossaire(filter){
  var g=document.getElementById('glossary-grid');var items=DATA.glossaire;
  if(filter)items=items.filter(function(i){return i.term.toLowerCase().indexOf(filter)!==-1||i.def.toLowerCase().indexOf(filter)!==-1});
  g.innerHTML=items.map(function(i){
    var ab=window._isAdmin?'<div style="display:flex;gap:6px;margin-top:8px"><button class="lore-admin-btn" title="Modifier" onclick="event.stopPropagation();openEditLore(\'glossaire\',\''+i.id+'\')">✎</button><button class="lore-admin-btn delete" title="Supprimer" onclick="event.stopPropagation();deleteLoreItem(\'glossaire\',\''+i.id+'\',\''+esc(i.term)+'\')">✕</button></div>':'';
    return '<div class="glossary-item"><div class="glossary-term">'+i.term+'</div><div class="glossary-def">'+parseDiscordMd(i.def,'#ff6b9d')+'</div><div class="glossary-cat">'+i.cat+'</div>'+ab+'</div>';
  }).join('');
}

/* ═══ CLICK HANDLERS ═══ */
document.addEventListener('click',function(e){
  /* Ignorer les clics sur les boutons admin */
  if(e.target.closest('.lore-admin-btn')||e.target.closest('.lore-card-admin-actions'))return;
  var card=e.target.closest('.lore-card[data-type]');if(!card)return;
  e.preventDefault();var type=card.dataset.type,id=card.dataset.id;
  if(type==='empire')openEmpire(id);
  else if(type==='org')openOrg(id);
  else if(type==='histoire')openHistoire(id);
  else if(type==='dynasty')showDynastyMembers(id);
  else if(type==='city'){
    var idx=parseInt(card.dataset.cityIdx);
    var v=window._cityData&&window._cityData[idx];
    var col=window._cityColor||'var(--violet)';
    if(v){
      var cityHtml='<h2 class="cm-h2">'+v.name+'</h2><div class="cm-text">'+parseDiscordMd(v.full||v.desc||'',col)+'</div>';
      var cityActions='<button class="cm-btn" onclick="closePopup()"><span class="cm-btn-bg"></span><kbd>esc</kbd><span>Fermer</span></button>';
      if(window._isAdmin&&window._cityEmpireId)cityActions+='<button class="cm-btn" onclick="closePopup();openEditLore(\'empires\',\''+window._cityEmpireId+'\')"><span class="cm-btn-bg"></span><kbd>✎</kbd><span>Modifier l\'empire</span></button>';
      openPopup(cityHtml,cityActions,col);
    }
  }
  else if(type==='dynasty-member'){var m=card.querySelector('.lc-title');var d=card.querySelector('.lc-desc');var s=card.querySelector('.lc-subtitle');var col=card.style.getPropertyValue('--lc');if(m)openPopup('<h2 class="cm-h2">'+m.textContent+'</h2>'+(s?'<h3 class="cm-h3">'+s.textContent+'</h3>':'')+'<div class="cm-text">'+parseDiscordMd(d?d.textContent:'',col)+'</div>',null,col)}
});

/* ═══ ADMIN VISIBILITY TOGGLE ═══ */
function toggleAdminUI(){
  var cats=['empires','organisations','dynasties','histoire','pantheon','chronologie','glossaire'];
  cats.forEach(function(c){
    var tb=document.getElementById('toolbar-'+c);
    if(tb)tb.classList.toggle('visible',!!window._isAdmin);
  });
}

/* Écouter l'event auth de auth-badge.js */
document.addEventListener('jaharta:auth',function(e){
  toggleAdminUI();
  /* Re-render pour injecter/retirer les boutons admin */
  if(typeof window._renderAllLore==='function')window._renderAllLore();
});

/* ═══ INIT ═══ */
renderGrid('empires-grid',DATA.empires,'empire');
renderGrid('orgs-grid',DATA.organisations,'org');
renderDynasties();
renderGrid('histoire-grid',DATA.histoire,'histoire');
renderPantheon();
renderChronologie();
renderGlossaire();
document.getElementById('glossary-input').addEventListener('input',function(){renderGlossaire(this.value.toLowerCase())});

window._renderAllLore=function(){
  renderGrid('empires-grid',DATA.empires,'empire');
  renderGrid('orgs-grid',DATA.organisations,'org');
  renderDynasties();
  renderGrid('histoire-grid',DATA.histoire,'histoire');
  renderPantheon();
  renderChronologie();
  renderGlossaire();
  toggleAdminUI();
};

/* ═══ SECTION SWITCHING ═══ */
(function(){
  var items=document.querySelectorAll('.sb-item[data-section]');
  var sections=document.querySelectorAll('.lore-section');
  var sidebar=document.getElementById('lore-sidebar');
  var sbOverlay=document.getElementById('sb-overlay');
  var toggle=document.getElementById('sb-toggle');
  function switchSection(target){
    items.forEach(function(it){it.classList.remove('active')});target.classList.add('active');
    sections.forEach(function(s){s.classList.remove('active')});
    var panel=document.getElementById('section-'+target.dataset.section);
    if(panel){panel.classList.add('active');revealCards(panel)}
    window.scrollTo({top:0,behavior:'smooth'});
    if(window.innerWidth<=768){sidebar.classList.remove('open');sbOverlay.classList.remove('open');toggle.classList.remove('open')}
    hideDynastyMembers();
  }
  items.forEach(function(item){item.addEventListener('click',function(e){e.preventDefault();switchSection(item)})});
  if(toggle)toggle.addEventListener('click',function(){sidebar.classList.toggle('open');sbOverlay.classList.toggle('open');toggle.classList.toggle('open')});
  if(sbOverlay)sbOverlay.addEventListener('click',function(){sidebar.classList.remove('open');sbOverlay.classList.remove('open');toggle.classList.remove('open')});
})();
window.addEventListener('scroll',function(){var h=document.documentElement.scrollHeight-window.innerHeight;document.getElementById('scroll-line').style.width=h>0?(window.scrollY/h*100)+'%':'0%'},{passive:true});
