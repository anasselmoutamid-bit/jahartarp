# jahartarp-api — Cloudflare Worker

Worker REST qui expose la D1 `jaharta-d1` et le bucket R2 `jaharta-assets`
pour le site jahartarp.fr. Remplace Firestore + Firebase Storage + Firebase Auth.

## Stack

- **Cloudflare Worker** (ESM, JS vanilla, zéro framework, zéro build step)
- **D1** — base SQL (déjà migrée par le bot)
- **R2** — bucket pour les images
- **KV** — sessions JWT + state OAuth (TTL court)
- **Discord OAuth2** — auth admin (remplace Firebase Auth Google)
- **JWT HS256** — sessions, signées par `JWT_SIGNING_KEY`

## Endpoints

| Méthode | Path | Description |
|---|---|---|
| GET | `/api/health` | Ping |
| GET | `/api/docs/:coll` | Liste (?q= base64 JSON conditions, ?limit, ?offset) |
| GET | `/api/docs/:coll/:id` | Lecture (supporte ETag → 304) |
| POST | `/api/docs/:coll/:id` | Set (?merge=1 pour fusion) |
| PATCH | `/api/docs/:coll/:id` | Update partiel |
| DELETE | `/api/docs/:coll/:id` | Suppression |
| POST | `/api/auth/link` | Échange `/link` code Discord → JWT |
| GET | `/api/auth/me` | Session courante |
| GET | `/api/auth/discord/login` | Redirige vers Discord OAuth (?return=) |
| GET | `/api/auth/discord/callback` | Callback OAuth |
| POST | `/api/upload` | Upload fichier (multipart, auth requis) |
| GET | `/api/files/:key` | Lecture R2 (cache CDN long) |

## Setup (3-5 min)

### 1. Permissions du token Cloudflare

Va sur https://dash.cloudflare.com/profile/api-tokens, édite ton token
`jaharta-d1-migration` et ajoute :

- **Account → Workers Scripts → Edit**
- **Account → Workers R2 Storage → Edit**
- **Account → Workers KV Storage → Edit**

Save. (Ou : `wrangler login` interactif si tu préfères.)

### 2. Discord OAuth

1. https://discord.com/developers/applications → ton bot Jaharta
2. Onglet **OAuth2** :
   - Copie le **Client ID** (= Application ID, déjà visible plus haut)
   - **Reset Secret** → copie le secret (visible 1 fois seulement)
   - **Redirects** → ajoute : `https://jahartarp-api.workers.dev/api/auth/discord/callback`
3. Save Changes

Tiens les 2 valeurs (Client ID + Secret) sous la main pour l'étape suivante.

### 3. Lancer le setup

```bash
cd worker
chmod +x setup.sh
./setup.sh
```

Le script :
- Crée le namespace KV et patche `wrangler.toml`
- Crée le bucket R2 `jaharta-assets`
- Génère et pose `JWT_SIGNING_KEY` (32 bytes random hex)
- Demande tes 2 secrets Discord (interactif)
- Déploie le Worker
- Pingue `/api/health` et `/api/docs/fiches` pour valider

### 4. Vérifier

```bash
curl https://jahartarp-api.workers.dev/api/health
curl https://jahartarp-api.workers.dev/api/docs/fiches?limit=3
```

## Sécurité / contrôle d'accès

Le fichier [src/rules.js](src/rules.js) porte les `firestore.rules` en JS.
Mêmes contraintes par collection :

- Public read pour la plupart (`fiches`, `pnj`, `lore`, ...)
- Field-level constraints sur `players`, `inventories`, `economy`, `characters`
- Admin-only pour `logs`, `vip_whitelist`, etc.
- Auth requise pour `/api/upload`

`session.is_admin` est résolu en lisant la table `app_admins` (peuplée par la
migration du bot). Pour ajouter un admin :

```sql
-- via wrangler d1 execute
INSERT INTO app_admins(user_id, role) VALUES ('123456789012345678', 'admin');
```

## Auth côté browser

Le JWT est stocké dans `localStorage["d1_jwt"]`. 2 flows :

- **Joueur** : tape un code `/link` dans le hub → JWT 7 jours.
- **Admin** : bouton "Connexion staff" → redirect Discord OAuth → JWT 7 jours.

Le client (`docs/js/d1-client.js`) injecte `Authorization: Bearer <jwt>` sur
toutes les requêtes.

## Limites connues

- **Real-time** : polling 3 s (config via `window.__D1_POLL_MS__`). Suffisant
  pour casino/hub/gacha. Coût : ~28k req/jour par user actif. Limite gratuite
  Workers Paid largement OK pour la communauté.
- **Atomicité batch** : pas de batch atomique sur l'API REST D1. Pour le
  casino, on a un Worker dédié plus tard si nécessaire.
- **arrayUnion/arrayRemove** : non supportés (envoie la liste finale).
- **orderBy** : no-op (l'ordre vient de D1, à enrichir au besoin).

## Dev local

```bash
wrangler dev --remote      # Worker local + D1 remote
# ouvre http://localhost:8787/api/health
```

## Renvoyer le bucket R2 vers un domaine custom (optionnel)

Si tu veux servir les images depuis `cdn.jahartarp.fr` au lieu du Worker :

1. Dashboard Cloudflare → R2 → `jaharta-assets` → Settings → Custom Domains
2. Ajoute `cdn.jahartarp.fr`
3. Adapte `getDownloadURL` dans `docs/js/d1-client.js`

## Migration des images Firebase Storage → R2

Voir `migration-images.md` (TODO).
