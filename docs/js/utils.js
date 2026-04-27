/* ═══════════════════════════════════════════════════════════════════════
   docs/js/utils.js — Utilitaires partagés
   ═══════════════════════════════════════════════════════════════════════
   Inclure APRÈS constants.js, AVANT les scripts spécifiques à la page.
     <script src="js/constants.js"></script>
     <script src="js/utils.js"></script>

   CONTENU :
     1. sanitize()         → nettoie les entrées texte avant stockage
     2. compressImage()    → réduit/compresse une image avant upload Firebase
     3. AntiSpam           → limite les soumissions répétées (localStorage)
     4. Skeleton           → cartes fantômes pendant le chargement Firestore
     5. showToast()        → notification temporaire (globale)
   ═══════════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════════
   1. SANITISATION — supprime les balises HTML des entrées utilisateur
   ══════════════════════════════════════════════════════════════════════
   Protège contre les injections XSS dans les champs qui passent par
   innerHTML quelque part dans le code.

   Usage : const nom = sanitize(document.getElementById('f-fn').value);
   ══════════════════════════════════════════════════════════════════════ */
/* Échappe les caractères HTML pour insertion sécurisée dans innerHTML */
window.escHtml = function(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

window.sanitize = function(str) {
  if (typeof str !== 'string') return '';
  /* Utilise un élément temporaire pour laisser le DOM parser l'HTML
     puis récupère uniquement le texte brut */
  const tmp = document.createElement('div');
  tmp.textContent = str;
  return tmp.innerHTML
    .trim()
    .slice(0, 2000); /* limite hard à 2000 caractères */
};


/* ══════════════════════════════════════════════════════════════════════
   2. COMPRESSION D'IMAGE — réduit avant upload Firebase Storage
   ══════════════════════════════════════════════════════════════════════
   Réduit la photo à MAX_W x MAX_H max, encode en JPEG qualité 0.82.
   Résultat : Blob prêt à passer à uploadBytes().

   Usage :
     const blob = await compressImage(file);
     const snap = await uploadBytes(storageRef, blob);

   @param {File}   file     - Fichier image original
   @param {number} maxW     - Largeur max en px (défaut 1200)
   @param {number} maxH     - Hauteur max en px (défaut 1600)
   @param {number} quality  - Qualité JPEG 0–1 (défaut 0.82)
   @returns {Promise<Blob>}
   ══════════════════════════════════════════════════════════════════════ */
window.compressImage = function(file, maxW = 1200, maxH = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    /* Si pas une image ou déjà petite (<300KB), on ne compresse pas */
    if (!file.type.startsWith('image/') || file.size < 300 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture fichier échouée'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Décodage image échoué'));
      img.onload = () => {
        /* Calcul du ratio pour conserver les proportions */
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1); /* max 1 = jamais agrandir */
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob échoué')),
          'image/jpeg',
          quality
        );
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
};


/* ══════════════════════════════════════════════════════════════════════
   3. ANTI-SPAM — limite la fréquence de soumission de fiches
   ══════════════════════════════════════════════════════════════════════
   Stocke le timestamp de la dernière soumission dans localStorage.
   Bloque toute nouvelle tentative dans les COOLDOWN_MS millisecondes.

   Usage :
     if (!AntiSpam.canSubmit()) { showToast('Attendez...', 'error'); return; }
     // ... soumettre ...
     AntiSpam.markSubmitted();
   ══════════════════════════════════════════════════════════════════════ */
window.AntiSpam = (function() {
  const KEY         = 'jaharta_last_submit';
  const COOLDOWN_MS = 45 * 1000; /* 45 secondes entre deux soumissions */

  return {
    /** Retourne true si l'utilisateur peut soumettre */
    canSubmit() {
      const last = parseInt(localStorage.getItem(KEY) || '0', 10);
      return Date.now() - last > COOLDOWN_MS;
    },

    /** Retourne le temps restant en secondes (0 si pas en cooldown) */
    remainingSeconds() {
      const last    = parseInt(localStorage.getItem(KEY) || '0', 10);
      const elapsed = Date.now() - last;
      return elapsed > COOLDOWN_MS ? 0 : Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    },

    /** À appeler juste après une soumission réussie */
    markSubmitted() {
      localStorage.setItem(KEY, String(Date.now()));
    },

    /** Réinitialise le cooldown (usage admin / debug) */
    reset() {
      localStorage.removeItem(KEY);
    },
  };
})();


