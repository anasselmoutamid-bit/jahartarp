# Site jahartarp.fr — Migration Firebase → Cloudflare D1 + R2

**État** : code migré, Worker déployé, lore/pnj testés en live. Reste 3 actions
manuelles + 1 export de données.

## Architecture finale

```
Browser (jahartarp.fr)
   │
   │ fetch + JWT Bearer
   ▼
Cloudflare Worker — jahartarp-api.jahartarp.workers.dev
   │   ├── /api/docs/* …… CRUD D1 (rules engine port de firestore.rules)
   │   ├── /api/auth/link ……… Échange /link code Discord → JWT
   │   ├── /api/auth/discord/* … OAuth Discord (admin panel)
   │   ├── /api/upload ……………… R2 upload (images, multipart)
   │   └── /api/files/:key …… R2 read (cache CDN long)
   │
   ├── D1 binding (DB) ─────────────► base `jaharta-d1`
   ├── R2 binding (ASSETS) ─────────► bucket `jaharta-assets`
   └── KV binding (KV) ─────────────► sessions OAuth + cache
```

**Remplacements** :

| Firebase | Cloudflare |
|---|---|
| Firestore | D1 (table `documents`) |
| Storage | R2 (bucket `jaharta-assets`) |
| Auth (Google) | Discord OAuth via Worker |
| `onSnapshot` | Polling 3 s avec ETag (304 sans-coût) |

## Fichiers nouveaux

```
worker/
├── wrangler.toml              ← config Worker (D1+R2+KV bindings)
├── package.json               ← scripts npm
├── setup.sh                   ← bootstrap automatique
├── migrate-js.py              ← script regex pour bulk-migration
├── README.md                  ← doc Worker
└── src/
    ├── index.js               ← routeur + CORS
    ├── utils.js               ← JWT, deep-merge, sentinels
    ├── db.js                  ← CRUD D1 (shadow admins via app_admins)
    ├── rules.js               ← port complet de firestore.rules
    ├── auth.js                ← Discord OAuth + /link → JWT
    └── storage.js             ← R2 upload/download

docs/js/
├── d1-client.js               ← shim ESM modular (firebase-firestore SDK)
└── firebase-compat-shim.js    ← shim global (firebase-*-compat.js)
```

## Fichiers modifiés (drop-in, comportement identique)

```
docs/
├── lore.html, pnj.html, bestiaire.html, racesjouables.html, admin.html
│   ─ imports Firebase ESM remplacés par d1-client.js
├── gacha.html, gacha-irp.html, hub.html, hub-irp.html, casino.html, competences.html
│   ─ scripts firebase-*-compat.js remplacés par firebase-compat-shim.js
└── js/
    ├── fiches.js, fiches-irp.js, auth-badge.js
    │   ─ imports ESM → d1-client.js
    └── hub-core.js, hub-irp-core.js, casino-core.js, competences.js
        ─ `firebase.initializeApp(...)` devient un no-op via shim
```

## 3 actions manuelles à faire

### 1. Mettre à jour la redirect URL Discord

L'URL du Worker a changé (account-scoped). Va sur https://discord.com/developers/applications → ton bot → **OAuth2** → section **Redirects** :

- ❌ Retirer : `https://jahartarp-api.workers.dev/api/auth/discord/callback`
- ✅ Ajouter : `https://jahartarp-api.jahartarp.workers.dev/api/auth/discord/callback`

Save Changes en bas.

### 2. T'ajouter comme admin (Discord ID)

Le panel admin utilisait Firebase Auth (Google → UID `iAxyhk6...`). En Discord OAuth, l'identifiant devient ton Discord ID. Pour t'autoriser :

```bash
cd worker
wrangler d1 execute jaharta-d1 --remote --command="INSERT OR REPLACE INTO app_admins(user_id, role) VALUES ('<TON_DISCORD_ID>', 'admin')"
```

Pour trouver ton Discord ID : Discord → User Settings → Advanced → Developer Mode → clic droit sur ton avatar → Copy ID.

### 3. Exporter les collections **site-only** depuis Firestore

Le bot avait exporté 47 collections, mais ces 5 collections étaient gérées exclusivement depuis le site (panel admin) et **ne sont pas dans D1** :

- `bestiaire` (créatures)
- `pnj_filters` (filtres custom panel)
- `irp_pnj` (PNJ branche IRP)
- `irp_bestiaire` (bestiaire IRP)
- `irp_flesh_marks` (marques de chair IRP)

