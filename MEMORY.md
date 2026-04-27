# MEMORY.md — JahartaRP Project Memory
> Fichier de mémoire dynamique. Se met à jour après chaque session de travail significative.
> Format : décisions prises, bugs résolus, état actuel, prochaines étapes.

---

## ÉTAT ACTUEL DU PROJET
**Dernière mise à jour :** 2026-04-11 (sprints 5 + 5b — fluidité AAA + micro-interactions)
**Branche :** main
**Phase :** Sprints 1→5b terminés ✓ — Projet stabilisé et fluide

### Architecture globale
- GitHub Pages → `/docs` (auto-deploy sur `main`)
- Backend : Firebase Firestore + Storage + Auth (Google uniquement)
- Frontend : HTML5 / CSS3 / JS vanilla — zéro bundler, imports ESM depuis CDN
- Pas de framework JS sauf Alpine.js dans `admin.html` (onglets réactifs)
- Three.js + GSAP dans `gacha.html` (blob) et `hub.html` (scan silhouette)

### Fichiers clés et tailles (lignes)
| Fichier | Lignes | Statut |
|---------|--------|--------|
| `hub.html` | ~681 | ✓ (était 4042) |
| `css/hub.css` | ~898 | Extrait ✓ |
| `css/jaharta.css` | ~2600 | Source de vérité — exception justifiée |
| `css/gacha.css` | ~1043 | CSS page-spécifique |
| `js/hub-inventory.js` | 763 | Extrait ✓ + dirty-check + DocumentFragment |
| `js/hub-shops.js` | 736 | Extrait ✓ |
| `js/hub-renders.js` | 300 | Extrait ✓ |
| `js/hub-character.js` | 200 | Extrait ✓ |
| `js/hub-dashboard.js` | 121 | Extrait ✓ |
| `js/hub-core.js` | ~406 | Extrait ✓ + showTab() fade transition |
| `js/jaharta-motion.js` | ~184 | ripple, reveal, scroll-progress |
| `js/fiches.js` | 718 | Extrait ✓ |
| `js/lore.js` | 675 | Extrait ✓ |
| `js/racesjouables-logic.js` | 711 | Extrait ✓ |
| `fiches.html` | 599 | ✓ |
| `lore.html` | 620 | ✓ |
| `racesjouables.html` | 313 | ✓ |
| `pnj.html` | ~640 | ✓ |
| `portail.html` | ~330 | ✓ |
| `admin.html` | ~560 | ✓ |

---

## PROBLÈMES CRITIQUES IDENTIFIÉS

### P1 — hub.html : monolithe de 4042 lignes ✅ RÉSOLU (2026-04-09)
**Avant :** 4042 lignes tout dans un seul fichier.
**Après décomposition complète :**
- `hub.html` : 1073 lignes (−74% ✓)
- `css/hub.css` : 878 lignes (CSS extrait)
- `js/hub-inventory.js` : 763 lignes (23 fonctions inventaire : drag/drop, slots, tooltips, equip, delete)
- `js/hub-shops.js` : 736 lignes (26 fonctions Mon Shop + Alloc + Shops + Universal Shop)
- `js/hub-renders.js` : 300 lignes (renderGacha, renderParty, renderProgression, renderTitles, renderCompanions, renderShop, renderSettings, setTheme)
- `js/hub-character.js` : 200 lignes (renderFullChar + calcul stats/bonus)
- `js/hub-dashboard.js` : 121 lignes (renderDashChar, renderNoChar, renderPlayerWidgets, loadWallet)
**Ordre de chargement :** jaharta.css → hub.css → CDNs → Firebase → hub-dashboard.js → hub-character.js → hub-renders.js → hub-inventory.js → hub-shops.js → `<script>` principal

