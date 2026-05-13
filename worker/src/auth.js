// auth.js — Sessions JWT, Discord OAuth, échange de link codes.

import { json, err, signJWT, verifyJWT, randomSecret } from "./utils.js";
import { getDoc, deleteDoc, isAdmin, getAdminRole } from "./db.js";

// ── Récupère la session depuis Authorization: Bearer <jwt> ──────────────────

export async function readSession(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const secret = env.JWT_SIGNING_KEY;
  if (!secret) return null;
  const payload = await verifyJWT(token, secret);
  return payload || null;
}

// ── POST /api/auth/link { code } ────────────────────────────────────────────
// Échange un code /link (généré par le bot) contre un JWT.
// Lecture + suppression atomique du code, puis émission du JWT.

export async function handleAuthLink(req, env) {
  const body = await req.json().catch(() => ({}));
  const code = (body?.code || "").trim();
  if (!code || code.length < 4) return err(400, "code requis");

  // Le bot stocke les codes dans gacha_link_codes/{code}
  const doc = await getDoc(env, "gacha_link_codes", code);
  if (!doc) return err(404, "code invalide ou expiré");

  // Vérifier l'expiration (le bot stocke expires_at en ISO)
  if (doc.expires_at) {
    const exp = Date.parse(doc.expires_at);
    if (Number.isFinite(exp) && exp < Date.now()) {
      // Code expiré — on supprime + reject
      await deleteDoc(env, "gacha_link_codes", code);
      return err(410, "code expiré");
    }
  }

  const discordId = String(doc.discord_id || "");
  if (!discordId) return err(500, "code mal formé (discord_id manquant)");

  // Suppression du code (usage unique)
  await deleteDoc(env, "gacha_link_codes", code);

  // Est-il admin ?
  const admin = await isAdmin(env, discordId);
  const role = await getAdminRole(env, discordId);

  const payload = {
    sub: discordId,
    discord_id: discordId,
    is_admin: admin,
    role: role || null,
    src: "link",
    username: doc.username || null,
    avatar_url: doc.avatar_url || null,
  };

  const jwt = await signJWT(payload, env.JWT_SIGNING_KEY, 7 * 86400);
  return json({
    token: jwt,
    expires_in: 7 * 86400,
    user: {
      discord_id: discordId,
      is_admin: admin,
      role,
      username: doc.username || null,
      avatar_url: doc.avatar_url || null,
    },
  });
}

// ── GET /api/auth/me ────────────────────────────────────────────────────────
// Renvoie la session courante (vérifie aussi qu'elle existe encore).

export async function handleAuthMe(req, env) {
  const sess = await readSession(req, env);
  if (!sess) return err(401, "not authenticated");
  // Refresh admin status au cas où il a été retiré
  const admin = await isAdmin(env, sess.discord_id);
  return json({
    discord_id: sess.discord_id,
    is_admin: admin,
    role: admin ? await getAdminRole(env, sess.discord_id) : null,
    username: sess.username || null,
    avatar_url: sess.avatar_url || null,
    src: sess.src,
    exp: sess.exp,
  });
}

// ── GET /api/auth/discord/login ─────────────────────────────────────────────
// Redirige vers Discord OAuth.

export async function handleDiscordLogin(req, env) {
  if (!env.DISCORD_CLIENT_ID) return err(500, "DISCORD_CLIENT_ID not configured");

  // CSRF state — random, stocké en KV 10 min
  const state = randomSecret().slice(0, 32);
  await env.KV.put(`oauth:state:${state}`, "1", { expirationTtl: 600 });

  // Captrue retour personnalisé : ?return=/admin.html par exemple
  const url = new URL(req.url);
  const ret = url.searchParams.get("return") || "/admin.html";
  await env.KV.put(`oauth:return:${state}`, ret, { expirationTtl: 600 });

  const redirectUri = `${env.WORKER_PUBLIC_URL}/api/auth/discord/callback`;
  const authUrl = new URL("https://discord.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "identify");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "consent");

  return Response.redirect(authUrl.toString(), 302);
}

// ── GET /api/auth/discord/callback ──────────────────────────────────────────

export async function handleDiscordCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return err(400, "code or state missing");

  // CSRF check
  const stateOk = await env.KV.get(`oauth:state:${state}`);
  if (!stateOk) return err(400, "invalid or expired state (CSRF check failed)");
  await env.KV.delete(`oauth:state:${state}`);

  const returnPath = (await env.KV.get(`oauth:return:${state}`)) || "/admin.html";
  await env.KV.delete(`oauth:return:${state}`);

  // Exchange code -> access_token
  const redirectUri = `${env.WORKER_PUBLIC_URL}/api/auth/discord/callback`;
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return err(502, "Discord token exchange failed", await tokenRes.text());
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Fetch user info
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return err(502, "Discord user fetch failed");
  const user = await userRes.json();

  const discordId = String(user.id);
  const admin = await isAdmin(env, discordId);
  const role = await getAdminRole(env, discordId);

  // Pour l'admin panel : on EXIGE d'être admin (le callback est utilisé via le bouton "Connexion staff")
  if (returnPath.startsWith("/admin") && !admin) {
    // Redirige vers le site avec un flag erreur
    const url = new URL(env.SITE_PUBLIC_URL);
    url.pathname = returnPath;
    url.hash = "auth_denied=not_admin";
    return Response.redirect(url.toString(), 302);
  }

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    : null;

  const payload = {
    sub: discordId,
    discord_id: discordId,
    is_admin: admin,
    role: role || null,
    src: "discord_oauth",
    username: user.global_name || user.username,
    avatar_url: avatarUrl,
  };
  const jwt = await signJWT(payload, env.JWT_SIGNING_KEY, 7 * 86400);

  // Redirige le navigateur vers le site avec le JWT en URL fragment
  // (pas un cookie : pas de stockage cross-domain implicite).
  const target = new URL(env.SITE_PUBLIC_URL);
  target.pathname = returnPath;
  target.hash = `jwt=${jwt}`;
  return Response.redirect(target.toString(), 302);
}

// ── POST /api/auth/logout ───────────────────────────────────────────────────
// Sans cookie côté serveur, le client supprime juste son JWT du localStorage.
// On expose juste un endpoint pour la symétrie.

export function handleAuthLogout() {
  return json({ ok: true });
}
