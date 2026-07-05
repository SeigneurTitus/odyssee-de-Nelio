/* ============================================================
   L'ODYSSÉE DE NELIO — Suivi des Repas (Meals)
   ============================================================ */

const Meals = (() => {
  let chart        = null;   // Graphique barres (repas du jour sélectionné)
  let chartWeek    = null;   // Courbe des 7 derniers jours
  let unsubscribe  = null;
  let unsubWeek    = null;   // Listener Firebase pour la courbe 7 jours

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

  /* ── Graphique barres : quantités par heure pour le jour filtré ── */
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

  /* ── Courbe 7 jours : volume total bu par jour ── */
  function renderWeekChart(dayTotals) {
    // dayTotals = tableau de 7 objets { label: 'lun. 30', total: 650 }
    const ctx = document.getElementById('meals-week-chart');
    if (!ctx) return;

    if (chartWeek) chartWeek.destroy();
    chartWeek = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayTotals.map(d => d.label),
        datasets: [{
          label: 'Volume total (ml)',
          data: dayTotals.map(d => d.total),
          borderColor: COLORS.mediterranean,
          backgroundColor: COLORS.medLight,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: COLORS.mediterranean,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => 'Total : ' + ctx.parsed.y + ' ml'
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            beginAtZero: true,
            ticks: { callback: v => v + ' ml', font: { size: 11 } },
            title: { display: true, text: 'ml / jour', font: { size: 11 } }
          }
        }
      }
    });
  }

  /* ── Construire les 7 dates glissantes (aujourd'hui → J-6) ── */
  function buildWeekDates() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]); // 'YYYY-MM-DD'
    }
    return dates;
  }

  /* ── Label court pour un jour (ex: 'dim. 5') ── */
  function dayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  }

  /* ── Agréger les repas par date et rendre la courbe 7 jours ── */
  function buildAndRenderWeek(docs) {
    const dates  = buildWeekDates();
    const totals = {};
    dates.forEach(d => { totals[d] = 0; });

    docs.forEach(item => {
      const data = item.data ? item.data() : item; // Firestore doc ou objet local
      const dt   = data.datetime || data.date || '';
      const date = dt.split('T')[0];
      if (totals[date] !== undefined) {
        totals[date] += data.quantity || 0;
      }
    });

    const dayTotals = dates.map(d => ({ label: dayLabel(d), total: totals[d] }));
    renderWeekChart(dayTotals);
  }

  /* ── Rafraîchir l'affichage depuis localStorage (jour filtré) ── */
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

  /* ── Rafraîchir la courbe 7 jours depuis localStorage (tous les enregistrements) ── */
  function refreshLocalWeek() {
    // Récupère *tous* les repas stockés en local, puis filtre les 7 derniers jours
    const allDocs = LocalStore.getAll('meals');
    const dates   = buildWeekDates();
    const start   = dates[0]; // 'YYYY-MM-DD'
    const end     = dates[dates.length - 1];
    const filtered = allDocs.filter(item => {
      const dt = (item.data().datetime || item.data().date || '').split('T')[0];
      return dt >= start && dt <= end;
    });
    buildAndRenderWeek(filtered);
  }

  /* ── Prochain biberon estimé (3-4h après le dernier repas) ── */
  let nextBottleInterval = null;

  function updateNextBottle(lastDatetime) {
    const card = document.getElementById('next-bottle-card');
    const timeEl = document.getElementById('next-bottle-time');
    const countdownEl = document.getElementById('next-bottle-countdown');

    if (!card || !timeEl || !countdownEl) return;

    if (!lastDatetime) {
      card.style.display = '';
      timeEl.textContent = 'Aucun repas enregistré';
      countdownEl.textContent = 'Enregistre un biberon pour voir l\'estimation';
      countdownEl.style.color = 'var(--text-muted)';
      countdownEl.style.fontWeight = '400';
      if (nextBottleInterval) clearInterval(nextBottleInterval);
      return;
    }

    // Parser le datetime (format: "2026-06-16T14:30")
    let lastMeal;
    if (lastDatetime.includes('T')) {
      const [datePart, timePart] = lastDatetime.split('T');
      const [y, mo, d] = datePart.split('-').map(Number);
      const [h, m] = timePart.split(':').map(Number);
      lastMeal = new Date(y, mo - 1, d, h, m);
    } else {
      lastMeal = new Date(lastDatetime);
    }

    if (isNaN(lastMeal.getTime())) {
      card.style.display = '';
      timeEl.textContent = 'Erreur de format';
      countdownEl.textContent = 'datetime: ' + lastDatetime;
      return;
    }

    const earliest = new Date(lastMeal.getTime() + 3 * 60 * 60 * 1000); // +3h
    const latest   = new Date(lastMeal.getTime() + 4 * 60 * 60 * 1000); // +4h

    const fmt = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    timeEl.textContent = 'Entre ' + fmt(earliest) + ' et ' + fmt(latest);
    card.style.display = '';

    function refreshCountdown() {
      const now = new Date();
      const diffMs = earliest.getTime() - now.getTime();

      if (diffMs > 0) {
        const mins = Math.floor(diffMs / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const label = h > 0 ? h + 'h' + String(m).padStart(2, '0') : m + ' min';
        countdownEl.textContent = '⏳ Dans environ ' + label;
        countdownEl.style.color = 'var(--mediterranean)';
        countdownEl.style.fontWeight = '400';
      } else {
        const diffLatest = latest.getTime() - now.getTime();
        if (diffLatest > 0) {
          countdownEl.textContent = '🍼 C\'est l\'heure du biberon !';
          countdownEl.style.color = 'var(--gold)';
          countdownEl.style.fontWeight = '700';
        } else {
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
    nextBottleInterval = setInterval(refreshCountdown, 30000);
  }

  /* ── Trouver le dernier repas global et mettre à jour l'estimation ── */
  function refreshNextBottle() {
    if (db) {
      try {
        db.collection('meals').orderBy('datetime', 'desc').limit(1).get()
          .then((snap) => {
            if (!snap.empty) {
              updateNextBottle(snap.docs[0].data().datetime);
            } else {
              // Essayer localStorage
              findLastMealLocal();
            }
          })
          .catch(() => {
            findLastMealLocal();
          });
      } catch(e) {
        findLastMealLocal();
      }
    } else {
      findLastMealLocal();
    }
  }

  function findLastMealLocal() {
    const all = LocalStore.sort(LocalStore.getAll('meals'), 'datetime', 'desc');
    if (all.length > 0) {
      updateNextBottle(all[0].data().datetime);
    } else {
      updateNextBottle(null);
    }
  }

  /* ── Écoute temps réel Firestore (jour filtré) + courbe 7 jours ── */
  function listenMeals() {
    const filterInput = document.getElementById('meal-filter-date');

    /* ---- Listener du jour sélectionné ---- */
    function query() {
      const date = filterInput.value;
      if (!date) return;

      if (db) {
        try {
          if (unsubscribe) unsubscribe();
          unsubscribe = db.collection('meals')
            .where('datetime', '>=', date + 'T00:00')
            .where('datetime', '<=', date + 'T23:59')
            .orderBy('datetime', 'desc')
            .onSnapshot((snap) => {
              snap.docs.forEach(doc => LocalStore.save('meals', doc.id, doc.data()));
              renderList(snap.docs);
              renderChart(snap.docs);
              refreshNextBottle();
            }, () => {
              refreshLocalDisplay();
              refreshNextBottle();
            });
        } catch(e) {
          refreshLocalDisplay();
          refreshNextBottle();
        }
      } else {
        refreshLocalDisplay();
        refreshNextBottle();
      }
    }

    /* ---- Listener des 7 derniers jours (courbe) ---- */
    function listenWeek() {
      const dates = buildWeekDates();
      const start = dates[0] + 'T00:00';               // J-6 00:00
      const end   = dates[dates.length - 1] + 'T23:59'; // Aujourd'hui 23:59

      if (db) {
        try {
          if (unsubWeek) unsubWeek();
          // Firestore : récupère tous les repas des 7 derniers jours
          unsubWeek = db.collection('meals')
            .where('datetime', '>=', start)
            .where('datetime', '<=', end)
            .onSnapshot((snap) => {
              // Mettre en cache localement
              snap.docs.forEach(doc => LocalStore.save('meals', doc.id, doc.data()));
              buildAndRenderWeek(snap.docs);
            }, () => {
              refreshLocalWeek();
            });
        } catch(e) {
          refreshLocalWeek();
        }
      } else {
        refreshLocalWeek();
      }
    }

    filterInput.addEventListener('change', query);
    query();
    listenWeek(); // Lancer la courbe 7 jours au chargement
  }

  function init() {
    setDefaults();
    initForm();
    listenMeals();
  }

  return { init, deleteMeal };
})();


