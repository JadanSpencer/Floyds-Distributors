import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBk4oAO4LVlrwgBgrdk9m2waZaeiB1nrqY",
    authDomain: "floyds-489c8.firebaseapp.com",
    databaseURL: "https://floyds-489c8-default-rtdb.firebaseio.com",
    projectId: "floyds-489c8",
    storageBucket: "floyds-489c8.appspot.com",
    messagingSenderId: "467837659879",
    appId: "1:467837659879:web:8fde5b1862184183ac9042",
    measurementId: "G-32RKBL830G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };