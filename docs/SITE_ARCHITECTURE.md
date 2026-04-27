# SITE_ARCHITECTURE.md — Guide rapide

## Architecture des pages

### Branche NORMALE (aucun code IRP)
| Page | Rôle |
|------|------|
| `index.html` | Accueil. Contient le bouton secret ◆ → modal code → redirige vers `index-irp.html` |
| `hub.html` | Hub joueur (auth /link). 12 onglets. Zéro IRP. |
| `gacha.html` | Gacha Nexus. Bannières normales. Zéro IRP. |
| `fiches.html` | Fiches personnages joueurs |
| `pnj.html` | PNJ |
| `portail.html` | Portail lore + carte |
| `racesjouables.html` | Encyclopédie races |
| `bestiaire.html` | Bestiaire |
| `lore.html` | Lore complet |
| `admin.html` | Panel admin (whitelist Firebase) |

### Branche IRP (complètement séparée)
| Page | Rôle |
|------|------|
| `index-irp.html` | Accueil IRP. Thème violine. Nav pointe vers pages IRP. |
| `hub-irp.html` | Hub IRP. Collections `irp_*`, Jahartites, onglets IRP. |
| `gacha-irp.html` | Gacha IRP. Bannières IRP, Jahartites. |

**Seul point de contact:** bouton ◆ dans le footer de `index.html` → code `JAHARTA02irp` → `index-irp.html`

## Scripts par page

### Commun à toutes les pages
`debug.js` → `constants.js` → `utils.js` → `jaharta-nav.js` → `jaharta-cache.js`

### hub.html (normal)
`hub-dashboard.js` → `hub-character.js` → `hub-renders.js` → `hub-inventory.js` → `hub-shops.js` → `hub-achievements.js` → `hub-core.js` → `music-player.js`

### hub-irp.html
Même stack que hub.html + `irp-mode.js` + `hub-irp.js` (qui override les collections)

### gacha.html / gacha-irp.html
`gacha-logic.js` → `gacha-fx.js` → `gacha-blob.js` / `kanji-blob.js`
Sur gacha-irp.html: `window._irpMode = true` est forcé AVANT gacha-logic.js

## Firebase — Collections clés
| Collection | Usage |
|------------|-------|
| `gacha_config/banners` | Bannières actives (push par bot, lu par site via onSnapshot) |
| `config/achievements_config` | Définitions succès normal+IRP (push bot /15min) |
| `config/achievements_icons` | URLs images custom (éditées par admin via hub) |
| `achievements_user/{discord_id}` | Succès débloqués par joueur |

## Timing synchronisation bot ↔ site
- **Bot push:** h:00, h:15, h:30, h:45 (aligné aux quarts d'heure)
- **Site refresh succès:** h:03, h:18, h:33, h:48 (3 min après le bot)
- **Bannières gacha:** `onSnapshot` (temps réel, dès que le bot écrit)
