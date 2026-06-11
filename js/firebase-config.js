/* ============================================================
 *  L'ODYSSÉE DE NELIO — Configuration Firebase
 * ============================================================
 *
 *  INSTRUCTIONS POUR CONFIGURER FIREBASE :
 *
 *  1. Va sur https://console.firebase.google.com/
 *  2. Crée un nouveau projet (ex: "odyssee-de-nelio")
 *  3. Dans le projet, clique sur "Ajouter une application" > Web (icône </>)
 *  4. Donne un nom à l'app (ex: "nelio-web") et enregistre
 *  5. Firebase te donnera un objet firebaseConfig — copie chaque valeur
 *     dans les champs vides ci-dessous
 *
 *  6. Active Firestore :
 *     - Va dans "Cloud Firestore" dans le menu latéral
 *     - Clique "Créer une base de données"
 *     - Choisis "mode test" pour commencer (lecture/écriture ouvertes 30 jours)
 *     - Sélectionne l'emplacement le plus proche (europe-west1 pour la France)
 *
 *  7. RÈGLES DE SÉCURITÉ FIRESTORE (à configurer dans Console > Firestore > Règles) :
 *
 *     Pour le mode développement/famille (accès ouvert, pas d'authentification) :
 *     ┌──────────────────────────────────────────────────────────┐
 *     │  rules_version = '2';                                   │
 *     │  service cloud.firestore {                               │
 *     │    match /databases/{database}/documents {               │
 *     │      match /{document=**} {                              │
 *     │        allow read, write: if true;                       │
 *     │      }                                                   │
 *     │    }                                                     │
 *     │  }                                                       │
 *     └──────────────────────────────────────────────────────────┘
 *
 *     ⚠️  Ces règles sont ouvertes ! Pour plus de sécurité, tu peux
 *     limiter par domaine ou ajouter Firebase Authentication plus tard.
 *
 * ============================================================ */

// ═══════════════════════════════════════════════════════════════
//  REMPLIS ICI TES IDENTIFIANTS FIREBASE
//  (récupérés depuis la console Firebase > Paramètres du projet)
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "",   // ex: "AIzaSyD..."
  authDomain:        "",   // ex: "mon-projet.firebaseapp.com"
  projectId:         "",   // ex: "mon-projet"
  storageBucket:     "",   // ex: "mon-projet.appspot.com"
  messagingSenderId: "",   // ex: "123456789"
  appId:             ""    // ex: "1:123456789:web:abc123"
};

// ═══════════════════════════════════════════════════════════════
//  INITIALISATION — Ne pas modifier en dessous
// ═══════════════════════════════════════════════════════════════

// Initialise l'application Firebase
firebase.initializeApp(firebaseConfig);

// Référence à la base de données Firestore
// Cette variable `db` est utilisée dans tous les autres fichiers JS
const db = firebase.firestore();

// Active la persistance hors-ligne (les données sont cachées localement)
// Cela permet à l'app de fonctionner même sans connexion internet
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Plusieurs onglets ouverts — la persistance ne peut être activée que dans un seul
    console.warn('[Firebase] Persistance désactivée : plusieurs onglets ouverts.');
  } else if (err.code === 'unimplemented') {
    // Le navigateur ne supporte pas la persistance
    console.warn('[Firebase] Persistance non supportée par ce navigateur.');
  }
});

console.log('🏛️ Firebase initialisé pour L\'Odyssée de Nelio');
