/* ============================================================
   L'ODYSSÉE DE NELIO — Tableau de bord (Dashboard)
   ============================================================ */

const Dashboard = (() => {
  let ageInterval = null;
  let profileData = null;

  /* ── Calcul de l'âge exact ── */
  function computeAge(birthDateStr) {
    const birth = new Date(birthDateStr + 'T00:00:00');
    const now = new Date();
    const diffMs = now - birth;
    const days = Math.floor(diffMs / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30.44);
    return { days, weeks, months };
  }

  function updateAgeDisplay() {
    if (!profileData || !profileData.birthDate) return;
    const age = computeAge(profileData.birthDate);
    document.getElementById('dash-days').textContent = age.days;
    document.getElementById('dash-weeks').textContent = age.weeks;
    document.getElementById('dash-months').textContent = age.months;
  }

  /* ── Écoute du profil ── */
  function listenProfile() {
    try {
      db.collection('profile').doc('info').onSnapshot((doc) => {
        if (doc.exists) {
          profileData = doc.data();
          document.getElementById('dash-name').textContent = profileData.name || 'Nelio';
          const opts = { day: 'numeric', month: 'long', year: 'numeric' };
          document.getElementById('dash-birthdate').textContent =
            'Né le ' + new Date(profileData.birthDate + 'T00:00:00').toLocaleDateString('fr-FR', opts);
          document.getElementById('setup-modal').classList.add('hidden');
          updateAgeDisplay();
          if (ageInterval) clearInterval(ageInterval);
          ageInterval = setInterval(updateAgeDisplay, 60000);
        } else {
          document.getElementById('setup-modal').classList.remove('hidden');
        }
      }, (error) => {
        console.warn('[Dashboard] Erreur profil:', error.message);
        document.getElementById('setup-modal').classList.remove('hidden');
      });
    } catch (e) {
      console.warn('[Dashboard] Firebase non configuré — affichage du modal de setup');
      document.getElementById('setup-modal').classList.remove('hidden');
    }
  }

  /* ── Écoute des dernières mesures ── */
  function listenGrowth() {
    try {
      db.collection('growth').orderBy('date', 'desc').limit(1).onSnapshot((snap) => {
        if (!snap.empty) {
          const d = snap.docs[0].data();
          document.getElementById('dash-weight').textContent = d.weight + ' kg';
          document.getElementById('dash-height').textContent = d.height + ' cm';
        }
      }, () => {});
    } catch(e) {}
  }

  /* ── Dernier repas ── */
  function listenLastMeal() {
    try {
      db.collection('meals').orderBy('datetime', 'desc').limit(1).onSnapshot((snap) => {
        if (!snap.empty) {
          const d = snap.docs[0].data();
          const t = d.datetime.split('T')[1] || d.datetime;
          document.getElementById('dash-last-meal').textContent = d.quantity + ' ml à ' + t.substring(0,5);
        }
      }, () => {});
    } catch(e) {}
  }

  /* ── Sommeil du jour ── */
  function listenTodaySleep() {
    try {
      const today = new Date().toISOString().split('T')[0];
      db.collection('sleep').where('date', '==', today).onSnapshot((snap) => {
        let totalMin = 0;
        snap.forEach(doc => { totalMin += (doc.data().duration || 0); });
        if (totalMin > 0) {
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          document.getElementById('dash-sleep-today').textContent = h + 'h' + (m > 0 ? String(m).padStart(2,'0') : '');
        } else {
          document.getElementById('dash-sleep-today').textContent = '—';
        }
      }, () => {});
    } catch(e) {}
  }

  /* ── Setup form ── */
  function initSetup() {
    const form = document.getElementById('setup-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('setup-name').value.trim();
      const birthDate = document.getElementById('setup-birthdate').value;
      if (!name || !birthDate) return;
      db.collection('profile').doc('info').set({ name, birthDate });
      App.showToast('Bienvenue dans l\'Odyssée de ' + name + ' ! ⚡');
    });
  }

  function init() {
    initSetup();
    listenProfile();
    listenGrowth();
    listenLastMeal();
    listenTodaySleep();
  }

  return { init };
})();
