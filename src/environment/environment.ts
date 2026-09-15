export const environment = {
  firebase: {
    apiKey: "AIzaSyBhgv09xtxO_2PuF76YSswvP-pu0OcX9mM",
    authDomain: "paranoiajogos.firebaseapp.com",
    projectId: "paranoiajogos",
    storageBucket: "paranoiajogos.firebasestorage.app",
    messagingSenderId: "271693505482",
    appId: "1:271693505482:web:552024d86ed12593172533",
    measurementId: "G-PC6ZV2JRTG"
  },
  // Public key do Mercado Pago (não é segredo — usada pelo SDK no navegador
  // para tokenizar cartão). Vazio até a conta existir: enquanto isso, o
  // checkout mostra Pix/boleto e desabilita cartão.
  mercadoPagoPublicKey: ""
};
