# CLAUDE-CASINO.md — Casino Nexus · Documentation technique

Référence pour les sessions de modification du système casino de Jaharta RP.

---

## Fichiers du système casino

| Fichier | Rôle |
|---------|------|
| `casino.html` | Page principale — auth gate, hero, panels jeux, mode toggle |
| `css/casino.css` | Styles complets — thème gold/felt, cartes, roue, pièce, responsive |
| `js/casino-core.js` | Init Firebase, auth /link, session, wallet, mode, tabs, debit/credit, logs |
| `js/casino-roulette.js` | Roulette européenne — table partagée, betting 30s, spin, payouts |
| `js/casino-blackjack.js` | Blackjack 6 sièges — dealer hits soft 17, BJ 3:2, double, phases |
| `js/casino-poker.js` | Texas Hold'em 2-6 joueurs — évaluation main 7 cartes, side-pot simplifié |
| `js/casino-flip.js` | Quitte ou Double (PRIME only) — solo, navarites, streak |

---

## Architecture

### Auth
Même système `/link` que gacha.html et hub.html :
- Joueur fait `/link` sur Discord → bot crée `gacha_link_codes/{JH-XXXXXX}`
- Client lit + supprime le code (transaction) → extrait `{ discord_id, username, avatar_url }`
- Session stockée dans `localStorage` (`casino_session` + `hub_session` + `gacha_session`, TTL 7 jours)

### Mode NORMAL / PRIME
| | NORMAL | PRIME |
|--|--------|-------|
| Devise | Kanites (bronze/silver/gold/platinum) | Navarites |
| Jeux | Roulette, Blackjack, Poker | Roulette, Blackjack, Poker + **Quitte ou Double** |
| Source données | `economy/{uid}_{charId}.personal` | `players/{uid}.navarites` |

Basculement via `setMode('normal'|'prime')` — toggle UI dans la userbar.

### Multijoueur — Host-driven
Chaque table a un "host" élu dynamiquement (premier joueur actif). Le host :
- Fait tourner `setInterval` (hostTick) côté client
- Avance les phases (betting → spinning → resolved, etc.)
- Failover automatique si le host se déconnecte (host_ping TTL 7s)

---

## Firestore — Collections casino

### `casino_config/main`
```js
{
  is_open: boolean,       // false = casino fermé (écran bloqu)
  updated_by: email,
  updated_at: Timestamp
}
```
**Règle :** lecture publique, écriture admin uniquement.

### `casino_tables/{tableId}`
Tables disponibles : `roulette_main`, `blackjack_main`, `poker_main`

Structure commune :
```js
{
  game: 'roulette'|'blackjack'|'poker',
  phase: string,          // varie par jeu
  phase_started: number,  // Date.now()
  phase_end: number,
  currency: string,       // devise de la table (lock dès qu'un joueur s'assoit)
  mode: 'normal'|'prime',
  host: string,           // discord_id du host actif
  host_ping: number,      // Date.now() heartbeat
  // ... champs spécifiques au jeu
}
```
**Règle :** lecture publique, create/update publics (transactions client), delete admin.

### `casino_logs/{id}`
```js
{
  user_id, username, game, mode, currency,
  amount, profit, result, char_id, extra, at: Timestamp
}
```
**Règle :** lecture admin, création publique (champs whitelistés), pas de update/delete.

---

## Globals window exposés par casino-core.js

| Global | Type | Description |
|--------|------|-------------|
| `window.CASINO` | object | État global : uid, mode, charId, economy, player, currentGame |
| `window._db` | Firestore | Instance Firestore compat |
| `window._CC` | object | Constantes collections Firestore |
| `window._getSess()` | fn | Lire la session localStorage |
| `window._getBalance(currency)` | fn | Solde courant pour une devise |
| `window._debit(currency, amount)` | async fn | Débiter atomiquement (transaction) |
| `window._credit(currency, amount)` | async fn | Créditer atomiquement (transaction) |
| `window._logBet(game, amount, currency, result, profit, extra)` | fn | Écrire casino_log |
| `window._fmtNum(n)` | fn | Formater nombre (1.2k, 3.5M) |
| `window._currencyLabel(c)` | fn | Emoji + nom devise |
| `window._currentCurrency(selectElId)` | fn | Devise active selon mode |
| `window._renderWallet()` | fn | Rafraîchir affichage wallet |
| `window._getCharKey()` | fn | Clé economy `uid_charId` |

### Hooks modules jeux
| Global | Appelé par core quand… |
|--------|------------------------|
| `window._rlInit()` | Onglet roulette sélectionné |
| `window._bjInit()` | Onglet blackjack sélectionné |
| `window._pkInit()` | Onglet poker sélectionné |
| `window._qdInit()` | Onglet flip sélectionné |
| `window._rlOnModeChange(mode)` | Mode basculé (efface mises locales) |
| `window._bjOnModeChange(mode)` | Mode basculé |
| `window._pkOnModeChange(mode)` | Mode basculé |

