# AUDIT.md — Diagnostic JahartaRP

**Date :** 2026-04-18
**Périmètre :** `docs/` (tout ce qui est déployé sur GitHub Pages)
**Mode :** Lecture seule — aucune modification de code.

---

## 🚨 FINDING CRITIQUE — À traiter en P0 AVANT toute autre action

Deux pages HTML déployées en production chargent un script JS externe obfusqué depuis `cdn.discordapp.com` :

| Fichier | Ligne | Script |
|--------|------|--------|
| `docs/lore.html` | 1 (dans `<head>`) | `https://cdn.discordapp.com/yepQN9HFTTGf…` (≈1100 chars d'URL base64-like) |
| `docs/racesjouables.html` | 1 (dans `<head>`) | `https://cdn.discordapp.com/ZHJ-H3XqizYB…` (≈1100 chars d'URL base64-like) |

**Pourquoi c'est critique :**
1. `cdn.discordapp.com` n'est PAS un CDN public légitime pour héberger du JS — c'est le stockage de fichiers Discord utilisé historiquement pour exfiltrer ou injecter du code.
2. Depuis fin 2023/2024, Discord expire ces URLs toutes les 24 h, donc **le script peut 404 ou retourner du contenu différent à chaque fois** — attaque type supply chain.
3. Ces deux pages s'exécutent sur le même origin que `hub.html`/`gacha.html` → **le script a accès aux cookies Firebase Auth, aux sessions `users/{discordId}`, au localStorage (codes `/link`, cache images, `jaharta_irp_mode`…)**.
4. Le script est placé **avant** tous les autres scripts du projet (`debug.js`, `utils.js`…) — il peut overrider n'importe quelle fonction globale (`sanitize`, `fetch`, `XMLHttpRequest`, `localStorage.setItem`…).
5. Aucune trace dans `git log -S "cdn.discordapp"` → probablement commité silencieusement dans un des récents `Add files via upload` (commits `0eaea83`, `9bf93a2`) qui ne passent pas par une revue.

**Actions recommandées (à exécuter hors de cet audit, en priorité absolue) :**
- [ ] Supprimer immédiatement les 2 lignes des deux fichiers (commit dédié `security: remove injected third-party script`).
- [ ] Auditer **tous** les fichiers du repo (`grep -r "cdn.discordapp\|eval\|document.write\|atob(" docs/`) — scan complet.
- [ ] Rotation du compte GitHub / révision des contributeurs autorisés au repo (branche main).
- [ ] Rotation des secrets Firebase si une fuite serait possible (l'API key publique n'est pas un secret, mais des tokens Admin SDK éventuels ailleurs).
- [ ] Mettre en place une règle de pré-commit (hook ou CI GitHub Action) qui bloque tout script `<script src>` pointant vers un domaine hors allowlist (`gstatic.com`, `googleapis.com`, `unpkg.com`, `cdn.jsdelivr.net`, etc.).

> **⚠ Attention :** je n'ai **pas** modifié ces fichiers car le prompt spécifie Phase 1 en lecture seule. Tu dois valider la correction immédiate **avant** la suite de l'audit, ou décider que le finding est connu et que la remédiation viendra plus tard.

---

## 1.1 Arbre annoté de `docs/`

```
docs/
├── CNAME                                   Domaine custom GitHub Pages
├── SITE_ARCHITECTURE.md                    Doc interne — guide rapide (normal/IRP) — 55 lignes
├── PROMPT-AUDIT.md                         Copie du prompt d'audit utilisateur (à supprimer ? à archiver ?)
├── index.html                (790)         Accueil — contient aussi le bouton ◆ secret → index-irp
├── index-irp.html            (793)         Accueil IRP (fork complet de index.html)
├── hub.html                  (694)         Hub joueur — 12 onglets, auth /link
├── hub-irp.html              (667)         Hub IRP (fork — collections irp_*)
├── gacha.html                (266)         Gacha Nexus normal
├── gacha-irp.html            (280)         Gacha IRP (fork)
├── fiches.html               (602)         Fiches personnages joueurs
├── fiches-irp.html           (606)         Fiches IRP (fork)
├── pnj.html                  (784)         PNJ — module Firebase INLINE (l12-301)
├── bestiaire.html            (754)         Bestiaire — module Firebase INLINE (l12-58)
├── portail.html              (340)         Portail lore + carte monde
├── racesjouables.html        (315)         ⚠ contient script Discord injecté
├── lore.html                 (621)         Lore ⚠ contient script Discord injecté
├── admin.html                (660)         Panel staff (Alpine + Firebase Auth Google)
│
├── assets/
│   └── map-holographic.png                 Carte monde (portail.html)
│
├── data/
│   └── irp_gacha_banners.json              Données IRP statiques — rôle à clarifier
│
├── img/
│   ├── banner.png                          OG / social share
│   ├── favicon.ico / favicon-32.png / favicon-180.png
│   └── logo-jaharta.png                    Logo navbar + page transition
│
├── css/
│   ├── jaharta.css                 (2627) Thème global — LOAD SUR TOUTES LES PAGES (xxl)
│   ├── hub.css                     (1009) Spécifique hub + hub-irp
│   ├── gacha.css                   (1043) Spécifique gacha + gacha-irp
│   ├── hub-achievements.css         (159) Spécifique onglet succès
│   ├── bestiaire-card.css           (435) Spécifique bestiaire
│   ├── irp-theme.css                (409) Overrides couleurs IRP (violine)
│   └── page-transition.js           (41)  ⚠ FICHIER JS DANS /css/ — DOUBLON ORPHELIN
│
└── js/
    ├── constants.js                 (64)  RACES, RANKS, RACES_SPECIFIC (globals window.*)
    ├── utils.js                     (385) sanitize, compressImage, AntiSpam, Skeleton, showToast
    ├── debug.js                     (309) window._dbg logger flottant (patche console.error)
    ├── page-transition.js           (41)  Overlay fade in/out entre pages
    ├── jaharta-nav.js               (138) Navbar + menu mobile (normal/IRP)
    ├── jaharta-motion.js            (184) Ripple/reveal/scroll-progress/press (injecté 9 pages)
    ├── jaharta-cache.js             (227) Cache localStorage générique + onSnapshotCached wrapper
    ├── jaharta-img-cache.js         (114) Cache URLs d'images Firebase (TTL 24h, clés fc_/char_/pnj_)
    ├── jaharta-card.js              (340) ⚠ ORPHELIN — Web Component <jaharta-card> non chargé
    ├── card-glow.js                 (145) ⚠ ORPHELIN — Effet scanline + tilt fiches
    ├── script.js                    (193) Landing : initNav, initScrollReveal, initParticles, initMobileNav
    ├── music-player.js              (213) Lecteur audio flottant
    ├── stats-caps.js                (108) Calculs plafonds stats (utilisé fiches + pnj)
    ├── auth-badge.js                 (88) Badge auth utilisateur (navbar)
    ├── irp-mode.js                  (744) Gestion mode IRP côté client
    │
    ├── kanji-blob.js                (453) Blob Three.js — gacha animation
    ├── gacha-blob.js                (262) Variante blob — gacha
    ├── gacha-fx.js                  (429) Effets particules + flip gacha
    ├── gacha-logic.js               (943) Logique tirages + pity + banners (NORMAL)
    ├── gacha-irp-logic.js           (870) Fork IRP de gacha-logic
    │
    ├── hub-core.js                  (653) showTab, auth, init hub (NORMAL)
    ├── hub-irp-core.js              (890) Fork IRP de hub-core
    ├── hub-dashboard.js             (250) Onglet Dashboard
    ├── hub-character.js             (225) Onglet Personnage
    ├── hub-inventory.js             (811) ⚠ >800 — Onglet Inventaire cyberpunk
    ├── hub-renders.js               (300) Render cartes hub
    ├── hub-shops.js                 (845) ⚠ >800 — Onglets Mon Shop / Shops / Universal
    ├── hub-achievements.js          (422) Onglet Titres/Succès
    ├── hub-irp.js                   (777) Fork IRP — override collections
    │
    ├── race-popup.js                (361) Popup détail race (hub)
    ├── racesjouables-logic.js       (711) Popup + filtres page races
    │
    ├── fiches.js                    (884) ⚠ >800 — Module Firebase fiches joueurs
    ├── fiches-irp.js                (796) Fork IRP de fiches.js
    └── lore.js                      (676) Module Firebase page lore
```

**Total :** ~28 700 lignes sur 54 fichiers. 5 fichiers > 800 lignes (convention CLAUDE.md).

---

## 1.2 Perf

### Scripts bloquants et ordre de chargement

**Positif :** `debug.js` / `constants.js` / `utils.js` sont placés en bas de `<body>` sur la majorité des pages (conforme CLAUDE.md). Modules Firebase en `type="module"` (non bloquants par défaut).

**Négatif :**
- **`fiches.html:12-13`** : `<script src="js/stats-caps.js">` + `<script type="module" src="js/fiches.js">` placés **dans le `<head>`** avant le CSS (`<link rel="stylesheet">` à la ligne 15). `fiches.js` est un module donc non-bloquant, mais `stats-caps.js` (classique) l'est. Idem `fiches-irp.html:12-13`.
- **`gacha.html:16-17`** + `gacha-irp.html:17-18` : `<script src="js/debug.js">` chargé dans `<head>` **avant** le CSS.
- **`bestiaire.html:12-58`** : module Firebase **inline** dans `<head>` (46 lignes de logique). Bloque le parse jusqu'à téléchargement Firebase SDK.
- **`admin.html:13-122`** : même pattern — 109 lignes de module inline dans `<head>`.
- **`pnj.html:12-301`** : **289 lignes de module inline dans `<head>`** — massif. Blocage du parse + duplication avec ce qui pourrait vivre dans un `pnj.js` extrait.
- **`lore.html:1`** et **`racesjouables.html:1`** : script Discord injecté **avant** `<head>` (voir finding critique).

### Google Fonts

14 pages chargent chacune **4 familles × 5 graisses** depuis `fonts.googleapis.com/css2` :
```
Orbitron(400;500;600;700;800;900) + Rajdhani(300;400;500;600;700)
+ Exo 2(ital 0,300;0,400;0,500;1,300;1,400) + Share Tech Mono
```
- `preconnect` présent (✓)
- Aucun `rel="preload"` sur la graisse critique
- Aucun `font-display: swap` explicite (géré par `display=swap` dans l'URL, ✓)
- `admin.html` ne demande pas `Share Tech Mono` — incohérent avec les autres pages
- **~1.5 MB** estimé de WOFF2 pour les 4 familles complètes

### CSS

- `jaharta.css` = **2627 lignes, chargée sur toutes les pages** (y compris landing statique). Probablement 60-70 % de règles inutilisées par page — aucune split critical/non-critical.
- `hub.css` (1009) et `gacha.css` (1043) : > 800 lignes (convention CLAUDE.md).
- `hub.css` contient encore **89 occurrences de `rgba(X,Y,Z,a)` hardcodé** — la convention CLAUDE.md impose `rgba(var(--X-rgb), a)`. Le roadmap annonce "~307 migrés" mais il en reste (échantillon : ligne 56 `rgba(2,5,14,0.95)`, 65 `rgba(255,255,255,0.06)`, 79 `rgba(2,7,19,0.97)`, 122 `rgba(0,0,0,0.3)`, 124 `rgba(255,255,255,0.15)`, 135 `rgba(2,7,19,0.98)`, 161 `rgba(8,14,32,0.85)`…).
- `jaharta.css` : 151 occurrences `rgba()` hardcodées — convention CLAUDE.md **n'impose pas** la règle sur jaharta.css (uniquement `hub.css`), mais reste une opportunité de cohérence.

### Images

- Aucun `<img>` avec attributs `width` + `height` explicites dans aucun HTML (vérifié : `logo-jaharta.png`, `nav-avatar`, `pt-img`, `user-avatar` tous sans dimensions) → risque de **CLS** au premier paint.
- `pnj.html:131` et `bestiaire.html:501` utilisent bien `loading="lazy"` sur les vignettes (✓).
- Aucun `<link rel="preload" as="image">` pour l'image hero des pages lourdes.
- Formats : toutes les images statiques sont en `.png` (aucune WebP/AVIF). L'encyclopédie races charge des visuels depuis Firestore (format serveur).
- `map-holographic.png` dans `assets/` chargée par portail.html — taille non vérifiée mais probable candidat WebP.

### onSnapshot sans désabonnement

Après scan complet, **aucun listener orphelin** détecté. Tous les appels `onSnapshot()` stockent leur unsub :
- `admin.html` : `_unsubs.{logs,fiches,pnj,best,lore}` ✓
- `bestiaire.html` : `window._bestUnsub`, `window._irpBestUnsub` ✓
- `lore.html:606` : `window._loreUnsub` ✓
- `pnj.html:39, 275` : `window._pnjUnsub`, `window._irpPnjUnsub` ✓
- `fiches.js` : `_unsubChars`, `_unsubFiches`, `_unsubFleshMarks`, `_unsubIRPChars` ✓
- `fiches-irp.js` : idem ✓
- `hub-achievements.js` : `_userUnsub` ✓
- `gacha-logic.js` : `_bannerUnsub` + `unsub` local pour pulls ✓
- `gacha-irp-logic.js` : idem ✓
- `jaharta-cache.js` : `_snapSubs[cacheKey]` ✓

Le sprint 6 P1 a bien tenu. **Pas de régression.**

### `transition: all`

**Aucune occurrence** dans `docs/css/` ni dans les `<style>` inline HTML (scan complet). Convention respectée à 100 %.

### Firebase duplicate init

`initializeApp()` + config hardcoded trouvé dans **12 fichiers distincts** :
- 7 HTML (admin, gacha, gacha-irp, pnj, bestiaire, racesjouables, lore)
- 5 JS (auth-badge, fiches, fiches-irp, hub-core, hub-irp-core)

Chaque page boot un App Firebase indépendant → import SDK (`firebase-app.js` + `firestore.js` + éventuellement `auth.js` + `storage.js`) **à chaque navigation** via ESM. Pas de SDK singleton partagé.

**Impact :** bande passante + temps parse répétés. Non bloquant fonctionnellement (HTTP/2 cache + SW du navigateur peuvent aider), mais duplication forte de code.

### Fonts — multiplicité

4 familles × 5-6 variantes = hitrate élevé sur les premières pages, acceptable. Cependant `Share Tech Mono` n'est utilisé que pour le font `--font-m` (UI mono rare) — à envisager de sortir en chargement optionnel.

### Top 10 perf opportunities

| # | Problème | Gain potentiel |
|---|---------|----------------|
| 1 | `jaharta.css` 2627 lignes chargé partout | Split thème / composants (LCP −200 ms) |
| 2 | Firebase init dupliqué × 12 | Module `firebase-init.js` partagé (parse −100 ms) |
| 3 | Fonts : 6 variantes Orbitron + ital Exo 2 jamais utilisés ? | Audit réel + subset (font payload −30 %) |
| 4 | `<img>` sans width/height | CLS ≈ 0 → amélioration CWV |
| 5 | Modules inline massifs (pnj 289 l, admin 109 l, bestiaire 46 l) | Extraction → HTTP cache + parse async |
| 6 | Aucun preload LCP image ou hero font | LCP −300 ms |
| 7 | Duplication NORMAL / IRP (hub-irp, gacha-irp, fiches-irp) | Fork réunifié → bundle −30 % |
| 8 | `hub.css` hardcoded rgba restants (~89) | Cohérence + compressibilité gzip |
| 9 | `hub.css` 1009 + `gacha.css` 1043 — absence de code-splitting | Extraction composants (hub-inventory.css etc) |
| 10 | Deux `page-transition.js` identiques (dont un dans /css/) | Supprimer l'orphelin (DX) |

---

## 1.3 DX

### Fichiers > 800 lignes

| Fichier | Lignes | Verdict |
|---------|--------|---------|
| `css/jaharta.css` | 2627 | Exception historique revendiquée |
| `css/gacha.css` | 1043 | ⚠ À splitter (ex: `gacha-blob.css`, `gacha-banners.css`) |
| `css/hub.css` | 1009 | ⚠ À splitter (ex: `hub-inventory.css`, `hub-shops.css`) |
| `js/gacha-logic.js` | 943 | ⚠ À splitter (auth, pity, UI, writes) |
| `js/hub-irp-core.js` | 890 | ⚠ Fork de `hub-core` — à réunifier |
| `js/fiches.js` | 884 | ⚠ À splitter (rendu, form, upload) |
| `js/gacha-irp-logic.js` | 870 | ⚠ Fork de `gacha-logic` — à réunifier |
| `js/hub-shops.js` | 845 | ⚠ À splitter (3 onglets distincts) |
| `js/hub-inventory.js` | 811 | Juste au-dessus de la limite |

### Fonctions > 50 lignes

Pas de scan exhaustif fait (coûteux), mais échantillons vus :
- `fiches.js:buildCard()` ~ 130 lignes (rendu complet carte)
- `hub-core.js:initHub()` probable > 100 lignes
- `gacha-logic.js:doPull()` probable > 80 lignes
→ **À mesurer** en Phase 2/3.

### `console.*` résiduels

**Seule occurrence légitime** : `js/debug.js:91-95` patche `console.error` pour capter les erreurs Firebase → OK.
Autres références : mention dans PROMPT-AUDIT.md (documentation) → OK.
**Convention respectée à 100 %.**

### Naming incohérent

- Variables JS FR/EN mélangées : `_unsubChars`, `_bestUnsub`, `charDoc`, `pullRef`, `loadLogs`, `renderTable`, `submitCard` (mix des deux). CLAUDE.md recommande le français — à uniformiser à la marge.
- CSS : `.cyb-panel`, `.sz-tete`, `.sz-torse` (mélange anglais/français) — cohérent avec le ton cyberpunk FR. OK.
- Fichiers JS : `hub-*.js` (kebab), `kanji-blob.js`, `jaharta-card.js` — cohérent.
- Globals window : `window._db`, `window._isAdmin`, `window.JImgCache`, `window.RACES` — mix underscore / camel / SCREAMING. À normaliser un jour (low prio).

### Fichiers orphelins (ZÉRO référence dans le site)

| Fichier | Status | Notes |
|---------|--------|-------|
| `docs/css/page-transition.js` | **Orphelin** | Identique à `docs/js/page-transition.js`. Aucun HTML ne le charge (tous pointent vers `js/`). **→ À supprimer.** |
| `docs/js/jaharta-card.js` | **Orphelin en prod** | 340 lignes. Aucun HTML ne le charge via `<script src>` et aucun autre module JS ne l'importe. CLAUDE.md affirme que la page `fiches.html` l'utilise — **CONTRADICTION** avec le code réel. Le composant `<jaharta-card>` est référencé en CSS et en sélecteur JS (`card.closest('jaharta-card')` dans `fiches.html:540`) mais le JS qui définit le custom element n'est jamais chargé → le sélecteur retourne `null` ou tombe en fallback. |
| `docs/js/card-glow.js` | **Orphelin** | 145 lignes. Aucun HTML ne le charge. Effet décrit "Fiches only" — doublon potentiel avec `jaharta-card.js` tilt logic. |

### Code dupliqué inter-fichiers

- **Branche NORMAL/IRP dupliquée** : `gacha-logic.js` ↔ `gacha-irp-logic.js`, `hub-core.js` ↔ `hub-irp-core.js`, `fiches.js` ↔ `fiches-irp.js`, `hub.html` ↔ `hub-irp.html` (~95 % identiques, diff = noms de collections Firebase et couleurs). **~3500 lignes dupliquées.** L'architecture gagnerait énormément à un `window._mode = 'normal'|'irp'` + un seul fichier avec branchement.
- **Firebase config** répété 12 fois.
- **Boilerplate `<head>`** (favicon × 3 + preconnect × 2 + fonts) dupliqué 14 fois.
- **Page transition overlay** (div `page-transition` + `img` + `pt-bar-fill` + `pt-text`) dupliqué dans les 14 pages HTML, **hardcodé en inline** au lieu d'être injecté par `page-transition.js`.
- `script.js` (landing) réimplémente un `IntersectionObserver` reveal qui est déjà dans `jaharta-motion.js`.

### Outillage manquant

- Aucun `package.json` — même pour dev tooling.
- Aucun linter (ESLint/JSHint) ni formatter (Prettier) ni stylelint configuré.
- Aucun script `npm run dev` / `npm run serve` — la doc indique `python -m http.server` à la main.
- Aucune action GitHub (CI) pour valider un minimum avant push sur `main` (qui est auto-deploy).
- Aucun `.editorconfig`.
- Aucun README.md à la racine du repo ni dans `docs/` **pour devs** (PROMPT-AUDIT.md et SITE_ARCHITECTURE.md existent mais ciblent Claude, pas un humain qui débarque).

### `SITE_ARCHITECTURE.md` utile mais incomplet

- Mentionne `gacha-blob.js / kanji-blob.js` → deux blobs différents pour gacha normal/IRP ? Besoin d'éclaircir.
- Mentionne `hub-achievements.js` → **absent de CLAUDE.md**.
- Ne mentionne pas `auth-badge.js`, `jaharta-nav.js`, `jaharta-motion.js`, `jaharta-cache.js`, `jaharta-img-cache.js`, `irp-mode.js`, `stats-caps.js`, `script.js`, `music-player.js`.

---

## 1.4 Qualité

### `sanitize()` manquant avant `innerHTML` / Firestore

Scan sur les occurrences `innerHTML =` (183 au total) :

**Points sûrs (template sans input utilisateur)** :
- `fiches.html:474, 491, 552, 553, 555, 559` : construction formulaire avec valeurs statiques ou contrôlées. `${label}` peut venir d'`openEditFiche()` → vient de Firestore → **risque XSS non confirmé, à auditer**.
- `admin.html:91` : `n`, `s`, `co`, `ico` viennent de Firestore `lore/{id}`. Escape non visible sur cette ligne.
- `admin.html:401-402, 439, 486-487, 522, 563-564, 579-582, 588, 621, 631` : plusieurs constructions avec contenu Firestore. `admin.html` contient 28 appels à `escHtml` ou `sanitize` — couverture probablement bonne mais pas à 100 %.
- `js/fiches.js:588, 671, 697` : valeurs numériques ou statiques → OK.
- `js/fiches.js:671` : `el.innerHTML = svg` où `svg` est produit quelques lignes au-dessus — à vérifier.
- `pnj.html:131, 178` : utilise `escHtml()` systématiquement → ✓.
- `bestiaire.html:488, 493, 501, 606` : idem → ✓.

**Verdict :** pas de XSS flagrant détecté (sprint 6 P2 a traité race-popup, racesjouables-logic, lore.js). Mais `admin.html` mérite un passage ligne par ligne car forte densité d'innerHTML avec data Firestore.

### Dead code suspect

- `js/jaharta-card.js` — web component défini mais jamais chargé → le tag `<jaharta-card>` dans les pages (s'il existe) est traité comme élément HTML générique.
- `js/card-glow.js` — non chargé.
- `js/script.js:initScrollReveal` — duplicata de `jaharta-motion.js` `.jh-reveal`.
- `data/irp_gacha_banners.json` — statique. Utilisé ou legacy ? À confirmer.

### Commentaires obsolètes / contradictoires

- CLAUDE.md "Structure — fichiers clés" liste **20** fichiers alors que le repo en a **>50**. Section massivement obsolète.
- CLAUDE.md parle de `hub-core.js`, `fiches.js`, `lore.js`, `racesjouables-logic.js` comme "extraits de X.html" mais ne mentionne pas `hub-irp-core.js`, `fiches-irp.js`, `gacha-irp-logic.js`, `hub-irp.js` (tout le parallèle IRP).
- CLAUDE.md "Panel Admin : onglets Fiches · PNJ · Logs" — alors que `admin.html` lignes 34 + 563 a aussi un onglet **Bestiaire**.
- CLAUDE.md "Hub joueur — 12 onglets" — mais `hub-achievements.js` (422 lignes) laisse penser qu'il existe un onglet Titres/Succès séparé, potentiellement un 13e, ou à inclure dans la liste des 12.
- Roadmap privée indique `hub.css ≈ 898` lignes alors que le fichier actuel fait **1009** lignes → drift.
- Roadmap privée indique `jaharta.css ≈ 2502` puis `≈ 2600` → actuel 2627.

### Conventions CLAUDE.md non respectées (ciblé)

| # | Fichier:ligne | Convention | Écart |
|---|---------------|-----------|-------|
| 1 | `lore.html:1` | `debug.js` en premier | Script Discord injecté avant |
| 2 | `racesjouables.html:1` | idem | idem |
| 3 | `hub-irp-core.js` (890) | fichier < 800 | dépasse |
| 4 | `fiches.js` (884) | < 800 | dépasse |
| 5 | `gacha-irp-logic.js` (870) | < 800 | dépasse |
| 6 | `hub-shops.js` (845) | < 800 | dépasse |
| 7 | `hub-inventory.js` (811) | < 800 | dépasse (de peu) |
| 8 | `css/gacha.css` (1043) | < 800 | dépasse |
| 9 | `css/hub.css` (1009) | < 800 | dépasse |
| 10 | `css/hub.css` ligne 56, 65, 79, 122, 124, 135, 161, 199, 236, 239, 247, 259, 303, 316, 320, 334, 347, 382-383, 439 (échantillon de 20 sur ~89 total) | `rgba(var(--X-rgb), a)` dans hub.css | triplets rgba hardcodés restants |
| 11 | `docs/css/page-transition.js` | Fichier JS dans dossier CSS | organisation |
| 12 | Toutes pages | `<img>` doivent avoir width/height | absent |

---

## 1.5 Sécurité

### 🚨 Critique (voir en tête)

- Script Discord injecté dans 2 HTML (XSS / supply chain).

### Haute

- **Pas de CSP** (Content Security Policy) — aucune balise `<meta http-equiv="Content-Security-Policy">`. Impossible côté GitHub Pages de définir un header HTTP, mais la meta-tag CSP fonctionne pour la majorité des contextes. Sans CSP, **le script injecté ci-dessus s'exécute sans barrière**.
- **Pas de SRI** (Subresource Integrity) sur les scripts CDN :
  - Firebase ESM (`firebase-app.js`, `firestore.js`, `auth.js`, `storage.js`)
  - Alpine.js 3.14 (admin.html)
  - SortableJS 1.15.2, Tippy.js 6, Popper.js 2, GSAP 3.12.5 (hub.html inventory)
  - Three.js (gacha)
  - Google Fonts
- **innerHTML avec données Firestore** : majoritairement protégé par `sanitize`/`escHtml`, mais admin.html doit faire l'objet d'une revue ligne par ligne (28 occurrences `escHtml`, 16 occurrences `innerHTML =` — couverture probablement à 1 ou 2 ratés).

### Moyenne

- Firestore Security Rules (`firestore.rules` à la racine, 18 989 bytes) : **non auditées ici** (fichier hors `/docs/`). À faire comme sprint dédié.
- Pas de rate-limiting côté client pour les écritures Firestore (AntiSpam existe dans utils.js mais pas systématiquement utilisé).
- `localStorage` stocke `jaharta_irp_mode` et caches — pas de données sensibles visibles, mais tout script tiers y a accès.

### Basse

- Firebase config publique (documenté dans CLAUDE.md comme acceptable — ✓).
- `compressImage()` utilisé avant upload Storage (✓).

---

## 1.6 Synthèse — Matrice impact × effort

Les 10 priorités à traiter, triées par ratio impact/effort :

| # | Problème | Impact | Effort | Priorité |
|---|---------|--------|--------|----------|
| 1 | Scripts Discord injectés dans lore.html + racesjouables.html | CRITIQUE | XS | 🔴 P0 |
| 2 | Deux `<img>` sans width/height → CLS | Haut | XS | 🟠 P0 |
| 3 | Fichier orphelin `docs/css/page-transition.js` | Faible | XS | 🟡 P1 (nettoyage) |
| 4 | `jaharta-card.js` + `card-glow.js` orphelins (485 lignes dead code OU manque d'include) | Moyen | S | 🟠 P0 (décider : charger ou supprimer) |
| 5 | CLAUDE.md désaligné avec structure réelle | Haut (DX) | S | 🟠 P1 |
| 6 | Firebase init dupliqué × 12 → factorisation | Moyen (perf + DX) | M | 🟡 P1 |
| 7 | Duplication branche NORMAL ↔ IRP (~3500 lignes) | Très haut (DX + bundle size) | L | 🟡 P2 |
| 8 | `hub.css` 89 rgba hardcodés restants | Faible | S | 🟡 P2 |
| 9 | `hub.css` 1009 + `gacha.css` 1043 — split | Moyen (maint.) | M | 🟡 P2 |
| 10 | Pas de CSP meta-tag / pas de SRI | Haut (sécu) | S | 🟠 P1 |

**Autres améliorations recensées (non-P0) :**
- Extraction modules inline `<head>` (pnj 289 l, admin 109 l, bestiaire 46 l) → fichiers dédiés.
- Préchargement font hero + image LCP.
- Split `jaharta.css` (2627 l) en thème + composants consommés conditionnellement.
- Ajouter `package.json` + ESLint + Prettier + Stylelint + `.editorconfig`.
- CI minimale GitHub Action (lint + grep secrets + check orphan scripts).
- `data/irp_gacha_banners.json` — auditer usage.
- `hub-achievements.js` + onglet Titres : remettre à jour CLAUDE.md pour refléter la réalité.
- Page transition overlay : extraire en template injecté par JS (réduit duplication HTML).

---

## Questions en suspens pour l'utilisateur (à trancher avant Phase 2)

1. **Finding critique (scripts Discord)** : veux-tu que je corrige immédiatement (hors du scope audit read-only) ou que ça passe en P0 de la roadmap ?
2. **`jaharta-card.js` / `card-glow.js`** : sont-ils censés être chargés (oubli `<script src>`) ou sont-ils bien dead code à supprimer ? Le `<jaharta-card>` apparaît encore dans les sélecteurs JS de `fiches.html`.
3. **Branche IRP** : fork complet volontaire et durable, ou objectif à moyen terme de réunification ?
4. **`PROMPT-AUDIT.md`** dans `docs/` : censé être déployé en public sur GitHub Pages, ou à déplacer hors de `docs/` ?
5. **Onglet Bestiaire admin + Titres hub** : à documenter dans CLAUDE.md ?

---

**⛔ Fin de Phase 1.** En attente de ta validation et réponses aux questions ci-dessus avant d'attaquer Phase 2 (`RESTRUCTURE.md`).