/* ══════════════════════════════════════════════════════════════════════
   4. SKELETON LOADING — cartes fantômes pendant le chargement Firestore
   ══════════════════════════════════════════════════════════════════════
   Affiche N cartes grises animées dans le conteneur pendant que
   onSnapshot n'a pas encore retourné de données.

   Les skeletons sont automatiquement retirés dès que des vraies cartes
   sont insérées dans le conteneur.

   Usage :
     Skeleton.show('cards-container', 6); // affiche 6 cartes skeleton
     // ... onSnapshot appelé ...
     Skeleton.hide('cards-container');    // retire les skeletons
   ══════════════════════════════════════════════════════════════════════ */
window.Skeleton = (function() {
  const CLASS = 'sk-card'; /* classe CSS des fausses cartes */

  /** Injecte le CSS des skeletons dans le <head> (une seule fois) */
  function injectCSS() {
    if (document.getElementById('sk-styles')) return;
    const style = document.createElement('style');
    style.id = 'sk-styles';
    style.textContent = `
      /* Animation shimmer (balayage lumineux) */
      @keyframes sk-shimmer {
        0%   { background-position: -400px 0 }
        100% { background-position:  400px 0 }
      }

      /* Carte skeleton — reproduit les dimensions d'une vraie .rp-card */
      .sk-card {
        background:  #080d1a;
        border:      1px solid rgba(0,245,255,0.08);
        clip-path:   polygon(22px 0%,100% 0%,100% calc(100% - 22px),
                             calc(100% - 22px) 100%,0% 100%,0% 22px);
        overflow:    hidden;
        display:     flex;
        flex-direction: column;
      }

      /* Zone photo skeleton */
      .sk-photo {
        width:  100%;
        height: 240px;
        background: linear-gradient(90deg,
          #0d1425 25%, #131b30 50%, #0d1425 75%);
        background-size: 400px 100%;
        animation: sk-shimmer 1.4s ease-in-out infinite;
      }

      /* Corps skeleton — barres de texte grises */
      .sk-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
      .sk-line {
        border-radius: 2px;
        background: linear-gradient(90deg,
          #0d1425 25%, #131b30 50%, #0d1425 75%);
        background-size: 400px 100%;
        animation: sk-shimmer 1.4s ease-in-out infinite;
      }
      /* Délais décalés pour que les lignes ne shimment pas en même temps */
      .sk-line:nth-child(1) { height: 9px;  width: 40%; animation-delay: 0s }
      .sk-line:nth-child(2) { height: 18px; width: 70%; animation-delay: .1s }
      .sk-line:nth-child(3) { height: 12px; width: 35%; animation-delay: .15s }
      .sk-line:nth-child(4) { height: 10px; width: 90%; animation-delay: .2s }
      .sk-line:nth-child(5) { height: 10px; width: 75%; animation-delay: .25s }
      .sk-line:nth-child(6) { height: 10px; width: 55%; animation-delay: .3s }
    `;
    document.head.appendChild(style);
  }

  /** Crée un élément skeleton card */
  function makeCard() {
    const card = document.createElement('div');
    card.className = CLASS;
    card.innerHTML = `
      <div class="sk-photo"></div>
      <div class="sk-body">
        <div class="sk-line"></div>
        <div class="sk-line"></div>
        <div class="sk-line"></div>
        <div class="sk-line"></div>
        <div class="sk-line"></div>
        <div class="sk-line"></div>
      </div>
    `;
    return card;
  }

  return {
    /** Affiche N skeleton cards dans le conteneur ciblé */
    show(containerId, count = 6) {
      injectCSS();
      const container = document.getElementById(containerId);
      if (!container) return;
      for (let i = 0; i < count; i++) {
        container.appendChild(makeCard());
      }
    },

    /** Retire tous les skeletons du conteneur */
    hide(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.querySelectorAll('.' + CLASS).forEach(el => el.remove());
    },
  };
})();


/* ══════════════════════════════════════════════════════════════════════
   5. TOAST — notification temporaire en bas de page (globale)
   ══════════════════════════════════════════════════════════════════════
   Nécessite un élément <div class="toast" id="toast"> dans le HTML.

   Usage :
     showToast('✓ Fiche soumise !');           // vert (succès)
     showToast('⚠ Erreur', 'error');           // rouge
     showToast('Info', 'info', 6000);          // 6 secondes
   ══════════════════════════════════════════════════════════════════════ */
window.showToast = function(msg, type = 'success', duration = 4000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.replace('show', 'jh-out');
    setTimeout(() => { t.className = 'toast'; }, 220);
  }, duration);
};


