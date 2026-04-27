# MD-AUDIT.md — Audit documentation Markdown

> **Phase 3** — Audit des fichiers `.md` du projet. Applique directement les correctifs obligatoires sur `CLAUDE.md`, `README.md` et `memory/*`.
> Les suppressions / déplacements proposés ici restent en attente de validation utilisateur.

---

## Inventaire

| Fichier | Lignes | Rôle | État |
|---|---|---|---|
| `CLAUDE.md` | 262 | Conventions projet + guide Claude Code | **Stale** — refs à fichiers supprimés |
| `README.md` | 518 | Doc humaine publique | **Très stale** — branche IRP absente, refs supprimés, structure obsolète |
| `MEMORY.md` (racine) | 253 | Vieille mémoire session avant système `.claude/projects/…/memory/` | **Obsolète** — doublon fonctionnel avec `memory/` → archiver ou supprimer |
| `SITE_ARCHITECTURE.md` (racine) | 54 | Guide rapide architecture | **Doublon exact** avec `docs/SITE_ARCHITECTURE.md` |
| `docs/SITE_ARCHITECTURE.md` | 54 | idem | Canonique (dans `/docs`) |
| `docs/AUDIT.md` | 406 | Snapshot Phase 1 | ✅ OK (archive post-migration) |
| `docs/RESTRUCTURE.md` | 200+ | Proposition Phase 2 | ✅ OK (archive post-migration) |
| `docs/MD-AUDIT.md` | ce fichier | Phase 3 | ✅ en cours |
| `.claude/PROMPT-AUDIT.md` | ~100 | Spec prompt agent | ✅ OK (déplacé Phase 2) |
| `.claude/agents/*.md` | 4 fichiers | Agents custom | Non audité (hors scope) |
| `memory/MEMORY.md` | 3 | Index mémoire Claude | **Pointeurs à rafraîchir** |
| `memory/project_jaharta.md` | 87 | État projet (design system, fichiers clés) | **Stale** — tailles, refs supprimés |
| `memory/project_roadmap.md` | 140 | Roadmap sprints 1-6 | **Archive** — sprints terminés, P7-P10 à reconsidérer (Phase 4) |

---

## Contradictions détectées

### CLAUDE.md

| Ligne | Contenu actuel | Problème | Correction |
|---|---|---|---|
| 19 | `Web Component \| <jaharta-card> — js/jaharta-card.js` | Fichier supprimé Phase 2 | Supprimer la ligne |
| 42 | `├── jaharta-card.js Web Component <jaharta-card> (tilt 3D, scramble, sparkle)` | Fichier supprimé | Supprimer la ligne |
| 116 | `fc_{id} — fiches joueurs (fiches.html, jaharta-card.js)` | Ref à fichier supprimé | → `fc_{id} — fiches joueurs (fiches.html, fiches.js)` |
| 253 | `js/jaharta-card.js _render() pour l'affichage` | Fichier supprimé | Supprimer l'étape, fusionner 2→3 |
| § 25-57 | Structure dossiers | Manque ~20 fichiers : `bestiaire.html`, `index-irp.html`, `hub-irp.html`, `gacha-irp.html`, `fiches-irp.html`, `jaharta-nav.js`, `jaharta-cache.js`, `irp-mode.js`, `stats-caps.js`, `auth-badge.js`, `hub-character.js`, `hub-achievements.js`, `hub-irp-core.js`, `hub-irp.js`, `gacha-blob.js`, `gacha-fx.js`, `gacha-logic.js`, `gacha-irp-logic.js`, `fiches.js`, `fiches-irp.js`, CSS `hub-achievements.css`, `irp-theme.css`, `bestiaire-card.css`, `gacha.css` | Réécrire l'arbo |
| § 160-169 | Panel admin onglets | Selon `admin.html` (660 lignes) il existe un onglet **Bestiaire** (au moins les refs dans pnj.html + onSnapshot). À confirmer avant doc. | Vérifier + mettre à jour |
| Absent | Branche IRP | Non documentée dans CLAUDE.md | Ajouter une section "Branche IRP (fork permanent)" |

### README.md

