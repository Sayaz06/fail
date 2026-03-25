import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Konfigurasi Firebase anda
const firebaseConfig = {
  apiKey: "AIzaSyBjV51BVNvDMaqu46lBVzXhZHBvYX90UPg",
  authDomain: "fail-61d3e.firebaseapp.com",
  projectId: "fail-61d3e",
  storageBucket: "fail-61d3e.firebasestorage.app",
  messagingSenderId: "389169800371",
  appId: "1:389169800371:web:776fc13942b4f64d013cc6",
  measurementId: "G-2BFQTP78KB"
};

// Mulakan Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Pastikan pengguna kekal log masuk walaupun tab ditutup
await setPersistence(auth, browserLocalPersistence);

// Eksport semua modul yang diperlukan untuk app.js
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
};
