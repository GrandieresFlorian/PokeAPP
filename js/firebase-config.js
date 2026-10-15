export const firebaseConfig = {
    apiKey: "AIzaSyC2aHcIN_0Lgk-fSpCY-pHwMs2bL5nRJgM",
    authDomain: "pokeapp-40bae.firebaseapp.com",
    projectId: "pokeapp-40bae",
    storageBucket: "pokeapp-40bae.firebasestorage.app",
    messagingSenderId: "445091453076",
    appId: "1:445091453076:web:d6b18cc032f54116d7fc81"
};
firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();