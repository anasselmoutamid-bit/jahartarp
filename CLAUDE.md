# CLAUDE.md — Jaharta RP

Site communautaire pour le serveur Discord RP **Jaharta**.
Hébergé sur GitHub Pages (`/docs`), backend Firebase, zéro framework JS.

---

## Stack

| Couche | Techno |
|--------|--------|
| Hébergement | GitHub Pages — dossier `/docs` (auto-deploy sur `main`) |
| Base de données | Firebase Firestore (temps réel via `onSnapshot`) |
| Stockage | Firebase Cloud Storage |
| Auth | Firebase Auth (Google uniquement — panel admin) |
| Frontend | HTML5 / CSS3 / JS vanilla — aucun bundler |
| Alpine.js 3.14 | **Uniquement** dans `admin.html` (onglets réactifs) |
| Three.js + GSAP | Blob 3D + animations gacha (`kanji-blob.js`, `gacha.html`) + scan silhouette hub (`hub.html`) |

---

## Structure — fichiers clés

```
docs/
├── index.html            Accueil NORMAL + nav
├── index-irp.html        Accueil branche IRP (voir § Branche IRP)
├── fiches.html           Cartes personnages joueurs (PC) — branche NORMAL
├── fiches-irp.html       idem — branche IRP
├── pnj.html              Personnages non-joueurs
├── portail.html          Portail lore + carte monde
├── lore.html             Lore complet
├── racesjouables.html    Encyclopédie des 42 races
├── bestiaire.html        Bestiaire (créatures/monstres)
├── gacha.html            Gacha Nexus NORMAL (auth requis)
├── gacha-irp.html        Gacha IRP
├── hub.html              Hub joueur NORMAL — 12 onglets (auth requis)
├── hub-irp.html          Hub joueur IRP — collections irp_*
├── casino.html           Casino Nexus — Roulette · Blackjack · Poker · Quitte ou Double (auth /link)
├── admin.html            Panel staff (whitelist Firestore)
│
├── CLAUDE-CASINO.md      Doc technique dédiée au module Casino
│
├── css/
│   ├── jaharta.css           Thème global partagé (variables CSS + tokens animation)
│   ├── hub.css               Styles hub (NORMAL + IRP)
│   ├── hub-achievements.css  Styles onglet Achievements
│   ├── gacha.css             Styles gacha
│   ├── bestiaire-card.css    Styles cartes bestiaire
│   ├── casino.css            Styles casino (thème gold/felt, cartes, roue, pièce)
│   └── irp-theme.css         Overrides thème IRP
│
└── js/
    ├── constants.js             window.RACES / window.RANKS / window.RACES_SPECIFIC
    ├── utils.js                 sanitize(), compressImage(), AntiSpam, Skeleton, showToast()
    ├── debug.js                 Logger flottant (window._dbg)
    ├── jaharta-nav.js           Navbar injectée (PAGES_NORMAL + PAGES_IRP)
    ├── jaharta-cache.js         Wrapper onSnapshot avec tracking unsub (_snapSubs)
    ├── jaharta-img-cache.js     Cache localStorage URLs Firebase Storage (TTL 24h)
    ├── jaharta-motion.js        Micro-interactions globales (ripple, reveal, press)
    ├── page-transition.js       Overlay fade entre pages
    ├── music-player.js          Lecteur audio flottant
    ├── auth-badge.js            Badge utilisateur authentifié
    ├── kanji-blob.js            Blob Three.js (gacha NORMAL + hub scan)
    ├── stats-caps.js            Calcul plafonds de stats selon rang
    ├── irp-mode.js              Flag localStorage + redirections NORMAL↔IRP
    ├── script.js                Logique landing (index.html only)
    │
    ├── fiches.js                Firebase fiches joueurs (NORMAL)
    ├── fiches-irp.js            Firebase fiches joueurs (IRP)
    ├── lore.js                  Logique page lore
    ├── racesjouables-logic.js   Popup races + filtres
    ├── race-popup.js            Popup race (hub)
    │
    ├── gacha-logic.js           Logique tirages gacha NORMAL
    ├── gacha-irp-logic.js       Logique tirages gacha IRP
    ├── gacha-blob.js            Blob 3D gacha
    ├── gacha-fx.js              Effets visuels gacha
    │
    ├── hub-core.js              Logique centrale hub NORMAL (tabs + fade)
    ├── hub-irp.js               Override hub IRP (collections)
    ├── hub-irp-core.js          Logique centrale hub IRP
    ├── hub-dashboard.js         Onglet Dashboard
    ├── hub-character.js         Onglet Personnage
    ├── hub-inventory.js         Onglet Inventaire (UI Cyberpunk)
    ├── hub-renders.js           Rendu cartes hub
    ├── hub-shops.js             Onglets Shops
    ├── hub-achievements.js      Onglet Achievements
    │
    ├── casino-core.js           Init Firebase, auth /link, session, wallet, mode, tabs, debit/credit, logs
    ├── casino-roulette.js       Roulette européenne — table partagée, betting 30s, spin, payouts
    ├── casino-blackjack.js      Blackjack 6 sièges — dealer hits soft 17, BJ 3:2, double
    ├── casino-poker.js          Texas Hold'em 2-6 joueurs — évaluation main 7 cartes
    └── casino-flip.js           Quitte ou Double (PRIME only) — solo, navarites, streak
```

