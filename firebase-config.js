// =============================================
// Firebase Configuration (Dynamic Loader Mode)
// =============================================

const firebaseConfig = {
    apiKey: "AIzaSyDKpLQH632kXD2Zg0bEpnCJgGN7MzAkZ0Q",
    authDomain: "logitrack-painel.firebaseapp.com",
    projectId: "logitrack-painel",
    storageBucket: "logitrack-painel.firebasestorage.app",
    messagingSenderId: "955830911564",
    appId: "1:955830911564:web:ee670688b6afce30abeae9",
    measurementId: "G-6BTMNBCW18"
};

function isFirebaseConfigured() {
    return firebaseConfig.apiKey && firebaseConfig.apiKey !== 'SUA_API_KEY';
}

// Injetar scripts do Firebase dinamicamente
if (isFirebaseConfigured() && typeof firebase === 'undefined') {
    const scripts = [
        "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js",
        "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"
    ];
    
    let loaded = 0;
    scripts.forEach(src => {
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // Manter ordem de execução para garantir que app carregue antes do firestore
        s.onload = () => {
            loaded++;
            if (loaded === scripts.length) {
                firebase.initializeApp(firebaseConfig);
                window.dbFirestore = firebase.firestore();
                console.log("[Firebase] SDKs carregados e inicializados.");
                
                // Dispara evento global para o data.js saber que o Firebase está pronto
                window.dispatchEvent(new Event('firebaseReady'));
            }
        };
        document.head.appendChild(s);
    });
}
