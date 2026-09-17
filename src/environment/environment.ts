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
  // para tokenizar cartão). É a chave de PRODUÇÃO (mesma conta real usada
  // em environment.prod.ts) — qualquer cartão testado aqui em localhost
  // passa pela conta de verdade, não existe modo sandbox configurado.
  mercadoPagoPublicKey: "APP_USR-a62fe404-8f7e-411b-9ee7-8294fb61e1d5"
};
