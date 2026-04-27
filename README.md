# JAHARTA // RP — Documentation Développeur

Site officiel du serveur RP Discord **Jaharta**.
Visible par tous, modifiable uniquement par les membres du staff.

> **Nouveau collaborateur ?** Lisez ce fichier en entier avant de toucher au code.

---

## Vision du projet

Le site permet à tout visiteur de consulter les informations de l'univers Jaharta, et offre aux joueurs authentifiés deux systèmes premium gamifiés.

| Page | Contenu | Accès |
|------|---------|-------|
| **Accueil** | Navigation vers les sections + lien Discord | Public |
| **Fiches RP** | Cartes des personnages joueurs validés | Public (lecture) |
| **PNJ** | Personnages non-joueurs importants | Public (lecture) |
| **Portail** | Liens Lore + Carte du monde | Public |
| **Lore** | Lore complet de l'univers | Public |
| **Races jouables** | Encyclopédie des 42 races (7 groupes) | Public |
| **Bestiaire** | Créatures et monstres | Public |
| **Gacha Nexus** | Système de tirages avec Navarites | Auth Discord `/link` |
| **Hub joueur** | 12 onglets de progression personnalisée | Auth Discord `/link` |
| **Admin** | Panel de gestion staff | Whitelist Firestore |

### Branche IRP (univers parallèle)

Une seconde expérience RP — **fork permanent** — coexiste avec la branche NORMAL :

| Page IRP | Équivalent NORMAL |
|---|---|
| `index-irp.html` | `index.html` |
| `fiches-irp.html` | `fiches.html` |
| `gacha-irp.html` | `gacha.html` |
| `hub-irp.html` | `hub.html` |

**Accès IRP** : bouton discret ◆ dans le footer de `index.html` → code `JAHARTA02irp` → redirige vers `index-irp.html`. Mode stocké dans `localStorage.jaharta_irp_mode`, géré par `js/irp-mode.js`. Collections Firestore dédiées : `irp_pnj`, `irp_bestiaire`, `irp_characters`, `irp_flesh_marks`.

---

## Stack technique

| Élément | Technologie | Fichier |
|---------|-------------|---------|
| Hébergement | GitHub Pages (`/docs`) | — |
| Base de données | Firebase Firestore (temps réel) | config inline |
| Stockage images | Firebase Cloud Storage | config inline |
| Authentification | Firebase Auth Google (admin) + code Discord `/link` (joueurs) | admin.html, gacha.html, hub.html |
| Frontend | HTML / CSS / JS vanilla — aucun bundler | — |
| UI réactive | Alpine.js 3.14 (onglets admin) | admin.html |
| 3D / Animation | Three.js (blob gacha) + GSAP (flip cartes + scan silhouette hub) | js/kanji-blob.js, gacha.html, hub.html |
| Constantes | RACES, RANKS, RACES_SPECIFIC | js/constants.js |
| Utilitaires | sanitize, compressImage, AntiSpam, Skeleton, showToast | js/utils.js |
| Cache images | localStorage URL cache (TTL 24h) — `window.JImgCache` | js/jaharta-img-cache.js |
| Micro-interactions | Ripple, IntersectionObserver reveal, scroll-progress, press | js/jaharta-motion.js |
| Debug logger | Panneau d'erreurs flottant | js/debug.js |

---

## Structure du repo

> L'arborescence complète des scripts figure dans [CLAUDE.md § Structure](CLAUDE.md#structure--fichiers-clés). Vue d'ensemble :