| Ligne | Problème | Correction |
|---|---|---|
| 37-38 | `<jaharta-card>` + `js/jaharta-card.js` | Supprimer ligne Composant carte |
| 49-94 | Arborescence obsolète (~50% manquant, branche IRP absente) | Réécriture complète alignée sur [RESTRUCTURE.md](RESTRUCTURE.md) cible OU état actuel |
| 68 | `jaharta-card.js` dans tree | Supprimer |
| 112-118 | Ordre scripts : mentionne `jaharta-motion.js` OK mais manque `jaharta-nav.js`, `jaharta-cache.js` | Compléter |
| 122-125 | `import '/js/jaharta-card.js'` dans fiches.html | Supprimer ce bloc |
| 286 | `voir UPDATES.md` | Fichier inexistant dans le repo | Supprimer la ref ou remplacer |
| 476 | `docs/js/jaharta-card.js méthode _render()` | Fichier supprimé | Supprimer l'étape |
| Absent | Branche IRP | Ajouter |
| Absent | `bestiaire.html` | Ajouter à la table des pages |
| § 502-513 | Conventions | Cohérent avec CLAUDE.md, OK |

### MEMORY.md (racine du repo)

| Ligne | Problème | Correction |
|---|---|---|
| 33 | `js/jaharta-card.js \| 321 \| RAF throttle tilt ✓` | Fichier supprimé | Supprimer ligne |
| 208 | `Sprint 5 ... RAF throttle tilt (jaharta-card.js)` | Fichier supprimé | Marquer "(historique — fichier supprimé 2026-04-18)" |
| Global | Ce fichier fait doublon avec `memory/project_jaharta.md` + `memory/project_roadmap.md` stockés dans `.claude/projects/…/memory/` | **Décision** : soit archiver en `.claude/archive/MEMORY-old.md`, soit conserver comme log public. Recommandation : **archiver** car la source de vérité est maintenant `memory/`. |

### memory/project_jaharta.md

| Ligne | Problème | Correction |
|---|---|---|
| 77 | `jaharta-card.js — tilt RAF throttle` dans liste "Fichiers JS clés" | Supprimer |
| 84-87 | `File sizes` → valeurs obsolètes : `hub.html=681` (réel 694), `fiches.html=599` (réel 602), `lore.html=620` (réel 621), `racesjouables.html=313` (réel 315), `jaharta.css≈2600` (non vérifié), `fiches.js=701` (réel 718), `lore.js=675` (réel 676), `racesjouables-logic.js=711` (confirmé), `jaharta-motion.js≈160` (réel 184) | Mettre à jour |
| Absent | Branche IRP, fichiers IRP (`hub-irp.js`, `gacha-irp-logic.js`, etc.), `jaharta-nav.js`, `irp-mode.js` | Ajouter section "Branche IRP" |
| Description frontmatter | `post-sprints 1-5` | → `post-sprints 1-6 + Phase 1-3 audit 2026-04-18` |

### memory/MEMORY.md (index)

| Ligne | Problème | Correction |
|---|---|---|
| 3 | Description project_jaharta | Rafraîchir |
| 4 | Description project_roadmap | Rafraîchir (post archivage Phase 4) |
| Absent | Pas d'entrée pour `project_audit_20260418.md` (snapshot Phase 1) si on en crée un | À voir Phase 4 |

### memory/project_roadmap.md

