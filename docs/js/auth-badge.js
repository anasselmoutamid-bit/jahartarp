/* ═══════════════════════════════════════════════════════════════════════
   docs/js/auth-badge.js — Badge admin partagé
   ═══════════════════════════════════════════════════════════════════════
   À inclure dans TOUTES les pages (sauf admin.html qui gère son propre auth).

     <script type="module" src="js/auth-badge.js"></script>

   Ce fichier :
   - Réutilise l'instance Firebase [DEFAULT] si elle existe déjà (cas fiches/pnj)
   - Sinon en crée une nouvelle (cas index, portail, racesjouables)
   - Écoute l'état de connexion et met à jour le badge + le lien nav admin

   Éléments HTML requis dans le nav :
     <a id="admin-badge" class="admin-badge" href="admin.html">ADMIN</a>
     <a class="nav-admin" href="admin.html">⚙ Connexion</a>
   ═══════════════════════════════════════════════════════════════════════ */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const cfg = {
  apiKey:            "AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",
  authDomain:        "jahartarp.firebaseapp.com",
  projectId:         "jahartarp",
  storageBucket:     "jahartarp.firebasestorage.app",
  messagingSenderId: "834848086593",
  appId:             "1:834848086593:web:c5cddc894f04feb61cc4c0",
};

/* Réutilise l'app DEFAULT si déjà initialisée (fiches, pnj),
   sinon en crée une nouvelle (index, portail, racesjouables) */
const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
const auth = getAuth(app);
const db   = getFirestore(app);

onAuthStateChanged(auth, async user => {

  /* ── Vérification whitelist admin dans Firestore ──────────────────────
     window._isAdmin = true UNIQUEMENT si l'UID existe dans admins/{uid}.
     Un simple compte Google sans entrée Firestore n'est PAS admin.      */
  let isAdmin = false;
  if (user) {
    try {
      const snap = await getDoc(doc(db, 'admins', user.uid));
      isAdmin = snap.exists();
    } catch {
      isAdmin = false; /* En cas d'erreur réseau, on refuse par défaut */
    }
  }
  window._isAdmin = isAdmin;

  /* ── Badge vert "ADMIN" dans le nav (visible seulement si whitelist) ── */
  const badge = document.getElementById('admin-badge');
  if (badge) badge.classList.toggle('visible', isAdmin);

  /* ── Lien "⚙ Connexion" / "⚙ Connecté" ── */
  const navLink = document.querySelector('.nav-admin-link');
  if (navLink) {
    if (isAdmin) {
      navLink.textContent = '⚙ Connecté';
      navLink.removeAttribute('href');
      navLink.style.cursor  = 'default';
      navLink.style.opacity = '0.55';
    } else {
      navLink.textContent = '⚙ Connexion';
      navLink.setAttribute('href', 'admin.html');
      navLink.style.cursor  = '';
      navLink.style.opacity = '';
    }
  }

  /* ── Bouton "+ Ajouter une fiche" — réservé aux admins whitelistés ── */
  const addBtn = document.getElementById('add-char-btn');
  if (addBtn) addBtn.style.display = isAdmin ? 'inline-flex' : 'none';

  /* ── Lien Admin dans le menu mobile ── */
  const menuAdminLink = document.getElementById('menu-admin-link');
  if (menuAdminLink) menuAdminLink.style.display = isAdmin ? '' : 'none';

  /* ── Dispatch un event custom pour les scripts non-module ──
     Permet à n'importe quelle page d'écouter :
     document.addEventListener('jaharta:auth', e => { if(e.detail.isAdmin) ... }) */
  document.dispatchEvent(new CustomEvent('jaharta:auth', { detail: { user, isAdmin } }));
});