```
JahartaRP/
│
├── docs/                          ← Dossier servi par GitHub Pages
│   ├── index.html                 ← Accueil NORMAL
│   ├── index-irp.html             ← Accueil branche IRP (voir § Branche IRP)
│   ├── fiches.html / fiches-irp.html        ← Personnages joueurs (PC)
│   ├── pnj.html                   ← Personnages non-joueurs
│   ├── portail.html               ← Portail ressources (Lore + Carte)
│   ├── lore.html                  ← Lore complet
│   ├── racesjouables.html         ← Encyclopédie des 42 races (7 groupes)
│   ├── bestiaire.html             ← Bestiaire (créatures/monstres)
│   ├── gacha.html / gacha-irp.html          ← Gacha Nexus
│   ├── hub.html / hub-irp.html              ← Hub joueur (12 onglets, auth Discord)
│   ├── admin.html                 ← Panel d'administration (login Google)
│   │
│   ├── css/
│   │   ├── jaharta.css            ← STYLES PARTAGÉS
│   │   ├── hub.css                ← Styles hub
│   │   ├── hub-achievements.css   ← Onglet Achievements
│   │   ├── gacha.css              ← Styles gacha
│   │   ├── bestiaire-card.css     ← Cartes bestiaire
│   │   └── irp-theme.css          ← Overrides visuels IRP
│   │
│   ├── js/                        ← ~30 modules (voir CLAUDE.md pour détail)
│   │   ├── [shared]   constants, utils, debug, jaharta-nav, jaharta-cache, jaharta-img-cache, jaharta-motion, page-transition, music-player, auth-badge, kanji-blob, stats-caps, irp-mode, script
│   │   ├── [fiches]   fiches.js, fiches-irp.js
│   │   ├── [lore]     lore.js, racesjouables-logic.js, race-popup.js
│   │   ├── [gacha]    gacha-logic, gacha-irp-logic, gacha-blob, gacha-fx
│   │   └── [hub]      hub-core, hub-irp, hub-irp-core, hub-dashboard, hub-character, hub-inventory, hub-renders, hub-shops, hub-achievements
│   │
│   ├── img/ + assets/             ← Images, logos, favicons, carte
│   └── data/                      ← Fixtures / données statiques
│
├── CLAUDE.md                      ← Guide pour Claude Code (IA) — source de vérité conventions
├── docs/SITE_ARCHITECTURE.md      ← Guide rapide scripts par page + timings bot↔site
├── firestore.rules                ← Règles sécurité Firestore
├── .gitignore
└── README.md                      ← Ce fichier (doc humaine)
```

---

## Ordre d'inclusion des scripts

Dans chaque page, les scripts doivent être inclus dans cet ordre :

```html
<!-- 1. Debug logger (doit être en premier pour capturer toutes les erreurs) -->
<script src="js/debug.js"></script>

<!-- 2. Constantes globales (RACES, RANKS, RACES_SPECIFIC) -->
<script src="js/constants.js"></script>

<!-- 3. Utilitaires (sanitize, compressImage, AntiSpam, Skeleton, showToast) -->
<script src="js/utils.js"></script>

<!-- 4. Module Firebase (type="module", ESM) -->
<script type="module"> ... </script>

<!-- 5. Transition de page + micro-interactions (en fin de <body>) -->
<script src="js/page-transition.js"></script>
<script src="js/jaharta-motion.js"></script>
```

> `jaharta-motion.js` doit toujours être **après** `page-transition.js` et en fin de `<body>`. Il s'auto-initialise au `DOMContentLoaded` et ne dépend d'aucun autre script.

---

## Configuration Firebase

Toutes les pages partagent la même config Firebase déclarée inline dans chaque `<script type="module">`.

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

> **Note** : cette clé est publique (la sécurité repose sur les Firebase Security Rules côté serveur).

---

## Système d'accès admin

L'accès admin utilise une **whitelist Firestore** (pas juste Firebase Auth).

### Étapes pour ajouter un admin

1. Créer le compte dans **Firebase Console → Authentication → Users**
2. Copier l'**User UID** (chaîne type `abc123xyz...`)
3. Dans **Firestore → admins/{uid}**, créer un document avec :
   ```json
   { "role": "admin", "name": "PseudoMembre", "email": "membre@mail.com" }
   ```
4. Se connecter sur `/admin.html` via **Google uniquement** (bouton "Se connecter avec Google")

### Rôles disponibles

| Rôle | Valider | Rejeter | Supprimer | Voir logs |
|------|---------|---------|-----------|-----------|
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `modo`  | ✓ | ✓ | ✗ | ✗ |

---

## Système d'authentification joueur (Gacha + Hub)

Les pages `gacha.html` et `hub.html` utilisent un système d'auth distinct via le bot Discord.

### Étapes de connexion

1. Le joueur tape `/link` sur le serveur Discord
2. Le bot génère un code à 12 caractères valable **10 minutes**
3. Le joueur colle ce code dans le champ de connexion du site
4. Le frontend vérifie le document `users/{discordId}/linkCodes/{code}` en Firestore
5. La session est stockée en `localStorage` : `{ discordId, uid, userName }`