---

## Ordre d'inclusion obligatoire des scripts

```html
<script src="js/debug.js"></script>      <!-- 1. capture toutes les erreurs -->
<script src="js/constants.js"></script>  <!-- 2. RACES, RANKS globaux -->
<script src="js/utils.js"></script>      <!-- 3. sanitize, showToast, etc. -->
<script type="module"> ... </script>     <!-- 4. Firebase ESM + logique page -->
```

---

## Firebase

**Config publique** (la sécurité repose sur les Firestore Security Rules) :

```js
const firebaseConfig = {
  apiKey:            "AIzaSyAru7qZX8Gu_b8Y3oNDV-a5PmkrrkRjkcs",
  authDomain:        "jaharta-rp.firebaseapp.com",
  projectId:         "jaharta-rp",
  storageBucket:     "jaharta-rp.firebasestorage.app",
  messagingSenderId: "217075417489",
  appId:             "1:217075417489:web:4d1e2df422a5cd42411a30"
};
```

**Collections principales :**

| Collection | Contenu |
|------------|---------|
| `fiches/{id}` | Personnages joueurs — status: `en_attente\|validee\|rejetee` |
| `pnj/{id}` | PNJ avec motivations, danger, catégorie |
| `pnj_filters/{id}` | Tags de filtre personnalisés PNJ |
| `admins/{uid}` | Whitelist staff — role: `admin\|modo` |
| `logs/{id}` | Historique actions admin |
| `users/{discordId}` | Données joueurs (navarites, gacha, inventaire…) |
| `players/{uid}` | Profil joueur — `navarites`, `display_theme` (modifiables client) |
| `economy/{uid_charId}` | Économie Kanites — `personal`, `family`, `royal` (modifiables client) |
| `casino_config/main` | `is_open: bool` — ouverture/fermeture globale (admin only en écriture) |
| `casino_tables/{tableId}` | Tables multijoueur (`roulette_main`, `blackjack_main`, `poker_main`) |
| `casino_logs/{id}` | Historique paris casino — create public whitelisté, read admin |

**Globals window exposés** dans les modules Firebase pour les scripts non-module :
`window._db`, `window._storage`, `window._isAdmin`, `window._doc`, `window._updateDoc`, `window._deleteDoc`

---

## Cache images (`jaharta-img-cache.js`)

Cache localStorage des URLs d'images Firebase Storage, TTL 24 h.

```js
window.JImgCache.get(key)               // → url|null (depuis le cache)
window.JImgCache.set(key, url)          // écrit en cache
window.JImgCache.applyTo(img, key, url) // affiche en cache-first, rafraîchit si différent
window.JImgCache.invalidate(key)        // invalide une entrée
window.JImgCache.stats()                // {total, expired}
```

**Clés par type de document :**
- `fc_{id}` — fiches joueurs (fiches.html, fiches.js)
- `char_{id}` — personnage hub (hub.html)
- `pnj_{id}` — PNJ (pnj.html)

---

## Systèmes principaux

