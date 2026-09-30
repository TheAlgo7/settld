// Firebase web config for project settld-in. This is public client config
// (not a secret); access control lives in firestore.rules.
// Note for future edits: bump VERSION in sw.js whenever this changes,
// otherwise installed PWAs keep serving the cached copy.

// Installed apps (the Play app included) sign in by redirect, and Chrome keeps
// storage apart per site, so the redirect result is only readable when sign-in
// runs on the app's own host. vercel.json proxies Firebase's /__/auth pages
// there. Needs https://settld-ruddy.vercel.app/__/auth/handler among the
// redirect URIs of the Google OAuth client; until then it is off by default
// (localStorage "settld.sameSiteAuth" = "1" turns it on for testing).
const SAME_SITE_AUTH_DEFAULT = false;
const APP_HOST = "settld-ruddy.vercel.app";

function sameSiteAuth() {
  if (location.hostname !== APP_HOST) return false;
  try {
    const flag = localStorage.getItem("settld.sameSiteAuth");
    if (flag !== null) return flag === "1";
  } catch {
    /* storage blocked: use the default */
  }
  return SAME_SITE_AUTH_DEFAULT;
}

export const firebaseConfig = {
  apiKey: "AIzaSyBpqfvOekwxn5SHkipS0XdBp640EG2ahqw",
  authDomain: sameSiteAuth() ? APP_HOST : "settld-in.firebaseapp.com",
  projectId: "settld-in",
  storageBucket: "settld-in.firebasestorage.app",
  messagingSenderId: "703701931808",
  appId: "1:703701931808:web:f7fac7b77c1d43f4df6945",
};