---

## Phases par jeu

### Roulette
`betting (30s) → spinning (8s) → resolved (5s) → betting…`

Le host calcule les payouts dans `resolved` via `payouts: { uid: netProfit }`.  
Chaque client lit `payouts[CASINO.uid]` et crédite son propre compte (une fois par round via `lastClaimedRound`).

**Multiplicateurs :**
- Numéro plein : 35:1
- Rouge/Noir, Pair/Impair, Manque/Passe : 1:1
- Douzaine, Colonne : 2:1
- 0 perd tous les paris extérieurs

### Blackjack
`betting (25s) → dealing (1.5s) → playing (20s/siège) → dealer → resolve (6s) → betting…`

- 6 sièges, 6 decks mélangés
- Dealer tire jusqu'à ≥17 (y compris soft 17)
- Blackjack paie 3:2 ; push si dealer BJ aussi
- Double : uniquement sur 2 cartes, double la mise, tire 1 carte, stand automatique
- Chaque siège a son propre `currency` (lock à l'assise)

### Poker (Texas Hold'em)
`waiting → preflop → flop → turn → river → showdown (8s) → intermission (5s) → waiting/preflop…`

- 2-6 joueurs, blindes 1/2 par défaut
- Évaluation 7 cartes complète (straight flush → carte haute)
- Auto-fold si timeout du tour (25s)
- Fold win si un seul joueur reste
- Pas de side-pots (simplifié : all-in = pot entier)

### Quitte ou Double (PRIME only)
- Solo, navarites uniquement
- Mise initiale débitée au lancement
- Chaque pile ou face : gagner = pot ×2, perdre = tout perdu
- Encaisser à tout moment après un win

---

## Admin Casino

Dans `admin.html` → onglet **Casino** :
- Affiche l'état (OUVERT / FERMÉ) en temps réel via `onSnapshot`
- Bouton toggle → `toggleCasino()` → écrit `casino_config/main` + log admin
- Liste des 20 derniers paris (`casino_logs`)
- Lien direct vers `casino.html`

`loadCasino()` est appelé dans le callback `onAuthStateChanged` après login admin.

---

## Firestore Security Rules — points clés

```
casino_config  → read: true | write: admin
casino_tables  → read: true | create/update: true (client transactions) | delete: admin
casino_logs    → read: admin | create: champs whitelistés | update/delete: false
players        → update: admin OU ['display_theme', 'navarites'] seulement
economy        → update: admin OU ['personal', 'family', 'royal'] seulement
```

Le champ `navarites` dans `players/{uid}` est modifiable sans auth pour permettre
les débits/crédits casino côté client (mode PRIME). Les transactions Firestore garantissent
l'atomicité et empêchent les race conditions.

---

## Tâches fréquentes

**Changer le timer betting roulette :**
`casino-roulette.js` → `const BETTING_MS = 30000`

**Changer les blindes poker :**
`casino-poker.js` → `const SB_DEFAULT = 1, BB_DEFAULT = 2`

**Ajouter une devise kanite :**
1. Ajouter `<option>` dans les selects `rl-currency`, `bj-currency`, `pk-currency` (casino.html)
2. Ajouter case dans `currencyLabel()` (casino-core.js)
3. Ajouter `<span class="wl-pill">` dans `#wallet-normal` (casino.html)
4. Mettre à jour `renderWallet()` (casino-core.js)

**Fermer le casino temporairement :**
Admin panel → onglet Casino → bouton FERMER LE CASINO
(ou directement Firestore Console : `casino_config/main` → `is_open: false`)

**Ajouter un jeu :**
1. Nouveau panel `<section class="game-panel" id="panel-myjeu">` dans casino.html
2. Nouveau bouton `.game-tab` dans `.casino-nav`
3. Nouveau fichier `js/casino-myjeu.js` avec `window._myjeuInit = function() {...}`
4. Appel dans `selectGame()` de casino-core.js
5. Inclusion `<script src="js/casino-myjeu.js">` dans casino.html

---

## Notes importantes

- **Pas de `console.*`** — utiliser `window._dbg?.warn/error()` uniquement
- **Transactions atomiques** pour tous les débits/crédits (évite double-spend)
- **lastClaimedRound** dans chaque module : garde-fou contre double crédit payout
- **Host failover** : si `host_ping` > 7s, n'importe quel client peut devenir host
- **CSS variables casino** : `--casino-accent` (#e8b04a gold), `--prime-accent` (#d946ef violet)
- Le casino utilise Firebase **compat** (non-ESM) comme gacha.html et hub.html
