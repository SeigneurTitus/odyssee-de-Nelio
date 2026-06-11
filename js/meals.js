/* ============================================================
   L'ODYSSÉE DE NELIO — Suivi des Repas (Meals)
   ============================================================ */

const Meals = (() => {
  let chart = null;

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
      try {
        db.collection('meals').add({
          datetime,
          quantity,
          createdAt: new Date().toISOString()
        });
        document.getElementById('meal-quantity').value = '';
        document.getElementById('meal-time').value = new Date().toTimeString().substring(0, 5);
        App.showToast('Biberon enregistré ! 🍼');
      } catch(e) { App.showToast('Erreur : configurez Firebase'); }
    });
  }

  /* ── Suppression d'un repas ── */
  function deleteMeal(id) {
    if (confirm('Supprimer ce repas ?')) {
      db.collection('meals').doc(id).delete();
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

  /* ── Écoute temps réel Firestore ── */
  function listenMeals() {
    const filterInput = document.getElementById('meal-filter-date');

    function query() {
      const date = filterInput.value;
      if (!date) return;
      try {
        db.collection('meals')
          .where('datetime', '>=', date + 'T00:00')
          .where('datetime', '<=', date + 'T23:59')
          .orderBy('datetime', 'desc')
          .onSnapshot((snap) => {
            const docs = snap.docs;
            renderList(docs);
            renderChart(docs);
          }, () => {});
      } catch(e) {}
    }

    filterInput.addEventListener('change', query);
    query();
  }

  function init() {
    setDefaults();
    initForm();
    listenMeals();
  }

  return { init, deleteMeal };
})();
