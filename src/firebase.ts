import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDBZGtryyNhRMalcbEgFbEftnpEF1XPTag",
  authDomain: "gen-lang-client-0911963433.firebaseapp.com",
  projectId: "gen-lang-client-0911963433",
  storageBucket: "gen-lang-client-0911963433.firebasestorage.app",
  messagingSenderId: "74738438208",
  appId: "1:74738438208:web:5ae5c529a87816c434cfa5"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with named database ID specified in config using getFirestore(app, databaseId)
const db = getFirestore(app, "ai-studio-f3e20c95-8dc9-4931-bb32-d9e05b0d9f87");

// Initialize Firebase Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