Marqué archive. Mise à jour complète reportée en **Phase 4** (création d'un roadmap neuf reflétant le post-audit).

### SITE_ARCHITECTURE.md — Doublon

Deux fichiers strictement identiques (`diff` retourne 0) :
- `SITE_ARCHITECTURE.md` (racine)
- `docs/SITE_ARCHITECTURE.md`

**Décision** : garder **un seul**. Recommandation : garder `docs/SITE_ARCHITECTURE.md` (cohérent avec CLAUDE.md qui vit aussi au niveau pertinent). Supprimer la copie racine.

---

## Sections manquantes à ajouter

### CLAUDE.md
1. **Section "Branche IRP (fork permanent assumé)"** — décision utilisateur Phase 2. Lister les 4 pages IRP + collections `irp_*` + ticket d'entrée (bouton ◆ + code `JAHARTA02irp` + `irp-mode.js`).
2. **Section "État audit 2026-04-18"** (pointeur court vers `docs/AUDIT.md`) — optionnel, sinon juste mise à jour des conventions.
3. **Compléter la table des scripts** : ajouter `jaharta-nav.js`, `jaharta-cache.js`, `irp-mode.js`, `stats-caps.js`, `auth-badge.js` + tous les hub/gacha manquants.

### README.md
1. **Section "Branche IRP"** avec les 4 pages, les collections `irp_*`, et l'entrée via `index.html`.
2. **Arborescence reflétant la réalité actuelle** (avant restructure Phase 5) ou **pointeur vers RESTRUCTURE.md** si migration imminente.
3. **Ajouter `bestiaire.html`** dans la table pages.
4. **Retirer ref UPDATES.md** (fichier inexistant).

---

## Redondances

| Redondance | Résolution |
|---|---|
| `SITE_ARCHITECTURE.md` racine ↔ `docs/SITE_ARCHITECTURE.md` | Supprimer la copie racine |
| `MEMORY.md` racine ↔ `memory/project_*.md` | Archiver `MEMORY.md` racine dans `.claude/archive/` |
| Ordre d'inclusion scripts décrit dans `CLAUDE.md:52-59`, `README.md:100-120`, `docs/SITE_ARCHITECTURE.md:31` | Garder dans CLAUDE.md (source de vérité conventions) + pointeur depuis README. SITE_ARCHITECTURE reste spécialisé "scripts par page". |
| Config Firebase listée dans `CLAUDE.md:80-88` et `README.md:133-141` | OK — deux audiences (IA vs humain). Synchroniser les commentaires. |

---

## Correctifs appliqués dans cette Phase 3

- ✅ `CLAUDE.md` — suppression refs `jaharta-card.js`, ajout section IRP, mise à jour arborescence
- ✅ `README.md` — suppression refs `jaharta-card.js`, ajout section IRP, ajout `bestiaire.html`, retrait ref `UPDATES.md`, arborescence mise à jour
- ✅ `MEMORY.md` racine — suppression refs `jaharta-card.js` (option conservation), note "fichier supprimé 2026-04-18"
- ✅ `memory/project_jaharta.md` — mise à jour tailles, suppression ref `jaharta-card.js`, ajout section IRP succincte, frontmatter rafraîchi
- ✅ `memory/MEMORY.md` (index) — descriptions rafraîchies
- 🟡 **En attente validation utilisateur** : suppression `SITE_ARCHITECTURE.md` racine (doublon) + archivage `MEMORY.md` racine

---

## Points demandant décision utilisateur

1. **`SITE_ARCHITECTURE.md` racine** (doublon exact) : supprimer maintenant ou laisser Phase 5 ?
2. **`MEMORY.md` racine** (253 lignes, historique sprints 1-6) : archiver dans `.claude/archive/` ou conserver visible côté repo ?
3. **Panel admin — onglet Bestiaire** : existe-t-il vraiment un onglet Bestiaire dans `admin.html` ou pas ? (non vu dans les 660 lignes que j'ai auditées, à confirmer avant de l'ajouter à CLAUDE.md). Référence `bestiaire.html` existe en page standalone.
4. **Ref `UPDATES.md`** dans README ligne 286 : fichier n'existe pas dans le repo. Supprimer la ligne ou créer `UPDATES.md` ?

---

⛔ **Fin Phase 3.** Correctifs appliqués sur CLAUDE.md, README.md, MEMORY.md, memory/*. Réponds aux 4 points ci-dessus avant Phase 4 (ROADMAP).

---

## Addendum — Module Casino (ajouté 2026-04-19)

Nouveau domaine `casino` ajouté entre Phase 3 et Phase 4, documenté dans `docs/CLAUDE-CASINO.md` (221 lignes).

### Inventaire Casino

| Fichier | Lignes | Rôle | État |
|---|---|---|---|
| `docs/casino.html` | 384 | Page principale · auth gate · hero · panels jeux · toggle mode | OK |
| `docs/css/casino.css` | 1516 | Thème gold/felt · cartes · roue · pièce · responsive | OK (exception taille — thème dédié) |
| `docs/js/casino-core.js` | 515 | Init Firebase compat · auth /link · wallet · mode · debit/credit · logs | OK |
| `docs/js/casino-roulette.js` | 573 | Roulette européenne · betting 30s · spin · payouts | OK |
| `docs/js/casino-blackjack.js` | 596 | Blackjack 6 sièges · dealer soft 17 · BJ 3:2 · double | OK |
| `docs/js/casino-poker.js` | 721 | Texas Hold'em 2-6j · évaluation main 7 cartes · fold/call/raise | Proche limite 800 lignes |
| `docs/js/casino-flip.js` | 122 | Quitte ou Double (PRIME only) · solo · navarites · streak | OK |
| `docs/CLAUDE-CASINO.md` | 221 | Doc technique dédiée | OK |

### Hygiène du code — conforme

- Aucun `console.*` dans les 5 fichiers JS casino
- Aucun `transition:all` dans `casino.css`
- Aucune variable CSS legacy (`--dark`, `--bg-deep`, etc.)
- Tous les `onSnapshot` stockent leur unsub (`unsubTable`, `CASINO.unsubs.cfg/player/eco`)
- `innerHTML` avec données utilisateur systématiquement passés par `escape()` (username, avatar src)
- Transactions atomiques Firebase pour tous les débits/crédits
- `lastClaimedRound` implémenté dans chaque module → anti double-crédit payouts

### Régressions détectées dans le code existant

| Fichier | Ligne | Violation | Correctif |
|---|---|---|---|
| `docs/js/hub-shops.js` | 72 | `transition:all .2s` | Corrigé 2026-04-19 → `border-color .2s,color .2s,background .2s` |
| `docs/js/hub-shops.js` | 96 | `transition:all .2s` | Corrigé 2026-04-19 → `background .2s,border-color .2s` |
| `docs/js/hub-shops.js` | 129 | `transition:all .2s` | Corrigé 2026-04-19 → `background .2s,border-color .2s` |
| `docs/js/hub-shops.js` | 584 | `transition:all 0.2s` | Corrigé 2026-04-19 → `border-color 0.2s,color 0.2s,background 0.2s` |

### Findings sécurité — à traiter

| Fichier | Cible | Risque | Sévérité |
|---|---|---|---|
| `firestore.rules` | `casino_tables` | `allow create, update: if true` — tout client peut réécrire n'importe quelle table ; les transactions atomiques protègent contre les races mais pas contre les écritures malicieuses | CRITICAL |
| `firestore.rules` | `players.update` | `navarites` modifiable sans `request.auth` — un joueur malveillant peut se créditer arbitrairement | CRITICAL |
| `firestore.rules` | `casino_logs.create` | Pas de vérif que `user_id` correspond à l'authentifié — log spoofing possible | HIGH |
| `firestore.rules` | `economy.update` | `personal|family|royal` modifiables sans auth — même problème que `navarites` | CRITICAL |

**Recommandation** : durcir via Cloud Functions (`onCall` trigger) ou Admin SDK côté bot Discord pour toutes les écritures casino. L'argument "transactions + client logic" est contournable par un client modifié.

### Violations de convention — mineures

| Fichier | Ligne | Remarque |
|---|---|---|
| `docs/casino.html` | 18 | `constants.js` non chargé — OK car casino n'utilise pas `window.RACES/RANKS`, mais rupture de l'ordre canonique (debug → constants → utils → Firebase) documenté dans CLAUDE.md |
| `docs/casino.html` | 376 | `utils.js` chargé après Firebase compat — ordre particulier justifié par l'architecture compat (non-ESM) du casino |
| `docs/js/casino-core.js` | plusieurs | `try { fn() } catch {}` silencieux lors des unsub — acceptable pour cleanup, à auditer si appliqué à logique métier |

### Sync documentaire — appliqué 2026-04-19

- `CLAUDE.md` — section Casino ajoutée, structure fichiers mise à jour (+casino.html, casino.css, 5 JS casino-*.js), collections Firestore étendues (casino_config, casino_tables, casino_logs, players, economy)
- `memory/project_jaharta.md` — frontmatter rafraîchi, section "Module Casino" ajoutée, tailles fichiers mises à jour, régression hub-shops.js journalisée
- `docs/MD-AUDIT.md` — ce document (addendum)
- `README.md` — **en attente** : pas encore mis à jour avec la section Casino (la Phase 3 initiale recommandait une réécriture plus large)

### Intégrations modifiées

| Fichier | Changement |
|---|---|
| `docs/js/jaharta-nav.js` | +1 entrée nav `casino.html` (num `10`) dans `PAGES_NORMAL` |
| `docs/admin.html` | +onglet Casino (toggle `is_open`, feed 20 derniers `casino_logs`) — +115 lignes |
| `docs/js/hub-shops.js` | 4 régressions `transition:all` (non liées casino, collatéral des commits "Add files via upload") |
| `firestore.rules` | +rules `casino_config`, `casino_tables`, `casino_logs` ; assouplissement `players.navarites` et `economy.personal|family|royal` |

### Actions recommandées Phase 4

1. **Durcissement Firestore rules casino** (CRITICAL) : migrer les écritures sensibles vers Cloud Functions ou Admin SDK (bot)
2. **Validation log spoofing** (HIGH) : ajouter une règle `request.resource.data.user_id == request.auth.uid` sur `casino_logs.create` (impose `signInWithCustomToken` ou équivalent)
3. **Surveillance taille** : `casino-poker.js` (721 lignes) proche du plafond 800 — refactor si ajout de features
4. **README.md** : ajouter section Casino (actuellement absent)
