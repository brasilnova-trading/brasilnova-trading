import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQznHl1935yZ0M4tLFZPJ-fyIrLHB2TTE",
  authDomain: "brasilnova-trading.firebaseapp.com",
  projectId: "brasilnova-trading",
  storageBucket: "brasilnova-trading.firebasestorage.app",
  messagingSenderId: "402374039722",
  appId: "1:402374039722:web:74dc85f4e6a5c8d91658d3"
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
