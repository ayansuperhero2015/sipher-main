// Firebase setup. The SDK is loaded straight from Google's CDN as ES modules,
// so there is no build step: serve this folder and open index.svg.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAnalytics,
  isSupported as analyticsSupported,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
import {
  connectAuthEmulator,
  getAuth,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import {
  connectDatabaseEmulator,
  getDatabase,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

// Firebase web config is public by design; access is enforced by
// firestore.rules and database.rules.json.
const firebaseConfig = {
  apiKey: "AIzaSyA8fHkptfmPebRju9ZlOgE9eTljuXqyRnI",
  authDomain: "sipher-e3cfb.firebaseapp.com",
  // The Realtime Database (typing and unread markers). Create it in the
  // Firebase console under Build > Realtime Database, location United States.
  databaseURL: "https://sipher-e3cfb-default-rtdb.firebaseio.com",
  projectId: "sipher-e3cfb",
  storageBucket: "sipher-e3cfb.firebasestorage.app",
  messagingSenderId: "508514132309",
  appId: "1:508514132309:web:2ac1945b3cb57342648fdc",
  measurementId: "G-ZLX9FPVGPN",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// The on-device cache lets a channel you reopen fetch only what changed
// instead of reading every message again, which keeps the free plan's daily
// read allowance from running out. (Falls back to memory if unavailable.)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
// Fast-changing, throwaway things (who's typing, which channels have new
// messages) go in the Realtime Database, which charges by data size rather
// than per read, so they cost next to nothing.
export const rtdb = getDatabase(app);

// Open index.svg?emulator to use the local Firebase emulators (firebase emulators:start).
export const usingEmulator = new URLSearchParams(location.search).has(
  "emulator",
);
if (usingEmulator) {
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, location.hostname, 8080);
  connectDatabaseEmulator(rtdb, location.hostname, 9000);
}

// Analytics is optional; it isn't available everywhere (e.g. file://, some privacy modes).
export let analytics = null;
analyticsSupported()
  .then((ok) => {
    if (ok && !usingEmulator) analytics = getAnalytics(app);
  })
  .catch((err) => console.warn("Analytics disabled:", err));