---

## Système Gacha Nexus (`gacha.html`)

| Élément | Détail |
|---------|--------|
| Monnaie | **Navarites** (NAV) — gérées par le bot Discord |
| Tirages | ×1 (1 NAV) / ×5 (5 NAV + 1 bonus) / ×10 (10 NAV + 4 bonus + 1 Epic garanti) |
| Pity soft | Compteur de pulls depuis le dernier Epic |
| Pity hard | Compteur de pulls depuis le dernier Légendaire |
| Animations | Blob Three.js (`kanji-blob.js`) + canvas particles + GSAP flip cartes |

**API globale du blob** (utilisable depuis gacha.html) :
```js
bSetCol(color1, color2)       // changer les couleurs
bExplode()                    // animation d'explosion
bAddOrbital(hexColor, tier)   // ajouter une sphère orbitale
```

---

## Hub joueur (`hub.html`)

12 onglets de progression personnalisée par joueur :

| # | Onglet | Contenu |
|---|--------|---------|
| 1 | Dashboard | Niveau, XP, Navarites, stats, pouvoirs |
| 2 | Personnage | Fiche complète (stats, bio, relations) |
| 3 | Inventaire | UI Cyberpunk 2077 — panneau 3 colonnes (slots ← silhouette SVG → slots), 15 types d'emplacements, grille items drag & drop, suppression d'items avec confirmation |
| 4 | Gacha | Historique des tirages |
| 5 | Party | Gestion d'équipe (6 membres, rôles) |
| 6 | Progression | Jalons, système battle pass |
| 7 | Titres | Badges cosmétiques débloqués |
| 8 | Compagnons | Familiers et invocations |
| 9 | Mon Shop | Étal de marché personnel |
| 10 | Shops | Marchés de tous les joueurs |
| 11 | Universal Shop | Boutique admin (prix fixes) |
| 12 | Paramètres | Notifications, confidentialité, profil |

Toutes les données sont chargées en temps réel via `onSnapshot()`.

---

## Schéma Firestore

### Collection `fiches` — Personnages joueurs (PC)

```
{
  firstname:     string       // Prénom
  lastname:      string       // Nom
  age:           string       // Âge (ex: "23 ans", "Inconnu")
  race:          string       // Groupe de race (humanoid, zooid…)
  raceSpecific:  string       // Race précise (Human, Elf, Neko…)
  rank:          string       // Rang de puissance (F → Z)
  desc:          string       // Description courte
  discord:       string       // Pseudo Discord
  photoUrl:      string       // URL de la photo (Firebase Storage)
  ficheFileUrl:  string       // URL du fichier fiche uploadé (optionnel)
  ficheFileName: string       // Nom du fichier
  linkUrl:       string       // Lien externe vers la fiche
  links:         Array        // [{t: "Fiche", h: "https://…"}]
  stats:         Object       // {str, agi, spd, int, mana, res, cha, aura} (0–9999)
  powers:        Array        // [{name: string, desc: string}]
  status:        string       // "en_attente" | "validee" | "rejetee"
  createdAt:     Timestamp
  updatedAt:     Timestamp
  validatedAt:   Timestamp
  rejectReason:  string
}
```

### Collection `pnj` — Personnages non-joueurs

```
{
  nom, prenom, age, race, role, titre,
  marital, taille, category, danger,
  photoUrl, desc,
  motivations: { desc, social, economique, militaire },
  createdAt
}
```

### Collection `pnj_filters` — Filtres personnalisés PNJ

```
{ label, color, order, createdAt }
```

### Collection `admins` — Whitelist staff

```
{ role: "admin" | "modo", name, email }
```

### Collection `logs` — Historique des actions admin

```
{ action, targetId, targetName, byEmail, byUid, byName, role, at }
```

> **Note sécurité (2026-04-06)** : le champ `_vip_id` a été supprimé de toutes les collections. Ne jamais le réintroduire.

### Collection `users` — Données joueurs (gacha + hub)