### Gacha Nexus (`gacha.html`)
- Auth par code `/link` Discord (12 chars) → lookup `users/{id}/linkCodes/{code}`
- Monnaie : **Navarites** (NAV) — déduites côté serveur (bot Discord)
- Tirages : ×1 / ×5+bonus / ×10+bonus+Epic garantie
- Pity : soft (Epic) + hard (Legendary) + streak Navarites
- Animations : blob Three.js (`bSetCol`, `bExplode`, `bAddOrbital`) + canvas particles + GSAP flip
- **⚠ SUPPRIMÉ** : champs `vip_boost`, `specialz_leg_plus`, `specialz_full_leg` ne sont **plus** écrits dans `gacha_pulls` — le bot doit calculer ces flags lui-même côté serveur

### Hub joueur (`hub.html`)
- Même auth que gacha
- 12 onglets : Dashboard, Personnage, Inventaire, Gacha, Party, Progression, Titres, Compagnons, Mon Shop, Shops, Universal Shop, Paramètres
- Toutes les données en temps réel via `onSnapshot()`

#### Onglet Inventaire — UI Cyberpunk 2077
- **Split-view** : panneau personnage (520px gauche) + grille items (droite)
- **CDNs supplémentaires dans `<head>`** : SortableJS 1.15.2, Tippy.js 6, Popper.js 2, **GSAP 3.12.5**
- **Panneau personnage** : layout 3 colonnes `.cyb-panel` (168px | SVG center | 168px) :
  - Colonne GAUCHE (haut → bas) : TÊTE (`sz-tete`) · COU ET OREILLES (`sz-cou`+`sz-oreilles`) · ARMURE & CAPE (`sz-torse`+`sz-dos`+`sz-bras`+`sz-poignets`) · MAINS & DOIGTS (`sz-mains`+`sz-doigts`) · SPÉCIAUX (`sz-special`)
  - Colonne DROITE (haut → bas) : VISAGE (`sz-visage`) · ARMES (`sz-armes_h`+`sz-armes_l`) · JAMBES (`sz-jambes`) · PIEDS (`sz-pieds`)
  - **SVG centre** (`#cyb-figure-svg`, viewBox `0 0 280 540`) : corps holographique rouge/cyan translucide (`fill rgba(160,25,20,0.18)` + `stroke rgba(0,229,255,…)`), nœuds orange, yeux lumineux, réacteur thoracique rouge
  - `<filter id="glowCyan">` / `<filter id="glowOrange">` / `<filter id="glowRed">` dans `<defs>`
  - `<linearGradient id="scanRed">` + `<clipPath id="bodyClip">` pour le scan beam
  - `<rect id="cyb-scan-beam">` animé par `initCharScanAnimation()` (GSAP `fromTo attr.y`, -26 → 542, 4 s)
  - Lignes de connexion SVG : 5 lignes horizontales pointillées GAUCHE (y=54,162,270,378,486) + 4 DROITE (y=68,202,338,472)
- **Slots** (15 IDs) : `slot-cell empty-cell` (pulsant) / `slot-cell occupied` (lueur dorée) — drag & drop SortableJS vers les cellules `sz-*`
- **Suppression items** : bouton poubelle sur chaque carte au survol + bouton dans le panneau détail → `openDeleteModal(itemId, event)` → modal de confirmation avec contrôle quantité → `confirmDelete()` écrit Firestore `items` (sans toucher `equipped_assets`)
- **Grille droite** : filtres catégorie/rareté/slot, recherche, tri, drag & drop (SortableJS), tooltips (Tippy.js)
- **Portefeuille** : `PLAYER.golden_eggs` peut être un objet Firestore — extraction sécurisée via `Object.values(_ge).find(v=>typeof v==='number')`
- **Fonctions JS clés** : `renderInventory()`, `renderCharacterPanel()`, `initCharScanAnimation()`, `renderItemsGrid()`, `initDragDrop()`, `initTooltips()`, `toggleEquip()`, `showItemDetail()`, `closeItemDetail()`, `openDeleteModal()`, `closeDeleteModal()`, `confirmDelete()`

