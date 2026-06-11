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

  /* ── Initialisation générale ── */
  function init() {
    initNav();
    Dashboard.init();
    Meals.init();
    Growth.init();
    Sleep.init();

    console.log('🏛️ L\'Odyssée de Nelio est prête !');
  }

  // Lancer l'application au chargement du DOM
  document.addEventListener('DOMContentLoaded', init);

  return { showToast };
})();
