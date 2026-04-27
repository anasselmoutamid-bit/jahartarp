# RESTRUCTURE.md — Proposition de réorganisation

> **Phase 2 — Proposition, en attente de validation.** Aucun fichier de ce plan n'a été déplacé.
> Rédigé après Phase 1 ([AUDIT.md](AUDIT.md)) et réponses utilisateur : **IRP = fork permanent, factoriser les parties communes**.

---

## Principes directeurs

1. **Zéro régression.** GitHub Pages déploie `/docs` en racine ; chaque lien interne (`js/x.js`, `css/y.css`, `img/z.png`) doit continuer à résoudre.
2. **Pas de bundler.** Tout reste servable via `python3 -m http.server` sans build.
3. **Grouper par domaine, pas par type.** Un dev qui touche "gacha" doit trouver HTML + JS + CSS + fixtures au même endroit.
4. **Factoriser les communs NORMAL/IRP** (layout, nav, tokens, utils) ; **isoler les spécificités IRP** dans un sous-dossier dédié.
5. **Migration incrémentale.** 1 domaine = 1 commit. Test manuel entre chaque étape. Rollback git trivial.
6. **Rien ne casse à chaud.** Priorité au déplacement + mise à jour des `<script src>`, pas à la refonte du code.

---

## Structure cible

```
/  (racine repo)
├── .claude/                        Config agent + skills + PROMPT-AUDIT.md
├── CLAUDE.md                       Conventions projet (mis à jour Phase 3)
├── README.md                       Doc humaine
├── firestore.rules                 Règles sécurité Firebase
│
└── docs/                           Racine GitHub Pages (obligatoire)
    ├── CNAME
    ├── index.html                  Accueil NORMAL
    ├── AUDIT.md                    Snapshot Phase 1 (archive)
    ├── RESTRUCTURE.md              Ce fichier (à archiver post-migration)
    │
    ├── pages/                      ⭐ Toutes les pages HTML sauf index
    │   ├── fiches.html
    │   ├── pnj.html
    │   ├── portail.html
    │   ├── lore.html
    │   ├── racesjouables.html
    │   ├── bestiaire.html
    │   ├── gacha.html
    │   ├── hub.html
    │   └── admin.html
    │
    ├── irp/                        ⭐ Branche IRP isolée (fork permanent)
    │   ├── index-irp.html
    │   ├── fiches-irp.html
    │   ├── gacha-irp.html
    │   └── hub-irp.html
    │
    ├── features/                   ⭐ Logique métier par domaine
    │   ├── fiches/
    │   │   ├── fiches.js
    │   │   └── fiches-irp.js
    │   ├── gacha/
    │   │   ├── gacha-logic.js
    │   │   ├── gacha-irp-logic.js
    │   │   ├── gacha-blob.js
    │   │   └── gacha-fx.js
    │   ├── hub/
    │   │   ├── hub-core.js
    │   │   ├── hub-irp-core.js
    │   │   ├── hub-irp.js
    │   │   ├── hub-dashboard.js
    │   │   ├── hub-character.js
    │   │   ├── hub-inventory.js
    │   │   ├── hub-renders.js
    │   │   ├── hub-shops.js
    │   │   └── hub-achievements.js
    │   ├── lore/
    │   │   └── lore.js
    │   ├── races/
    │   │   ├── racesjouables-logic.js
    │   │   └── race-popup.js
    │   └── admin/
    │       └── (modules extraits de admin.html — voir Phase 5)
    │
    ├── shared/                     ⭐ Code mutualisé NORMAL + IRP
    │   ├── lib/
    │   │   ├── utils.js            sanitize, escHtml, compressImage, AntiSpam, showToast, Skeleton
    │   │   ├── constants.js        RACES, RANKS, RACES_SPECIFIC
    │   │   ├── debug.js            window._dbg
    │   │   ├── jaharta-cache.js    onSnapshotCached + unsub tracking
    │   │   ├── jaharta-img-cache.js localStorage TTL 24h
    │   │   ├── stats-caps.js
    │   │   └── irp-mode.js         flag localStorage + redirections
    │   ├── components/
    │   │   ├── jaharta-nav.js      navbar injectée
    │   │   ├── music-player.js
    │   │   ├── page-transition.js
    │   │   ├── kanji-blob.js       Three.js blob (gacha + hub)
    │   │   ├── auth-badge.js
    │   │   └── jaharta-motion.js   micro-interactions
    │   └── data/
    │       └── (fixtures JSON / seed data si existent)
    │
    ├── styles/                     ⭐ CSS
    │   ├── tokens.css              ⭐ NOUVEAU — extrait du :root de jaharta.css (variables globales)
    │   ├── jaharta.css             Thème de base (post-extraction tokens)
    │   ├── hub.css
    │   ├── hub-achievements.css
    │   ├── gacha.css
    │   ├── bestiaire-card.css
    │   └── irp-theme.css           Overrides visuels IRP
    │
    ├── script.js                   ⚠ Landing-only — reste à la racine ou déplacé dans features/landing/
    │
    └── assets/
        ├── img/                    ⭐ Fusion img/ + assets/ existants
        │   ├── banner.png
        │   ├── logo-jaharta.png
        │   ├── favicon.ico
        │   ├── favicon-32.png
        │   ├── favicon-180.png
        │   └── map-holographic.png
        └── data/                   (contenu actuel de docs/data/)
```

