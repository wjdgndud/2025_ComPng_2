// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// 🔹 Firebase 설정 - 본인 프로젝트 값으로 교체
const firebaseConfig = {
    apiKey: "AIzaSyB0E28uFH2LdkNyAX22KHxIuO2uP7BHnO4",
    authDomain: "anonymous-vote-system.firebaseapp.com",
    projectId: "anonymous-vote-system",
    storageBucket: "anonymous-vote-system.firebasestorage.app",
    messagingSenderId: "536718039436",
    appId: "1:536718039436:web:c1b3bf495e12b8b4d81ea9",
    measurementId: "G-84PMQJF0B6"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
