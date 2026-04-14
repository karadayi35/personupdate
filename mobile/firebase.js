import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "leadfinderpro-483309",
  appId: "1:365884351342:web:d39937c1fc20790143d77f",
  apiKey: "AIzaSyBn-zeDrWscwqWw5oz6dp2RL2W_ztdKt5Y",
  authDomain: "leadfinderpro-483309.firebaseapp.com",
  storageBucket: "leadfinderpro-483309.firebasestorage.app",
  messagingSenderId: "365884351342"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-90f319b6-1ccf-4f41-8793-86588c46c0c6");

export default app;
