// SkillBridge — Firebase setup. Import `auth` and `db` from here on every page.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  deleteUser,
  updateProfile,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUy6jQSqAqhxNPIZPz9i64SAH4oWCWFyY",
  authDomain: "skillbridge-c184e.firebaseapp.com",
  projectId: "skillbridge-c184e",
  storageBucket: "skillbridge-c184e.firebasestorage.app",
  messagingSenderId: "270575838725",
  appId: "1:270575838725:web:ddcc085d5904ad97cf1e6c",
  measurementId: "G-BJC0N1WEZ1",
  // Copy this from Firebase console → Realtime Database (the URL shown above your data).
  // Without it, database reads and writes hang forever.
  databaseURL: "https://skillbridge-c184e-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  deleteUser,
  updateProfile,
  signOut,
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
};
