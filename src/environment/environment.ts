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
  usuarioAtual: null as any, // Inicialmente nulo, será preenchido após login
  partidaId: null as string | null, // ID da partida em andamento, se houver
};
