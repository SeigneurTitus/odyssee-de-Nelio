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

  /* ── Appliquer les données du profil à l'interface ── */
  function applyProfile(data) {
    profileData = data;
    document.getElementById('dash-name').textContent = data.name || 'Nelio';
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('dash-birthdate').textContent =
      'Né le ' + new Date(data.birthDate + 'T00:00:00').toLocaleDateString('fr-FR', opts);
    document.getElementById('setup-modal').classList.add('hidden');
    updateAgeDisplay();
    if (ageInterval) clearInterval(ageInterval);
    ageInterval = setInterval(updateAgeDisplay, 60000);
  }

  /* ── Écoute du profil (Firebase + localStorage fallback) ── */
  function listenProfile() {
    // 1. Charger depuis localStorage immédiatement (instantané)
    const cached = LocalStore.get('profile', 'info');
    if (cached && cached.birthDate) {
      applyProfile(cached);
    }

    // 2. Écouter Firebase si configuré (pour la synchronisation)
    if (db) {
      try {
        db.collection('profile').doc('info').onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            // Mettre à jour le cache local
            LocalStore.save('profile', 'info', data);
            applyProfile(data);
          } else if (!cached || !cached.birthDate) {
            // Montrer le modal seulement si on n'a pas de données locales
            document.getElementById('setup-modal').classList.remove('hidden');
          }
        }, (error) => {
          console.warn('[Dashboard] Erreur profil Firebase:', error.message);
          // Ne pas montrer le modal si on a des données locales
          if (!cached || !cached.birthDate) {
            document.getElementById('setup-modal').classList.remove('hidden');
          }
        });
      } catch (e) {
        console.warn('[Dashboard] Firebase non configuré');
        if (!cached || !cached.birthDate) {
          document.getElementById('setup-modal').classList.remove('hidden');
        }
      }
    } else if (!cached || !cached.birthDate) {
      // Pas de Firebase, pas de cache → afficher le modal
      document.getElementById('setup-modal').classList.remove('hidden');
    }
  }

  /* ── Écoute des dernières mesures ── */
  function listenGrowth() {
    if (db) {
      try {
        db.collection('growth').orderBy('date', 'desc').limit(1).onSnapshot((snap) => {
          if (!snap.empty) {
            const d = snap.docs[0].data();
            document.getElementById('dash-weight').textContent = d.weight + ' kg';
            document.getElementById('dash-height').textContent = d.height + ' cm';
          }
        }, () => { loadLocalGrowth(); });
      } catch(e) { loadLocalGrowth(); }
    } else {
      loadLocalGrowth();
    }
  }

  function loadLocalGrowth() {
    const all = LocalStore.sort(LocalStore.getAll('growth'), 'date', 'desc');
    if (all.length > 0) {
      const d = all[0].data();
      document.getElementById('dash-weight').textContent = d.weight + ' kg';
      document.getElementById('dash-height').textContent = d.height + ' cm';
    }
  }

  /* ── Dernier repas ── */
  function listenLastMeal() {
    if (db) {
      try {
        db.collection('meals').orderBy('datetime', 'desc').limit(1).onSnapshot((snap) => {
          if (!snap.empty) {
            const d = snap.docs[0].data();
            const t = d.datetime.split('T')[1] || d.datetime;
            document.getElementById('dash-last-meal').textContent = d.quantity + ' ml à ' + t.substring(0,5);
          }
        }, () => { loadLocalLastMeal(); });
      } catch(e) { loadLocalLastMeal(); }
    } else {
      loadLocalLastMeal();
    }
  }

  function loadLocalLastMeal() {
    const all = LocalStore.sort(LocalStore.getAll('meals'), 'datetime', 'desc');
    if (all.length > 0) {
      const d = all[0].data();
      const t = d.datetime.split('T')[1] || d.datetime;
      document.getElementById('dash-last-meal').textContent = d.quantity + ' ml à ' + t.substring(0,5);
    }
  }

  /* ── Sommeil du jour ── */
  function listenTodaySleep() {
    const today = new Date().toISOString().split('T')[0];

    if (db) {
      try {
        db.collection('sleep').where('date', '==', today).onSnapshot((snap) => {
          let totalMin = 0;
          snap.forEach(doc => { totalMin += (doc.data().duration || 0); });
          displaySleep(totalMin);
        }, () => { loadLocalTodaySleep(today); });
      } catch(e) { loadLocalTodaySleep(today); }
    } else {
      loadLocalTodaySleep(today);
    }
  }

  function loadLocalTodaySleep(today) {
    const docs = LocalStore.query('sleep', [{ field: 'date', op: '==', value: today }]);
    let totalMin = 0;
    docs.forEach(doc => { totalMin += (doc.data().duration || 0); });
    displaySleep(totalMin);
  }

  function displaySleep(totalMin) {
    if (totalMin > 0) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      document.getElementById('dash-sleep-today').textContent = h + 'h' + (m > 0 ? String(m).padStart(2,'0') : '');
    } else {
      document.getElementById('dash-sleep-today').textContent = '—';
    }
  }

  /* ── Setup form ── */
  function initSetup() {
    const form = document.getElementById('setup-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('setup-name').value.trim();
      const birthDate = document.getElementById('setup-birthdate').value;
      if (!name || !birthDate) return;

      const data = { name, birthDate };

      // Toujours sauvegarder en local (instantané, fiable)
      LocalStore.save('profile', 'info', data);
      applyProfile(data);

      // Aussi sauvegarder sur Firebase si disponible
      if (db) {
        db.collection('profile').doc('info').set(data).catch(err => {
          console.warn('[Dashboard] Erreur sauvegarde Firebase:', err.message);
        });
      }

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
