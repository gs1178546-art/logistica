// =============================================
// Firebase Configuration (CDN compat mode)
// =============================================
// Substitua os valores abaixo pelas credenciais
// reais do seu projeto Firebase.
// Console: https://console.firebase.google.com

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializar Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
}

// Verificar se Firebase está configurado com credenciais reais
function isFirebaseConfigured() {
    try {
        const config = firebase.app().options;
        return config.apiKey && config.apiKey !== 'SUA_API_KEY';
    } catch (e) {
        return false;
    }
}
