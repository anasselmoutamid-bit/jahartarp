#!/usr/bin/env bash
# setup.sh — Bootstrap du Worker jahartarp-api en ~3 min.
#
# Prérequis :
#   - wrangler 4+ installé (npm i -g wrangler)
#   - wrangler login fait (ou CLOUDFLARE_API_TOKEN avec scopes Workers/D1/R2/KV)
#   - Le Discord Application Client ID + Client Secret prêts
#   - La D1 'jaharta-d1' déjà créée (faite par la migration du bot)

set -euo pipefail

cd "$(dirname "$0")"

step() { echo ""; echo "=== $1 ==="; }

step "1. Création du namespace KV"
if grep -q 'id = "REPLACE_AFTER_CREATE"' wrangler.toml; then
  echo "Création du namespace KV 'JAHARTA_KV'..."
  KV_OUT=$(wrangler kv namespace create JAHARTA_KV)
  echo "$KV_OUT"
  KV_ID=$(echo "$KV_OUT" | grep -oE 'id = "[a-f0-9]+"' | head -1 | sed 's/id = "//;s/"$//')
  if [ -z "$KV_ID" ]; then
    echo "ERREUR: impossible d'extraire l'ID KV. Fais le manuellement."
    exit 1
  fi
  echo "KV ID = $KV_ID"
  # Patch wrangler.toml
  sed -i.bak "s|id = \"REPLACE_AFTER_CREATE\"|id = \"$KV_ID\"|" wrangler.toml
  rm -f wrangler.toml.bak
  echo "wrangler.toml mis à jour."
else
  echo "KV déjà configuré (skip)."
fi

step "2. Création du bucket R2"
if ! wrangler r2 bucket list 2>/dev/null | grep -q "jaharta-assets"; then
  wrangler r2 bucket create jaharta-assets
else
  echo "Bucket 'jaharta-assets' existe déjà."
fi

step "3. Génération du JWT_SIGNING_KEY (random hex 64 chars)"
JWT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$JWT_KEY" | wrangler secret put JWT_SIGNING_KEY
echo "Secret JWT posé (64 chars hex)."

step "4. Secrets Discord OAuth"
echo "On va te demander 2 valeurs (interactif) :"
echo "  - DISCORD_CLIENT_ID    = l'Application ID de ton bot Discord"
echo "  - DISCORD_CLIENT_SECRET = OAuth2 secret (Dev Portal → ton App → OAuth2 → 'Reset Secret')"
echo ""
read -p "Discord Client ID: " DISCORD_ID
echo "$DISCORD_ID" | wrangler secret put DISCORD_CLIENT_ID

read -s -p "Discord Client Secret (caché): " DISCORD_SECRET
echo ""
echo "$DISCORD_SECRET" | wrangler secret put DISCORD_CLIENT_SECRET

step "5. Déploiement du Worker"
wrangler deploy

step "6. Test rapide"
WORKER_URL=$(wrangler deployments list 2>/dev/null | head -20 | grep -oE 'https://[^ ]+\.workers\.dev' | head -1 || true)
if [ -z "$WORKER_URL" ]; then
  WORKER_URL="https://jahartarp-api.workers.dev"
fi
echo "Test : GET $WORKER_URL/api/health"
curl -s "$WORKER_URL/api/health" | head -1
echo ""
echo "Test : GET $WORKER_URL/api/docs/fiches?limit=3"
curl -s "$WORKER_URL/api/docs/fiches?limit=3" | head -100

echo ""
echo "============================================="
echo "Setup terminé !"
echo "Worker URL : $WORKER_URL"
echo ""
echo "Discord OAuth redirect URL à ajouter dans le Dev Portal :"
echo "  $WORKER_URL/api/auth/discord/callback"
echo "============================================="