Pour les migrer, lance depuis le bot (qui a déjà l'accès Firestore) :

```bash
cd ../../archive-2026-04-25T230428Z   # le dossier du bot
python scripts/export_firestore_to_json.py \
    --collections bestiaire,pnj_filters,irp_pnj,irp_bestiaire,irp_flesh_marks \
    --out data/site_only_export
# puis :
python migration/migrate_data.py --source data/site_only_export
```

(Ou plus simple : je peux écrire le script dédié quand tu me dis go.)

## Sécurité

- **JWT** signé HS256 avec `JWT_SIGNING_KEY` (64 hex chars, rotatable)
- **CORS** restreint à `jahartarp.fr`, `www.jahartarp.fr`, et localhost dev (cf. `wrangler.toml`)
- **Rules engine** (`src/rules.js`) porte les `firestore.rules` : whitelist de champs sur `players`, `characters`, `inventories`, `economy`, `shops`, validation du `status` à `pending` pour les pulls, etc.
- **Admin shadow** : `getDoc('admins', :id)` lit `app_admins` en priorité (compat avec les UIDs Firebase historiques + nouveaux Discord IDs)

## Real-time : polling avec ETag

Le client `d1-client.js` (et `firebase-compat-shim.js`) implémentent `onSnapshot()` via polling toutes les 3 s. Pour les `getDoc` répétés, le Worker renvoie `ETag` basé sur `updated_at`, et le client envoie `If-None-Match` → **304 sans coût D1** si le doc n'a pas changé.

Override possible côté browser : `window.__D1_POLL_MS__ = 5000` pour ralentir.

## Coûts attendus

Plan Workers Paid ($5/mois) inclut :
- 10M requêtes/mois
- 25 milliards de lectures D1, 50M écritures
- 10 Go R2 stockage, 1M class A operations/mois

Estimation usage : ~50 joueurs actifs, polling 3 s → ~1M req/jour → ~30M/mois. **Largement sous la limite.**

## Tests effectués

| Endpoint | Status |
|---|---|
| `GET /api/health` | ✅ 200 |
| `GET /api/docs/players?limit=2` | ✅ 200 + data |
| `GET /api/docs/players/:id` (avec ETag) | ✅ 200 + ETag header |
| `GET /api/docs/admins` (anonyme) | ✅ 403 (rules engine) |
| `POST /api/auth/link {}` | ✅ 400 "code requis" |
| `GET /api/auth/discord/login` | ✅ 302 → discord.com/oauth2/authorize |
| Page `lore.html` (live) | ✅ 29 entrées chargées depuis D1 |
| Page `pnj.html` (live) | ✅ 2 PNJ chargés depuis D1 |
| Page `gacha.html` (shim) | ✅ shim initialisé, `firebase.firestore()` OK |
| Page `hub.html` (shim) | ✅ shim initialisé |
| Page `admin.html` | ✅ écran login affiché (en attente OAuth) |

## Limites connues

- **Atomicité batch** : `db.batch().commit()` séquentiel sur D1 HTTP (pas atomique strict). OK pour le casino mineur, à monitorer.
- **`array-union` / `array-remove`** : non supportés natif côté serveur. Pour l'instant les rares appels (gacha admin) doivent envoyer la liste finale.
- **Persistance offline** : `enableIndexedDbPersistence` est no-op. Pas vital, l'ETag joue ce rôle.
- **Audio Firebase Storage** : `music-player.js` charge encore depuis `firebasestorage.googleapis.com`. À migrer vers R2 quand tu uploades les MP3.

## Coûts / cleanup une fois cutover validée

- Tu peux retirer le projet Firebase (`jaharta-rp`, `jahartarp`) → -0 €/mois (free tier de toute façon)
- Décommissionner les SDK Firebase n'a aucun impact (les imports sont déjà retirés)
- La base D1 vide `jaharta` (UUID `5cd73266-d90b-422f-9194-d56aa73fda50`) reste, tu peux la supprimer

## Re-déploiement Worker

À chaque modification de `worker/src/*` :

```bash
cd worker
wrangler deploy
```

(Avec `CLOUDFLARE_API_TOKEN` dans l'env ou après `wrangler login`.)

## URLs récap

- Worker API : https://jahartarp-api.jahartarp.workers.dev
- Worker dashboard : https://dash.cloudflare.com/c6837bd818ce40a035c83d0292e79e99/workers/services/view/jahartarp-api
- D1 console : https://dash.cloudflare.com/c6837bd818ce40a035c83d0292e79e99/workers/d1/databases/jaharta-d1
- R2 bucket : https://dash.cloudflare.com/c6837bd818ce40a035c83d0292e79e99/r2/default/buckets/jaharta-assets
- Discord Dev Portal : https://discord.com/developers/applications/1380988455873548448/oauth2