### Panel Admin (`admin.html`)
- Accès : lien discret `⚙ STAFF` dans le footer de `index.html` uniquement — **absent de toutes les navbars**
- Auth Firebase (Google uniquement via `signInWithPopup`) + vérification `admins/{uid}` en Firestore
- Si l'UID n'existe pas dans `/admins` → `auth.signOut()` immédiat + message "Accès refusé"
- Rôle `admin` : supprimer fiches + voir logs
- Rôle `modo` : lecture seule (fiches + PNJ)
- Onglets : **Fiches** · **PNJ** · **Logs** (Logs visible admins uniquement)
- Alpine.js pour la réactivité des onglets (`logsVisible` contrôle l'onglet Logs)
- **⚠ SUPPRIMÉ** : bypass VIP Discord IDs — `window._isAdmin` est exclusivement contrôlé par Firebase Auth
- **⚠ SUPPRIMÉ** : onglet Gacha (API bot externe) + onglet Races (redondant)

### Casino Nexus (`casino.html`)

Module multijoueur temps réel — voir **[docs/CLAUDE-CASINO.md](docs/CLAUDE-CASINO.md)** pour la doc technique complète.

- Auth : même système `/link` Discord que gacha/hub (session 7 jours localStorage)
- Firebase **compat** (non-ESM) — scripts chargés après `firebase-*-compat.js`
- Deux modes : **NORMAL** (Kanites — `economy.personal`) / **PRIME** (Navarites — `players.navarites`)
- 4 jeux : Roulette européenne · Blackjack 6 sièges · Texas Hold'em 2-6j · Quitte ou Double (PRIME only)
- Architecture **host-driven** : élection client dynamique via `host_ping` (TTL 7s, failover auto)
- Transactions atomiques Firestore pour tous débits/crédits + `lastClaimedRound` anti double-crédit payouts
- Admin : onglet **Casino** dans `admin.html` → toggle `casino_config.is_open` + feed des 20 derniers paris

**⚠ Sécurité Firestore — point d'attention :** `casino_tables` et `players.navarites` sont écrits sans auth (règles `allow write: if true`), la logique métier repose sur les transactions client et les phase checks. Cela est **contournable** : tout client peut réécrire les tables ou se créditer. Durcissement prévu via Cloud Function ou Admin SDK côté bot.

### Branche IRP (fork permanent assumé)

La branche **IRP** est un univers RP parallèle, déployée comme un **fork permanent** de la branche NORMAL (décision 2026-04-18). Les deux versions coexistent et peuvent diverger.

**Pages IRP :**
- `index-irp.html` · `hub-irp.html` · `gacha-irp.html` · `fiches-irp.html`

**Collections Firestore IRP :** `irp_pnj`, `irp_bestiaire`, `irp_characters`, `irp_flesh_marks` (en plus des collections NORMAL qui restent utilisées par les pages non-IRP).

**Entrée utilisateur** : bouton discret ◆ dans le footer de `index.html` → modal code `JAHARTA02irp` → `index-irp.html`. Flag stocké dans `localStorage.jaharta_irp_mode`.

**Modules IRP-specific** :
- `js/irp-mode.js` — gestion du flag + redirections inter-pages
- `js/hub-irp.js` + `js/hub-irp-core.js` — override collections hub
- `js/gacha-irp-logic.js` — logique gacha IRP (bannières, Jahartites)
- `js/fiches-irp.js` — fiches IRP
- `css/irp-theme.css` — overrides visuels (thème violine)

**Règle de sync** : toute évolution touchant le code commun (layout, nav, utils, constants, auth) DOIT être portée sur les 2 branches. Les divergences intentionnelles (features propres à IRP) restent isolées dans les fichiers `*-irp.*`.

---

## Design system

**Variables CSS globales** (`jaharta.css` `:root`) :
```css
/* Fonds */
--bg:       #020713   /* fond principal */
--bg2:      #070d1e   /* fond secondaire */
--surface:  #0c1228   /* surface carte */
--surface2: #0a0f22   /* surface secondaire */

/* Couleurs accent */
--cyan:    #00e5ff   /* accent fiches + gacha */
--magenta: #ff006e   /* accent PNJ */
--gold:    #ffd60a   /* accent portail + admin */
--blue, --violet, --purple, --red, --green, --orange

/* Texte */
--text:   #e2e6f0   /* texte principal */
--text2:  #c8cde0   /* texte secondaire — surchargé dans hub.css */
--text3:  #9aa0b8   /* texte tertiaire — surchargé dans hub.css */
--muted:  #5a7a90   /* texte atténué */
```

**Canaux RGB (hub.css `:root`) — pour `rgba()` thémables** :
```css
--cyan-rgb:       0,229,255    --blue-rgb:   77,163,255
--violet-rgb:     139,92,246   --red-rgb:    255,71,87
--green-rgb:      68,255,136   --gold-rgb:   255,214,10
--surface-dk-rgb: 8,12,28      --bg-dk-rgb:  4,8,20
```
→ Utiliser `rgba(var(--cyan-rgb), 0.2)` plutôt que `rgba(0,229,255,0.2)` dans hub.css.

**Variables INTERDITES (legacy — supprimées du `:root`)** :
`--dark`, `--dark2`, `--bg-deep`, `--bg-dark`, `--bg-surface`, `--bg-card`, `--text-primary`, `--text-secondary`, `--text-dim`, `--font-display`, `--font-heading`

Chaque page surcharge `--accent` dans son `<style>` inline.

**Polices** (via variables) : `--font-h` Orbitron (titres) · `--font-b` Rajdhani (sous-titres) · `--font-body` Exo 2 (corps) · `--font-m` Share Tech Mono (UI/mono)

**Rangs** (14 niveaux, F → Z) : rangs S+ ont une animation CSS prismatique pulsante.

**Groupes de races** (7) : Humanoids · Zooids · Mythical Zooids · Demons · Artificial · Semi-Liquid · Undead

---

## Conventions

- **Immutabilité** : créer de nouveaux objets, ne pas muter.
- **Sanitize** : appeler `sanitize()` sur tout input avant Firestore ET avant tout `innerHTML` / insertion DOM.
- **Pas de `<form>`** : tout est géré via `onclick` + JS.
- **Pas de bundler** : imports ESM directs depuis CDN gstatic.
- **Real-time first** : préférer `onSnapshot()` à `getDocs()` pour l'UI.
- **Sections commentées** CSS : `/* ══ Titre ══ */` · JS : `/* ── Titre ── */`
- **Nommage** : variables et commentaires en **français** (adapté communauté FR).
- **Taille fichiers** : < 800 lignes par fichier, fonctions < 50 lignes.
- **Pas de `console.*`** : utiliser exclusivement `window._dbg?.log/warn/error()` (jamais `console.log/warn/error` en production).
- **onSnapshot** : chaque appel `onSnapshot()` DOIT stocker sa fonction de désabonnement (`const unsub = onSnapshot(...)` ou `_unsubs.key = onSnapshot(...)`).
- **Pas de logs** : `showToast()` pour feedback UX, `window._dbg?.` pour erreurs dev.
- **Pas de `transition:all`** : toujours lister les propriétés explicitement (`transform`, `opacity`, `border-color`, `box-shadow`, `background`…). Jamais de propriétés layout (`width`, `height`, `padding`, `top`, `left`).
- **CSS rgba()** : utiliser `rgba(var(--cyan-rgb), 0.2)` — ne jamais hardcoder les triplets RGB dans hub.css.
- **Images fiches** : `buildCard(ch, idx)` — les 4 premières cartes (idx < 4) utilisent `loading='eager'` + `fetchPriority='high'` pour le LCP ; le reste `loading='lazy'`.
- **Toast** : `showToast()` ajoute `.show` (déclenche `jh-toast-in` via jaharta.css) puis remplace par `.jh-out` (déclenche `jh-toast-out`) avant de nettoyer.

---

## Tests en local

Firebase ESM requiert un serveur HTTP :

```bash
cd docs
python3 -m http.server 8080
# → http://localhost:8080
```

---

## Tâches fréquentes

**Ajouter une race :**
1. `js/constants.js` → `window.RACES` + `window.RACES_SPECIFIC`
2. `racesjouables.html` → `.race-card` dans le bon `.race-group`
3. `fiches.html` → bouton filtre si nécessaire

**Ajouter un champ à une fiche :**
1. `fiches.html` modal soumission + `submitCard()` + `openEditFiche()`
2. `js/fiches.js` (et `fiches-irp.js` si applicable) — rendu dans `buildCard()`
3. `admin.html` `renderTable()` si besoin dans le panel
4. `README.md` schéma Firestore

**Ajouter un admin :**
1. Firebase Console → Authentication → créer l'utilisateur
2. Firestore → `admins/{uid}` → `{ role: "admin", name: "...", email: "..." }`

**Déployer :**
Push sur `main` → GitHub Pages auto-deploy (délai ~1 min).
