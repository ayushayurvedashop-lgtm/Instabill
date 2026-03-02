import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: "AIzaSyCcC34oyAF8hLozXfOn-Ur0mq-Q7SNoCpA",
  authDomain: "ayush-ayurveda-8623a.firebaseapp.com",
  projectId: "ayush-ayurveda-8623a",
  storageBucket: "ayush-ayurveda-8623a.firebasestorage.app",
  messagingSenderId: "1005327407828",
  appId: "1:1005327407828:web:00352e4cad88a33184b941",
  measurementId: "G-02586EHSR8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

// Use local functions emulator in development
// Use local functions emulator in development
// if (location.hostname === 'localhost' || location.hostname.includes('192.168')) {
//   connectFunctionsEmulator(functions, 'localhost', 5002);
//   console.log("Using local Firebase Functions emulator");
// }