---

## Mapping ancien → nouveau

| Ancien chemin | Nouveau chemin | Notes |
|---|---|---|
| `docs/fiches.html` | `docs/pages/fiches.html` | `<script src>` mis à jour |
| `docs/pnj.html` | `docs/pages/pnj.html` | idem |
| `docs/portail.html` | `docs/pages/portail.html` | idem |
| `docs/lore.html` | `docs/pages/lore.html` | idem (hors script Discord laissé en P0 roadmap) |
| `docs/racesjouables.html` | `docs/pages/racesjouables.html` | idem (hors script Discord) |
| `docs/bestiaire.html` | `docs/pages/bestiaire.html` | idem |
| `docs/gacha.html` | `docs/pages/gacha.html` | idem |
| `docs/hub.html` | `docs/pages/hub.html` | idem |
| `docs/admin.html` | `docs/pages/admin.html` | idem |
| `docs/index.html` | reste à la racine | point d'entrée GitHub Pages |
| `docs/index-irp.html` | `docs/irp/index-irp.html` | toggle IRP footer → redirection vers `irp/index-irp.html` |
| `docs/fiches-irp.html` | `docs/irp/fiches-irp.html` | |
| `docs/gacha-irp.html` | `docs/irp/gacha-irp.html` | |
| `docs/hub-irp.html` | `docs/irp/hub-irp.html` | |
| `docs/js/fiches.js` | `docs/features/fiches/fiches.js` | |
| `docs/js/fiches-irp.js` | `docs/features/fiches/fiches-irp.js` | |
| `docs/js/gacha-logic.js` | `docs/features/gacha/gacha-logic.js` | |
| `docs/js/gacha-irp-logic.js` | `docs/features/gacha/gacha-irp-logic.js` | |
| `docs/js/gacha-blob.js` | `docs/features/gacha/gacha-blob.js` | |
| `docs/js/gacha-fx.js` | `docs/features/gacha/gacha-fx.js` | |
| `docs/js/hub-core.js` | `docs/features/hub/hub-core.js` | |
| `docs/js/hub-irp-core.js` | `docs/features/hub/hub-irp-core.js` | |
| `docs/js/hub-irp.js` | `docs/features/hub/hub-irp.js` | |
| `docs/js/hub-dashboard.js` | `docs/features/hub/hub-dashboard.js` | |
| `docs/js/hub-character.js` | `docs/features/hub/hub-character.js` | |
| `docs/js/hub-inventory.js` | `docs/features/hub/hub-inventory.js` | |
| `docs/js/hub-renders.js` | `docs/features/hub/hub-renders.js` | |
| `docs/js/hub-shops.js` | `docs/features/hub/hub-shops.js` | |
| `docs/js/hub-achievements.js` | `docs/features/hub/hub-achievements.js` | |
| `docs/js/lore.js` | `docs/features/lore/lore.js` | |
| `docs/js/racesjouables-logic.js` | `docs/features/races/racesjouables-logic.js` | |
| `docs/js/race-popup.js` | `docs/features/races/race-popup.js` | |
| `docs/js/utils.js` | `docs/shared/lib/utils.js` | |
| `docs/js/constants.js` | `docs/shared/lib/constants.js` | |
| `docs/js/debug.js` | `docs/shared/lib/debug.js` | |
| `docs/js/jaharta-cache.js` | `docs/shared/lib/jaharta-cache.js` | |
| `docs/js/jaharta-img-cache.js` | `docs/shared/lib/jaharta-img-cache.js` | |
| `docs/js/stats-caps.js` | `docs/shared/lib/stats-caps.js` | |
| `docs/js/irp-mode.js` | `docs/shared/lib/irp-mode.js` | |
| `docs/js/jaharta-nav.js` | `docs/shared/components/jaharta-nav.js` | |
| `docs/js/music-player.js` | `docs/shared/components/music-player.js` | |
| `docs/js/page-transition.js` | `docs/shared/components/page-transition.js` | |
| `docs/js/kanji-blob.js` | `docs/shared/components/kanji-blob.js` | |
| `docs/js/auth-badge.js` | `docs/shared/components/auth-badge.js` | |
| `docs/js/jaharta-motion.js` | `docs/shared/components/jaharta-motion.js` | |
| `docs/js/script.js` | `docs/features/landing/script.js` (ou racine) | landing-only |
| `docs/css/jaharta.css` | `docs/styles/jaharta.css` | `:root` extrait dans `tokens.css` |
| `docs/css/hub.css` | `docs/styles/hub.css` | |
| `docs/css/hub-achievements.css` | `docs/styles/hub-achievements.css` | |
| `docs/css/gacha.css` | `docs/styles/gacha.css` | |
| `docs/css/bestiaire-card.css` | `docs/styles/bestiaire-card.css` | |
| `docs/css/irp-theme.css` | `docs/styles/irp-theme.css` | |
| `docs/img/*` | `docs/assets/img/*` | fusion avec dossier assets existant |
| `docs/assets/map-holographic.png` | `docs/assets/img/map-holographic.png` | |
| `docs/data/` | `docs/assets/data/` | |
| `docs/PROMPT-AUDIT.md` | `.claude/PROMPT-AUDIT.md` | ✅ **déjà fait** |
| `docs/css/page-transition.js` | supprimé | ✅ **déjà fait** (doublon) |
| `docs/js/card-glow.js` | supprimé | ✅ **déjà fait** (orphelin) |
| `docs/js/jaharta-card.js` | supprimé | ✅ **déjà fait** (orphelin, `.closest` nettoyé dans fiches.html + fiches-irp.html) |