### P2 — Design system fragmenté ✅ RÉSOLU (2026-04-09)
**Fix appliqué :** `jaharta.css :root` est maintenant la source unique de vérité.
**Changements clés :**
- `--cyan: #4DA3FF` → corrigé à `#00e5ff` (vrai cyan)
- `--blue: #4DA3FF` ajouté (bleu séparé du cyan)
- `--magenta: #ff2a8a` → corrigé à `#ff006e`
- Ajout de : `--gold`, `--red`, `--green`, `--orange`, `--purple`, `--surface`, `--surface2`, `--border`, `--muted`, `--text`, `--text2`, `--text3`, `--font-h`, `--font-b`, `--font-m`, `--glow-blue`, `--glow-gold`
- Aliases legacy conservés pour compatibilité : `--bg-deep`, `--text-primary`, `--font-display`, etc.
**`:root` pages — résidu légitime :**
- `hub.html` : `--text2: #c8cde0`, `--text3: #9aa0b8` (design cyberpunk plus clair, intentionnel)
- `gacha.html` : `--bg: #030816`, `--card`, `--text2`, `--text3` (fond légèrement différent, intentionnel)
- `lore.html` : `--cyan: #00e5cc`, `--rose`, `--sidebar-w` (couleurs lore spécifiques)
- `admin.html` : `--accent`, `--dark`/`--dark2`/`--dark3` (aliases locaux), `--panel`, `--border` (blanc)
- `fiches/pnj/portail.html` : `--r-*` race colors uniquement

### P3 — Console.logs en production ✅ RÉSOLU (2026-04-09)
**Symptôme :** 18+ `console.log` natifs dans le code de prod.
**Fichiers touchés :** `admin.html`, `hub.html`, `gacha.html`, `lore.html`, `racesjouables.html`
**Fix appliqué :** Suppression de tous les `console.log`. `debug.js` intercepte les `console.error` (conservés).
**Note :** `debug.js` n'a pas d'API `.log()` — les infos de debug sont inutiles en prod. Suppression totale = bonne décision.

---

## DESIGN SYSTEM — TOKENS OFFICIELS ✅ CONSOLIDÉS (post-sprint 5)

Source unique de vérité : `jaharta.css :root`

```css
/* Fonds */
--bg: #020713  --bg2: #070d1e  --surface: #0c1228  --surface2: #0a0f22

/* Accents */
--cyan: #00e5ff  --magenta: #ff006e  --gold: #ffd60a
--blue: #4DA3FF  --violet: #8B5CF6  --purple: #6C5CE7
--red: #FF4757  --green: #44ff88  --orange: #ff9800

/* Lueurs */
--glow-sm  --glow-md  --glow-lg  --glow-violet
--cyan-glow  --violet-glow  --glow-blue  --glow-gold

/* Texte */
--text: #e2e6f0  --text2: #7c84a0  --text3: #3a4060  --muted: #5a7a90

/* Polices */
--font-h: Orbitron  --font-b: Rajdhani
--font-body: Exo 2  --font-m: Share Tech Mono

/* Animations (NOUVEAUX — sprint 5) */
--dur-instant: 80ms   --dur-fast: 150ms   --dur-normal: 250ms
--dur-slow: 400ms     --dur-xslow: 600ms
--ease-out-expo: cubic-bezier(0.16,1,0.3,1)
--ease-in-out:   cubic-bezier(0.4,0,0.2,1)
--ease-spring:   cubic-bezier(0.34,1.56,0.64,1)
--ease-decel:    cubic-bezier(0,0,0.2,1)
--ease-sharp:    cubic-bezier(0.4,0,0.6,1)
```

**Variables INTERDITES** (supprimées du `:root`, ne plus utiliser) :
`--dark`, `--dark2`, `--bg-deep`, `--bg-dark`, `--bg-surface`, `--bg-card`,
`--text-primary`, `--text-secondary`, `--text-dim`, `--font-display`, `--font-heading`

### Classes utilitaires `.jh-*` (jaharta.css + jaharta-motion.js)
| Classe | Effet |
|--------|-------|
| `.jh-press` | scale 0.95 au clic (CSS pur, appliqué par jaharta-motion.js) |
| `.jh-ripple` / `.jh-ripple-wave` | onde radiale au clic (JS) |
| `.jh-glass` | glassmorphism backdrop-filter blur(18px) |
| `.jh-reveal` + `.revealed` | IntersectionObserver fade-in depuis le bas |
| `.jh-hover-glow` | box-shadow cyan au hover |
| `.jh-tab-panel` | animation fade-in 250ms changement d'onglet |
| `.jh-skeleton-pulse` | pulse opacity pour skeletons |

---

## DÉCISIONS ARCHITECTURALES