/* ══════════════════════════════════════════════════════════════════════
   6. DISCORD MARKDOWN PARSER — transforme la syntaxe Discord en HTML
   ══════════════════════════════════════════════════════════════════════
   Supporte: **gras**, *italique*, __souligné__, ~~barré~~, `code`,
   ```blocs```, > citations, ||spoiler||, # headers (néon),
   - listes, retours à la ligne.

   Usage : const html = parseDiscordMarkdown(text, '#ff0055');
   ══════════════════════════════════════════════════════════════════════ */
window.parseDiscordMarkdown = function(text, accentColor) {
  if (!text) return '';
  function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
  var s = escHtml(text);
  /* Code blocks ``` */
  s = s.replace(/```([^`]*?)```/gs, function(m,c){ return '<pre><code>'+c+'</code></pre>'; });
  /* Inline code */
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  /* Spoiler ||text|| */
  s = s.replace(/\|\|([^|]+)\|\|/g, '<span class="jmd-spoiler">$1</span>');
  /* Headers # ## ### — must be at line start */
  s = s.replace(/^### (.+)$/gm, '<div class="jmd-h jmd-h3">$1</div>');
  s = s.replace(/^## (.+)$/gm, '<div class="jmd-h jmd-h2">$1</div>');
  s = s.replace(/^# (.+)$/gm, '<div class="jmd-h jmd-h1">$1</div>');
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
  return '<div class="jmd" style="--jmd-accent:'+(accentColor||'#00f0ff')+'">'+s+'</div>';
};

/* ── Event delegation pour les spoilers Discord (.jmd-spoiler) ──
   Un seul listener global au lieu d'un onclick inline par spoiler. */
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('jmd-spoiler')) {
    e.target.classList.toggle('revealed');
  }
});


/* ══════════════════════════════════════════════════════════════════════
   7. CONFIRM MODAL — remplace window.confirm() natif
   ══════════════════════════════════════════════════════════════════════
   Usage :
     showConfirm('Supprimer cette fiche ?', () => { ... });
   ══════════════════════════════════════════════════════════════════════ */
window.showConfirm = (function() {
  var overlay = null;

  function injectCSS() {
    if (document.getElementById('jh-confirm-style')) return;
    var s = document.createElement('style');
    s.id = 'jh-confirm-style';
    s.textContent = `
      .jh-confirm-overlay{position:fixed;inset:0;z-index:9999;background:rgba(2,7,19,0.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;animation:jh-cin .15s ease}
      @keyframes jh-cin{from{opacity:0}to{opacity:1}}
      .jh-confirm-box{background:#0c1228;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:28px 32px;max-width:360px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6)}
      .jh-confirm-msg{font-family:'Rajdhani',sans-serif;font-size:.9rem;color:#e2e6f0;line-height:1.5;margin-bottom:22px}
      .jh-confirm-btns{display:flex;gap:10px;justify-content:center}
      .jh-confirm-ok{font-family:'Orbitron',sans-serif;font-size:.55rem;font-weight:700;letter-spacing:.12em;color:#fff;background:rgba(255,71,87,0.18);border:1px solid rgba(255,71,87,0.45);padding:10px 22px;border-radius:8px;cursor:pointer;transition:background .2s,border-color .2s}
      .jh-confirm-ok:hover{background:rgba(255,71,87,0.3);border-color:rgba(255,71,87,0.8)}
      .jh-confirm-cancel{font-family:'Orbitron',sans-serif;font-size:.55rem;font-weight:700;letter-spacing:.12em;color:#9aa0b8;background:transparent;border:1px solid rgba(255,255,255,0.1);padding:10px 22px;border-radius:8px;cursor:pointer;transition:border-color .2s,color .2s}
      .jh-confirm-cancel:hover{border-color:rgba(255,255,255,0.25);color:#e2e6f0}
    `;
    document.head.appendChild(s);
  }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  return function showConfirm(msg, onConfirm) {
    injectCSS();
    if (overlay) close();
    overlay = document.createElement('div');
    overlay.className = 'jh-confirm-overlay';
    overlay.innerHTML =
      '<div class="jh-confirm-box">' +
        '<div class="jh-confirm-msg">' + msg + '</div>' +
        '<div class="jh-confirm-btns">' +
          '<button class="jh-confirm-cancel">Annuler</button>' +
          '<button class="jh-confirm-ok">Confirmer</button>' +
        '</div>' +
      '</div>';
    overlay.querySelector('.jh-confirm-ok').addEventListener('click', function() {
      close();
      onConfirm();
    });
    overlay.querySelector('.jh-confirm-cancel').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  };
})();