---

## Plan de migration incrémentale

Chaque étape = **1 commit atomique + test manuel** (page chargée en localhost:8080, console sans erreur, feature principale testée).

### Sprint R1 — Préparation (sans casse)
1. Créer la nouvelle arborescence vide (`pages/`, `irp/`, `features/…`, `shared/…`, `styles/`, `assets/img/`).
2. Commit.

### Sprint R2 — Assets (safe, risque = broken images)
3. Déplacer `img/*` → `assets/img/*`.
4. Déplacer `assets/map-holographic.png` → `assets/img/map-holographic.png`.
5. Déplacer `data/` → `assets/data/`.
6. Grep global `src="img/"`, `src="assets/"`, `background-image: url(img/` → remplacer.
7. **Test** : ouvrir chaque page, vérifier images + favicons + fonts externes.
8. Commit.

### Sprint R3 — CSS
9. Déplacer `css/*.css` → `styles/*.css`.
10. Grep global `href="css/"` → `href="styles/"` (dans les 14 HTML).
11. **Test** : thèmes appliqués, pas de FOUC majeur.
12. Commit.
13. (Bonus) Extraire `:root` de `jaharta.css` vers `styles/tokens.css` + ajouter `@import url('tokens.css');` en tête de `jaharta.css`. Test.
14. Commit.

### Sprint R4 — Shared lib + components
15. Déplacer `js/utils.js`, `constants.js`, `debug.js`, `jaharta-cache.js`, `jaharta-img-cache.js`, `stats-caps.js`, `irp-mode.js` → `shared/lib/`.
16. Déplacer `js/jaharta-nav.js`, `music-player.js`, `page-transition.js`, `kanji-blob.js`, `auth-badge.js`, `jaharta-motion.js` → `shared/components/`.
17. Grep global `src="js/utils.js"` etc. → remplacer par nouveaux chemins dans les 14 HTML.
18. **Test** : navbar, toast, cache images, transition, blob gacha, debug logger.
19. Commit.