```
{
  navarites:    number        // solde de monnaie principale
  golden_eggs:  number|Object // œufs dorés (peut être un map Firestore — extraction sécurisée côté client)
  notoriety:    number        // points de notoriété
  gacha_pulls:  Array         // historique des tirages
  pity_state:   Object        // { soft_pity, hard_pity, streak }
  party:        Object        // équipe de 6 membres
  titles:       Array         // titres débloqués
  companions:   Array         // compagnons actifs
  shop_data:    Object        // étal de marché du joueur
  // Sous-collection linkCodes/{code} : { expiresAt, used }
}
```

### Collection `inventaires` — Inventaire joueur (hub.html, onglet 3)

```
{
  // doc ID : {discordId}_{charId}
  equipped_assets: Array    // IDs des items actuellement équipés
  items:           Object   // { [itemId]: quantity } — items en stock (non équipés)
}
```

---

## Règles de sécurité Firebase

### Firestore (à copier dans Firebase Console → Firestore → Règles)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Fiches : soumission publique, lecture publique si validée, écriture admin
    match /fiches/{ficheId} {
      allow create: if true;
      allow read:   if resource.data.status == "validee" || request.auth != null;
      allow update, delete: if request.auth != null;
    }

    // PNJ et filtres : lecture publique, écriture admin
    match /pnj/{id}         { allow read: if true; allow write: if request.auth != null; }
    match /pnj_filters/{id} { allow read: if true; allow write: if request.auth != null; }

    // Whitelist admins : lecture si connecté (vérifié dans admin.html)
    match /admins/{uid}     { allow read: if request.auth != null; }

    // Logs : lecture et écriture si connecté
    match /logs/{id}        { allow read, write: if request.auth != null; }
  }
}
```

### Storage

```
/photos/**  → lecture publique, écriture publique (images < 5MB)
/pnj/**     → lecture publique, écriture admin seulement
/fiches/**  → lecture publique, écriture publique (images < 5MB)
```

---

## Personnalisation du thème

Tout le thème visuel est contrôlé par les **variables CSS** dans `jaharta.css` (`:root`).

### Modifier les couleurs globales

Dans `docs/css/jaharta.css`, section `1. VARIABLES GLOBALES` :

```css
:root {
  /* Fonds */
  --bg:       #020713;   /* fond principal */
  --bg2:      #070d1e;   /* fond secondaire */
  --surface:  #0c1228;   /* surface carte */
  --surface2: #0a0f22;   /* surface secondaire */

  /* Couleurs accent */
  --cyan:    #00e5ff;   /* accent fiches + gacha */
  --magenta: #ff006e;   /* accent PNJ */
  --gold:    #ffd60a;   /* accent portail + admin */
  /* + --blue, --violet, --purple, --red, --green, --orange */

  /* Texte */
  --text:   #e2e6f0;   /* texte principal */
  --text2:  #7c84a0;   /* texte secondaire (hub surcharge → #c8cde0) */
  --text3:  #3a4060;   /* texte tertiaire  (hub surcharge → #9aa0b8) */
  --muted:  #5a7a90;   /* texte atténué */
}
```

> **⚠ Variables supprimées** : `--dark`, `--dark2`, `--bg-deep`, `--bg-dark`, `--bg-surface`, `--bg-card`, `--text-primary`, `--text-secondary`, `--text-dim`, `--font-display`, `--font-heading` — ces alias legacy ont été retirés du `:root`. Ne plus les utiliser.

### Variables d'animation (ajoutées sprint 5)

```css
/* Durées */
--dur-instant: 80ms   --dur-fast: 150ms   --dur-normal: 250ms
--dur-slow: 400ms     --dur-xslow: 600ms

