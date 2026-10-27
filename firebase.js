
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGn378wkTwqW0cz26HH995Xe6r3vQTuG8",
    authDomain: "patitas-viajeras-tours.firebaseapp.com",
    projectId: "patitas-viajeras-tours",
    storageBucket: "patitas-viajeras-tours.firebasestorage.app",
    messagingSenderId: "261684370788",
    appId: "1:261684370788:web:5f278456c16299860e2e71",
    measurementId: "G-1423JZ0J9Q"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
