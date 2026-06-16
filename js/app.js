/* ============================================================
   L'ODYSSÉE DE NELIO — Application principale (Router & Init)
   ============================================================ */

const App = (() => {
  let toastTimeout = null;

  /* ── Navigation SPA ── */
  function initNav() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.app-section');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.section;

        // Mettre à jour les classes actives
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        sections.forEach(s => s.classList.remove('active'));
        document.getElementById('section-' + target).classList.add('active');

        // Scroll en haut
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ── Toast Notifications ── */
  function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('hidden'), duration);
  }

  /* ── Test de connexion Firebase ── */
  function testFirebase() {
    if (!db) {
      showToast('⚠️ Firebase non configuré — mode hors-ligne', 4000);
      console.warn('⚠️ Firebase non configuré');
      return;
    }

    // Test d'écriture puis lecture sur Firestore
    const testRef = db.collection('_test').doc('connection');
    testRef.set({ timestamp: new Date().toISOString(), status: 'ok' })
      .then(() => {
        console.log('✅ Firebase : écriture OK');
        return testRef.get();
      })
      .then((doc) => {
        if (doc.exists) {
          console.log('✅ Firebase : lecture OK', doc.data());
          showToast('✅ Firebase connecté — synchronisation active !', 3000);
          // Nettoyer le document de test
          testRef.delete().catch(() => {});
        }
      })
      .catch((err) => {
        console.error('❌ Firebase ERREUR:', err.code, err.message);
        if (err.code === 'permission-denied') {
          showToast('❌ Firebase : accès refusé ! Vérifie les règles Firestore', 5000);
        } else if (err.message.includes('network') || err.message.includes('unavailable')) {
          showToast('❌ Firebase : erreur réseau', 4000);
        } else {
          showToast('❌ Firebase erreur : ' + err.message, 5000);
        }
      });
  }

  /* ── Initialisation générale ── */
  function init() {
    initNav();
    Dashboard.init();
    Meals.init();
    Growth.init();
    Sleep.init();

    // Tester la connexion Firebase au démarrage
    testFirebase();

    console.log('🏛️ L\'Odyssée de Nelio est prête !');
  }

  // Lancer l'application au chargement du DOM
  document.addEventListener('DOMContentLoaded', init);

  return { showToast };
})();