### Sprint R5 — Features par domaine (1 feature = 1 commit)
20. **fiches/** : déplacer `fiches.js`, `fiches-irp.js` → `features/fiches/`. MAJ HTML. Test. Commit.
21. **gacha/** : déplacer les 4 fichiers gacha. MAJ HTML. Test. Commit.
22. **hub/** : déplacer les 9 fichiers hub. MAJ HTML. Test. Commit.
23. **lore/** : déplacer `lore.js`. Test. Commit.
24. **races/** : déplacer `racesjouables-logic.js`, `race-popup.js`. Test. Commit.
25. **script.js** : décider landing/ ou racine. Test. Commit.

### Sprint R6 — Pages
26. Déplacer `pnj.html`, `portail.html`, `lore.html`, `racesjouables.html`, `bestiaire.html`, `gacha.html`, `hub.html`, `admin.html`, `fiches.html` → `pages/`.
27. Dans chacun : ajuster TOUS les chemins relatifs (`../shared/lib/utils.js`, `../styles/jaharta.css`, `../assets/img/logo-jaharta.png`, etc.).
28. Dans `index.html` (reste à la racine) : mettre à jour tous les `<a href="fiches.html">` → `<a href="pages/fiches.html">`.
29. Dans `shared/components/jaharta-nav.js` : mettre à jour `PAGES_NORMAL` et `PAGES_IRP` avec nouveaux chemins.
30. **Test page par page.** Commit une page à la fois.

### Sprint R7 — Branche IRP
31. Déplacer `index-irp.html`, `fiches-irp.html`, `gacha-irp.html`, `hub-irp.html` → `irp/`.
32. Ajuster leurs chemins relatifs (`../shared/…`, `../features/…`, `../styles/…`).
33. Dans `index.html` : toggle IRP (footer ◆) → redirection vers `irp/index-irp.html`.
34. Dans `irp-mode.js` : ajuster les redirections inter-pages IRP.
35. **Test chaque page IRP.** Commit par page.

### Sprint R8 — Nettoyage final
36. Supprimer les dossiers vides `docs/js/`, `docs/css/`, `docs/img/`.
37. Mettre à jour `CLAUDE.md` § Structure (Phase 3).
38. Mettre à jour `README.md` § arborescence (Phase 3).
39. Mettre à jour `memory/project_jaharta.md` (Phase 4).
40. Commit final.

---

## Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Chemin `<script src>` cassé → page blanche en prod | Moyenne | Haut (site HS) | Test manuel page-par-page en localhost avant push. Push sur `main` après chaque sprint uniquement après test. |
| Chemin CSS cassé → FOUC / thème cassé | Moyenne | Moyen | Test visuel. `jaharta.css` importe `tokens.css`. |
| Chemin image cassé | Haute | Bas | Grep exhaustif (`img/`, `./img/`, `../img/`, url('img'`, `url("img"`, `url(img`). |
| `jaharta-nav.js` liste des pages obsolète | Certaine | Moyen (404) | Sprint R6 étape 29 : MAJ explicite de `PAGES_NORMAL`/`PAGES_IRP`. |
| `irp-mode.js` redirections cassées | Haute | Moyen (boucles) | Sprint R7 étape 34 : test chaque toggle NORMAL⇄IRP. |
| Liens externes (Discord, réseaux) pointent sur ancien chemin | Faible | Faible | Les domaines externes pointent sur `/` et `/fiches.html` ; garder un redirect JS dans anciens fichiers ? **Décision à prendre.** |
| Firebase Storage URL stockées → casse si images locales | N/A | Faible | Les URLs de cache pointent vers `firebasestorage.googleapis.com`, pas `/img/`. OK. |
| GitHub Pages cache CDN | Certaine | Faible | Purge automatique sous 10 min. Pas de mitigation. |
| Hook pre-commit/post-commit touche vieux chemins | Faible | Faible | Vérifier `.claude/settings.json` hooks après R8. |

---

## Points ouverts nécessitant décision utilisateur

1. **`docs/index.html`** reste à la racine de `/docs` ? (oui par défaut GitHub Pages). ✅ **supposé oui**
2. **`docs/script.js`** (landing-only) : `features/landing/script.js` ou reste à côté de `index.html` ? → **recommandation : `features/landing/`**
3. **Redirects anciens chemins** : ajouter des pages stub `fiches.html` → `pages/fiches.html` pour SEO/liens externes, ou casser proprement ? → **recommandation : casser (zéro ambiguïté, pas de SEO à préserver sur un site communautaire)**
4. **`AUDIT.md` et `RESTRUCTURE.md`** dans `/docs` final : archiver dans `.claude/archive/` après migration, ou garder en racine `/docs` comme historique ? → **recommandation : archiver dans `.claude/archive/`**
5. **Tokens CSS** (étape 13-14) : opt-in dans ce sprint ou report en P1 roadmap ? → **recommandation : report P1 (hors périmètre restructure)**
6. **Factorisation NORMAL/IRP** (layout, nav) via Web Components : inclure dans cette restructure ou Sprint séparé ? → **recommandation : Sprint séparé post-restructure (le but ici est de déplacer, pas de refactorer)**

---

## Estimation effort

| Sprint | Effort | Risque |
|---|---|---|
| R1 préparation | XS | 🟢 |
| R2 assets | S | 🟢 |
| R3 CSS | S | 🟡 |
| R4 shared | M | 🟡 |
| R5 features (par domaine) | L | 🟡 |
| R6 pages | L | 🔴 (le plus gros risque — tous les chemins relatifs) |
| R7 IRP | M | 🟡 |
| R8 nettoyage | S | 🟢 |

**Total : ~L-XL** sur le seul déplacement. Zéro refactor logique inclus — tout ça ne fait que déplacer et mettre à jour les chemins.

---

⛔ **Fin Phase 2.** En attente de ta validation sur :
- la structure cible proposée,
- les 6 points ouverts ci-dessus,
- le fait d'exécuter R1→R8 en séquence (ou un sous-ensemble).

Rien ne bouge tant que tu n'as pas validé.