| Date | Décision | Raison |
|------|----------|--------|
| 2026-04-09 | Audit initial sans modification de code | Comprendre avant de toucher |
| 2026-04-09 | Navbar partagée via `jaharta-nav.js` (vanilla JS, pas de fetch) | GitHub Pages = statique, pas de SSI. JS synchrone après placeholder div évite tout flash. |
| 2026-04-09 | gacha.html : 4 fichiers extraits, gacha.html garde l'INIT section | L'INIT dépend de FX + loadAndShow — court (74L), logique d'orchestration pure. |
| 2026-04-09 | `sleep()` défini dans gacha-fx.js, appelé dans gacha-logic.js | Safe car JS résout les refs globales au runtime, pas au chargement. Ordre : logic avant fx, mais appels dans function bodies. |
| 2026-04-09 | Jamais remplacer HTML imbriqué avec regex `.*?</div>` | Voir BUG-01 — utiliser toujours un parser ou regex avec comptage de depth. |

## RÈGLES ANTI-RÉGRESSION (issues des bugs trouvés)

1. **Toujours vérifier les résidus après migration nav** : `grep -n "menu-link" docs/*.html | grep -v "css\|jaharta-nav"` → doit retourner 0 résultat.
2. **Vérifier les 3 scripts core sur chaque page** : `debug.js`, `constants.js`, `utils.js` présents dans les 9 pages.
3. **Après toute extraction JS** : vérifier que les fonctions cross-files ne sont appelées qu'à l'intérieur de `function` bodies (pas au top-level).
4. **Regex HTML** : pour capturer une `<div>` avec contenu imbriqué, utiliser Python `html.parser` ou BeautifulSoup, jamais `.*?</div>`.

---

## BUGS RÉSOLUS (audit session 3 — 2026-04-09)

### BUG-01 [CRITIQUE] — Nav mobile-menu résiduel sur 5 pages ✅ RÉSOLU
**Problème :** Les 5 pages (index, fiches, pnj, portail, racesjouables) avaient 9-10 lignes
de `<a class="menu-link">` orphelins après `<script src="js/jaharta-nav.js">`.
**Cause racine :** La regex de `migrate_nav.py` utilisait `.*?</div>` non-greedy + re.DOTALL.
Elle s'arrêtait au 1er `</div>` imbriqué (`menu-header-label`), laissant les `<a>` et les
`</div>` fermants du `menu-inner` et `mobile-menu` en dehors du match.
**Correction :** `fix_nav_residuals.py` — regex avec lookahead jusqu'au prochain élément HTML
de page (ni `<a>`, ni `<script>`, ni `<div class="menu`). Résidu supprimé sur 5/5 pages.
**Vérification :** grep `menu-link` résiduel = 0/7 pages. ✓
**Règle post-mortem :** Ne JAMAIS remplacer du HTML avec des divs imbriquées par une regex
`.*?</div>`. Utiliser un parser HTML ou une regex récursive avec comptage de profondeur.

### BUG-02 [CRITIQUE] — hub.html manquait debug.js + constants.js ✅ RÉSOLU
**Problème :** hub.html ne chargeait ni `debug.js` ni `constants.js`.
**Cause racine :** Lors de la décomposition de hub.html en 6 fichiers, ces 2 scripts core
n'ont pas été vérifiés (ils existaient dans les autres pages mais pas hub.html original).
**Correction :** Ajout de `debug.js` + `constants.js` avant les scripts Firebase dans hub.html.
**Vérification :** Tous les scripts core présents sur 9/9 pages. ✓

### BUG-03 [RÉSOLU ANTÉRIEUR] — Nav résiduel lore.html + gacha.html
Nav sur une seule ligne — même cause que BUG-01, corrigé manuellement sur ces 2 fichiers.

### BUG-05 [VISUAL] — racesjouables.html CSS block dupliqué ✅ RÉSOLU (2026-04-09)
**Problème :** Le fichier avait deux blocs `<style>` fusionnés (/* PREVIEW */ + /* ORIGINAL */).
Le bloc ORIGINAL (après) overridait `.nav-logo` sans `display:flex` → logo image + texte mal alignés.
**Correction :** Suppression du bloc ORIGINAL (lignes 63-113). Seul le bloc PREVIEW est conservé.

### BUG-06 [VISUAL] — html element sans background ✅ RÉSOLU (2026-04-09)
**Problème :** jaharta.css `body { background: var(--bg-deep) }` overridé par inline `body { background:transparent }` sur toutes les pages. html sans background → canvas blanc avant kanji-blob.js.
**Correction :** `html { background: var(--bg-deep) }` ajouté dans jaharta.css — fallback si WebGL échoue.

