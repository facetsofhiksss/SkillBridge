import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
 

const firebaseConfig = {
  apiKey: "AIzaSyCUy6jQSqAqhxNPIZPz9i64SAH4oWCWFyY",
  authDomain: "skillbridge-c184e.firebaseapp.com",
  projectId: "skillbridge-c184e",
  storageBucket: "skillbridge-c184e.firebasestorage.app",
  messagingSenderId: "270575838725",
  appId: "1:270575838725:web:ddcc085d5904ad97cf1e6c",
  measurementId: "G-BJC0N1WEZ1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
 

export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  ref,
  set,
  get,
  update,
  remove,
};