/* Courbes d'accélération */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)   /* entrée fluide */
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1) /* rebond léger */
--ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1)
```

Utiliser ces variables dans **tous** les nouveaux `transition:` ou `animation:` pour garder une cohérence de timing sur tout le site.

> **⚠ Interdit** : `transition: all` — toujours lister les propriétés explicitement (ex: `transition: transform .3s, border-color .3s`). Ne jamais animer `width`, `height`, `padding`, `top`, `left` (causes des reflows).

### Variables RGB canaux (hub.css uniquement)

Pour les couleurs alpha dans `hub.css`, utiliser les canaux RGB :

```css
/* Dans hub.css — rgba thémables */
rgba(var(--cyan-rgb),   0.2)   /* au lieu de rgba(0,229,255,0.2)   */
rgba(var(--blue-rgb),   0.1)   /* au lieu de rgba(77,163,255,0.1)  */
rgba(var(--red-rgb),    0.15)  /* au lieu de rgba(255,71,87,0.15)  */
rgba(var(--bg-dk-rgb),  0.95)  /* au lieu de rgba(4,8,20,0.95)     */
```

Variables disponibles : `--cyan-rgb`, `--blue-rgb`, `--violet-rgb`, `--red-rgb`, `--green-rgb`, `--gold-rgb`, `--surface-dk-rgb`, `--bg-dk-rgb`.

### Accent par page

Chaque page surcharge `--accent` dans son `<style>` inline :

| Page | `--accent` | Modifier dans |
|------|-----------|---------------|
| index.html | cyan | `<style>` de index.html |
| fiches.html | cyan | `<style>` de fiches.html |
| pnj.html | magenta | `<style>` de pnj.html |
| portail.html | gold | `<style>` de portail.html |
| racesjouables.html | gold | `<style>` de racesjouables.html |
| admin.html | gold | `<style>` de admin.html |

### Modifier les couleurs des races

Dans `docs/js/constants.js` :
```js
window.RACES = {
  humanoid: { color: '#00c8ff', label: 'Humanoid' },
  // … modifier la couleur hex ici
};
```

### Modifier les couleurs des rangs

Dans `docs/js/constants.js` :
```js
window.RANKS = {
  F: { color: '#6b7280', bg: 'rgba(107,114,128,0.22)', level: 1 },
  // … modifier la couleur hex ici
};
```

---

## Ajouter une race ou un rang

**Nouvelle race dans un groupe existant :**
1. `docs/js/constants.js` → ajouter dans `window.RACES_SPECIFIC[groupe]`
2. `docs/racesjouables.html` → ajouter une `.race-card` dans le groupe concerné

**Nouveau groupe de race :**
1. `constants.js` → ajouter dans `window.RACES` + `window.RACES_SPECIFIC`
2. `fiches.html` → ajouter un bouton dans `.race-filter` + une `.race-btn` CSS
3. `racesjouables.html` → ajouter une section `.race-group`

**Nouveau rang :**
1. `constants.js` → ajouter dans `window.RANKS`
2. `fiches.html` → ajouter un bouton dans `.rank-filter`

---

## Ajouter un champ à la fiche personnage

1. **Formulaire** (`fiches.html`, section `<!-- MODAL DE SOUMISSION -->`) : ajouter l'input
2. **Soumission** (`submitCard()`) : lire et inclure la valeur dans `data`
3. **Édition** (`openEditFiche()`) : pré-remplir le champ
4. **Affichage** (`docs/js/fiches.js`, `buildCard()`) : afficher dans la carte (idem `fiches-irp.js` si applicable)
5. **Admin** (`admin.html`, `renderTable()`) : afficher dans le panel si nécessaire
6. **README** (ici) : documenter le champ dans le schéma `fiches`

---

## Déploiement

Le site se déploie automatiquement sur GitHub Pages à chaque push sur `main`.

**URL** : https://lxrdz3r0.github.io/JahartaRP/

### Tester en local

Firebase ESM nécessite un serveur HTTP (pas d'ouverture directe du fichier) :

```bash
cd docs
python3 -m http.server 8080
# Ouvrir → http://localhost:8080
```

---

## Conventions de code

- **CSS** : blocs commentés `/* ══ Section ══ */` dans jaharta.css
- **JS inline** : blocs commentés `/* ── Section ── */` + JSDoc sur les fonctions
- **Pas de framework JS** : vanilla JS + Firebase SDK ESM (CDN gstatic)
- **Alpine.js** : uniquement dans admin.html pour la logique d'onglets
- **Globals window._*** : fonctions Firebase exposées pour les scripts non-module
  - `window._db`, `window._storage`, `window._isAdmin`
  - `window._doc`, `window._updateDoc`, `window._deleteDoc`
  - `window._ref`, `window._uploadBytes`, `window._getDownloadURL`
- **Temps réel** : `onSnapshot()` sur fiches et pnj — pas de rechargement nécessaire
- **Sécurité** : `sanitize()` sur tous les inputs avant stockage Firestore
- **Formulaires** : pas de `<form>` — tout est géré via `onclick` + JS

---

## Contacts

Serveur Discord : [discord.gg/jBMnmeR944](https://discord.gg/jBMnmeR944)