## RÉSULTATS AUDIT COMPLET (2026-04-09)
| Check | Résultat |
|-------|----------|
| Fonctions dupliquées entre fichiers | 0 ✓ |
| Variables globales au top-level (unsafe) | 0 ✓ |
| Références cross-files (runtime-safe) | Toutes dans function bodies ✓ |
| @keyframes résiduels | 0/7 pages ✓ |
| debug.js présent | 9/9 pages ✓ |
| constants.js présent | 9/9 pages ✓ |
| Nav résiduel mobile-menu | 0/7 pages ✓ |
| Ordre chargement scripts correct | ✓ |

---

## SPRINTS TERMINÉS

| Sprint | Contenu | Date |
|--------|---------|------|
| 1 | console.* → _dbg, alert → showToast, fuites mémoire, race conditions | 2026-04-09/10 |
| 2 | hub.html décomposé (4042 → 681L), CSS tokens unifiés, onSnapshot orphelins corrigés | 2026-04-09/10 |
| 3 | fiches.html (1301→599L), lore.html (1296→620L), racesjouables.html (1025→313L) extraits | 2026-04-10 |
| 4 | Typographie Crystal Clear — variables `--fs-*` dans hub.css | 2026-04-10 |
| 5 | RAF throttle tilt (jaharta-card.js — **fichier supprimé 2026-04-18, orphelin**), dirty-check + DocumentFragment (hub-inventory.js), token system animation (jaharta.css) | 2026-04-11 |
| 5b | jaharta-motion.js créé + 9 pages, showTab() fade transition + guard re-render (hub-core.js) | 2026-04-11 |

## PROCHAINES ÉTAPES

1. **Skeleton inventory** — remplacer le vide du chargement initial de l'inventaire par des `.inv-item` skeleton pulsants (`.jh-skeleton-pulse`)
2. **Lazy-load images cartes** — IntersectionObserver sur les `<jaharta-card>` pour ne charger Firebase Storage qu'au scroll
3. **Toast animations** — câbler les keyframes `jh-toast-in/out` dans `showToast()` de `utils.js`
4. **Lore cards unification** — migrer `.lore-card.visible` vers `.jh-reveal` pour uniformiser les systèmes de reveal
5. **Features UI** — nouvelles fonctionnalités demandées

---

## NOTES TECHNIQUES IMPORTANTES

### Firebase — ce qui fonctionne
- Auth Google uniquement côté admin (whitelist `admins/{uid}`)
- `onSnapshot()` temps réel sur toutes les pages publiques
- `jaharta-img-cache.js` : cache localStorage 24h pour URLs Firebase Storage

### Dépendances CDN (ne pas casser)
- GSAP 3.12.5 (hub.html uniquement via CDN cdnjs)
- SortableJS 1.15.2 (hub.html — drag & drop inventaire)
- Tippy.js 6 + Popper.js 2 (hub.html — tooltips)
- Alpine.js 3.14 (admin.html uniquement)
- Three.js (gacha.html — blob)

### Lazy loading onglets hub (Sprint 3 Piste 3)
- `CURRENT_TAB='dashboard'` — variable globale dans hub.html
- `showTab(id)` met à jour `CURRENT_TAB=id` avant d'appeler `LAZY[id]()`
- `_refreshCurrentTab()` — appelé à la fin de `loadCharacter()` et `loadPlayer()` pour re-rendre l'onglet actif si non-dashboard
- `LAZY{}` map : seuls dashboard + personnage se chargent selon l'onglet actif au boot
- **Règle** : ne jamais appeler `renderFullChar()`, `renderProgression()`, `renderGacha()`, `renderSettings()` directement dans loadCharacter/loadPlayer — laisser LAZY le faire

### Ordre d'inclusion des scripts (OBLIGATOIRE)
```
debug.js → constants.js → utils.js → <script type="module">
```

### Globals window exposés par les modules Firebase
`window._db`, `window._storage`, `window._isAdmin`, `window._doc`, `window._updateDoc`, `window._deleteDoc`

### Sécurité — points névralgiques
- `sanitize()` doit être appelé sur TOUS les inputs avant Firestore
- `compressImage()` avant tout upload Firebase Storage
- `AntiSpam.canSubmit()` avant toute soumission de fiche
