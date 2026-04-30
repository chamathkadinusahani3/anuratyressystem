import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

//  Replace these values with your actual Firebase project config
const firebaseConfig = {
   apiKey: "AIzaSyButrnry8aMsQQXgORIDLwrrBWOQuuZRQQ",
  authDomain: "anuratyressystem.firebaseapp.com",
  projectId: "anuratyressystem",
  storageBucket: "anuratyressystem.firebasestorage.app",
  messagingSenderId: "500762708668",
  appId: "1:500762708668:web:1d25faeba547bded5a9eb9",
  measurementId: "G-RXGC1ETZEP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

