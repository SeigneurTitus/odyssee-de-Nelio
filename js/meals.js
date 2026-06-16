/* ============================================================
   L'ODYSSÉE DE NELIO — Suivi des Repas (Meals)
   ============================================================ */

const Meals = (() => {
  let chart = null;
  let unsubscribe = null;

  /* ── Couleurs du thème pour Chart.js ── */
  const COLORS = {
    gold: '#D4A843',
    goldLight: 'rgba(212,168,67,0.3)',
    mediterranean: '#2E6B8A',
    medLight: 'rgba(46,107,138,0.3)',
  };

  /* ── Initialiser les valeurs par défaut du formulaire ── */
  function setDefaults() {
    const now = new Date();
    document.getElementById('meal-date').value = now.toISOString().split('T')[0];
    document.getElementById('meal-time').value = now.toTimeString().substring(0, 5);
    document.getElementById('meal-filter-date').value = now.toISOString().split('T')[0];
  }

  /* ── Soumission du formulaire ── */
  function initForm() {
    document.getElementById('meal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('meal-date').value;
      const time = document.getElementById('meal-time').value;
      const quantity = parseInt(document.getElementById('meal-quantity').value);
      if (!date || !time || !quantity) return;

      const datetime = date + 'T' + time;
      const data = { datetime, quantity, createdAt: new Date().toISOString() };

      // Sauvegarder en local
      LocalStore.save('meals', null, data);

      // Sauvegarder sur Firebase si disponible
      if (db) {
        db.collection('meals').add(data).catch(err => {
          console.warn('[Meals] Erreur Firebase:', err.message);
        });
      } else {
        // Sans Firebase, rafraîchir manuellement l'affichage
        refreshLocalDisplay();
      }

      document.getElementById('meal-quantity').value = '';
      document.getElementById('meal-time').value = new Date().toTimeString().substring(0, 5);
      App.showToast('Biberon enregistré ! 🍼');
    });
  }

  /* ── Suppression d'un repas ── */
  function deleteMeal(id) {
    if (confirm('Supprimer ce repas ?')) {
      LocalStore.delete('meals', id);

      if (db) {
        db.collection('meals').doc(id).delete().catch(() => {});
      } else {
        refreshLocalDisplay();
      }

      App.showToast('Repas supprimé');
    }
  }

  /* ── Rendu de la liste ── */
  function renderList(docs) {
    const container = document.getElementById('meals-list');
    if (docs.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun repas ce jour</p>';
      return;
    }
    container.innerHTML = docs.map(doc => {
      const d = doc.data();
      const time = d.datetime.split('T')[1] || '??:??';
      return `<div class="entry-item">
        <div class="entry-main">
          <span class="entry-primary">${d.quantity} ml</span>
          <span class="entry-secondary">🕐 ${time.substring(0,5)}</span>
        </div>
        <button class="btn-delete" onclick="Meals.deleteMeal('${doc.id}')">✕</button>
      </div>`;
    }).join('');
  }

  /* ── Graphique : quantités par heure ── */
  function renderChart(docs) {
    const ctx = document.getElementById('meals-chart');
    const data = docs.map(doc => {
      const d = doc.data();
      return { time: d.datetime.split('T')[1]?.substring(0,5) || '00:00', qty: d.quantity, dt: d.datetime };
    }).sort((a, b) => a.dt.localeCompare(b.dt));

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.time),
        datasets: [{
          label: 'Quantité (ml)',
          data: data.map(d => d.qty),
          backgroundColor: COLORS.goldLight,
          borderColor: COLORS.gold,
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ctx.parsed.y + ' ml' } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { callback: v => v + ' ml', font: { size: 11 } } }
        }
      }
    });
  }

  /* ── Rafraîchir l'affichage depuis localStorage ── */
  function refreshLocalDisplay() {
    const date = document.getElementById('meal-filter-date').value;
    if (!date) return;
    const docs = LocalStore.query('meals', [
      { field: 'datetime', op: '>=', value: date + 'T00:00' },
      { field: 'datetime', op: '<=', value: date + 'T23:59' }
    ]);
    const sorted = LocalStore.sort(docs, 'datetime', 'desc');
    renderList(sorted);
    renderChart(sorted);
  }

  /* ── Prochain biberon estimé (3-4h après le dernier repas) ── */
  let nextBottleInterval = null;

  function updateNextBottle(lastDatetime) {
    const card = document.getElementById('next-bottle-card');
    const timeEl = document.getElementById('next-bottle-time');
    const countdownEl = document.getElementById('next-bottle-countdown');

    if (!lastDatetime) {
      card.style.display = 'none';
      return;
    }

    const lastMeal = new Date(lastDatetime);
    // Vérifier que la date est valide
    if (isNaN(lastMeal.getTime())) {
      card.style.display = 'none';
      return;
    }

    const earliest = new Date(lastMeal.getTime() + 3 * 60 * 60 * 1000); // +3h
    const latest   = new Date(lastMeal.getTime() + 4 * 60 * 60 * 1000); // +4h

    const fmt = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    timeEl.textContent = 'Entre ' + fmt(earliest) + ' et ' + fmt(latest);
    card.style.display = '';

    // Mettre à jour le countdown
    function refreshCountdown() {
      const now = new Date();
      const diffMs = earliest.getTime() - now.getTime();

      if (diffMs > 0) {
        // Pas encore l'heure
        const mins = Math.floor(diffMs / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const label = h > 0 ? h + 'h' + String(m).padStart(2, '0') : m + ' min';
        countdownEl.textContent = '⏳ Dans environ ' + label;
        countdownEl.style.color = 'var(--mediterranean)';
      } else {
        const diffLatest = latest.getTime() - now.getTime();
        if (diffLatest > 0) {
          // C'est l'heure !
          countdownEl.textContent = '🍼 C\'est l\'heure du biberon !';
          countdownEl.style.color = 'var(--gold)';
          countdownEl.style.fontWeight = '700';
        } else {
          // En retard
          const lateMs = now.getTime() - latest.getTime();
          const lateMins = Math.floor(lateMs / 60000);
          countdownEl.textContent = '⚠️ Biberon en retard de ' + lateMins + ' min';
          countdownEl.style.color = 'var(--danger)';
          countdownEl.style.fontWeight = '700';
        }
      }
    }

    refreshCountdown();
    if (nextBottleInterval) clearInterval(nextBottleInterval);
    nextBottleInterval = setInterval(refreshCountdown, 30000); // refresh toutes les 30s
  }

  /* ── Écoute du dernier repas (toutes dates confondues) pour le prochain biberon ── */
  function listenLastMealForBottle() {
    if (db) {
      try {
        db.collection('meals').orderBy('datetime', 'desc').limit(1).onSnapshot((snap) => {
          if (!snap.empty) {
            updateNextBottle(snap.docs[0].data().datetime);
          } else {
            updateNextBottle(null);
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
      updateNextBottle(all[0].data().datetime);
    } else {
      updateNextBottle(null);
    }
  }

  /* ── Écoute temps réel Firestore (avec fallback local) ── */
  function listenMeals() {
    const filterInput = document.getElementById('meal-filter-date');

    function query() {
      const date = filterInput.value;
      if (!date) return;

      if (db) {
        try {
          // Nettoyer l'ancien listener
          if (unsubscribe) unsubscribe();

          unsubscribe = db.collection('meals')
            .where('datetime', '>=', date + 'T00:00')
            .where('datetime', '<=', date + 'T23:59')
            .orderBy('datetime', 'desc')
            .onSnapshot((snap) => {
              // Mettre en cache dans localStorage
              snap.docs.forEach(doc => {
                LocalStore.save('meals', doc.id, doc.data());
              });
              renderList(snap.docs);
              renderChart(snap.docs);
            }, () => {
              // Fallback localStorage en cas d'erreur
              refreshLocalDisplay();
            });
        } catch(e) {
          refreshLocalDisplay();
        }
      } else {
        refreshLocalDisplay();
      }
    }

    filterInput.addEventListener('change', query);
    query();
  }

  function init() {
    setDefaults();
    initForm();
    listenMeals();
    listenLastMealForBottle();
  }

  return { init, deleteMeal };
})();

