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
  apiKey:            "AIzaSyC2THHxjGZZgjv1DU2nxvjF5AjguDmF47w",
  authDomain:        "odyssee-de-nelio.firebaseapp.com",
  projectId:         "odyssee-de-nelio",
  storageBucket:     "odyssee-de-nelio.firebasestorage.app",
  messagingSenderId: "1081941353815",
  appId:             "1:1081941353815:web:5847383d758b8503b94a12"
};

// ═══════════════════════════════════════════════════════════════
//  INITIALISATION — Ne pas modifier en dessous
// ═══════════════════════════════════════════════════════════════

// Vérifie si Firebase est correctement configuré
const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let db = null;

if (isFirebaseConfigured) {
  // Initialise l'application Firebase
  firebase.initializeApp(firebaseConfig);

  // Référence à la base de données Firestore
  db = firebase.firestore();

  // Active la persistance hors-ligne (les données sont cachées localement)
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Persistance désactivée : plusieurs onglets ouverts.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Persistance non supportée par ce navigateur.');
    }
  });

  console.log('🏛️ Firebase initialisé pour L\'Odyssée de Nelio');
} else {
  console.warn('⚠️ Firebase non configuré — mode local uniquement (localStorage)');
  console.warn('📋 Remplis tes identifiants dans firebase-config.js pour activer la synchronisation.');
}

// ═══════════════════════════════════════════════════════════════
//  STOCKAGE LOCAL — Fallback quand Firebase n'est pas configuré
//  Permet à l'app de fonctionner même sans connexion / sans Firebase
// ═══════════════════════════════════════════════════════════════

const LocalStore = {
  _prefix: 'nelio_',

  _getAll(collection) {
    try {
      return JSON.parse(localStorage.getItem(this._prefix + collection) || '{}');
    } catch (e) {
      return {};
    }
  },

  _saveAll(collection, data) {
    localStorage.setItem(this._prefix + collection, JSON.stringify(data));
  },

  /** Sauvegarder un document (avec ID fixe ou auto-généré) */
  save(collection, id, data) {
    const store = this._getAll(collection);
    const docId = id || ('local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
    store[docId] = { ...data };
    this._saveAll(collection, store);
    return docId;
  },

  /** Récupérer un document par ID */
  get(collection, id) {
    const store = this._getAll(collection);
    return store[id] || null;
  },

  /** Récupérer tous les documents (format compatible Firestore) */
  getAll(collection) {
    const store = this._getAll(collection);
    return Object.entries(store).map(([id, data]) => ({
      id,
      data: () => data,
    }));
  },

  /** Supprimer un document */
  delete(collection, id) {
    const store = this._getAll(collection);
    delete store[id];
    this._saveAll(collection, store);
  },

  /** Requête filtrée simple */
  query(collection, filters) {
    let results = this.getAll(collection);
    filters.forEach(({ field, op, value }) => {
      results = results.filter(doc => {
        const v = doc.data()[field];
        switch (op) {
          case '==': return v === value;
          case '>=': return v >= value;
          case '<=': return v <= value;
          case '>':  return v > value;
          case '<':  return v < value;
          default:   return true;
        }
      });
    });
    return results;
  },

  /** Tri des résultats */
  sort(docs, field, direction = 'asc') {
    return [...docs].sort((a, b) => {
      const va = a.data()[field] || '';
      const vb = b.data()[field] || '';
      const cmp = String(va).localeCompare(String(vb));
      return direction === 'desc' ? -cmp : cmp;
    });
  }
};
