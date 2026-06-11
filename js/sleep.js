/* ============================================================
   L'ODYSSÉE DE NELIO — Suivi du Sommeil (Sleep)
   ============================================================ */

const Sleep = (() => {
  let chart = null;

  const COLORS = {
    medDeep: '#1B4965',
    medLight: 'rgba(27,73,101,0.35)',
    gold: '#D4A843',
    goldLight: 'rgba(212,168,67,0.2)',
    recommended: 'rgba(196,122,90,0.4)',
    recBorder: '#C47A5A',
  };

  /* Recommandation sommeil nouveau-né : 14-17h/jour (moyenne 15.5h) */
  const RECOMMENDED_MIN = 14;
  const RECOMMENDED_MAX = 17;

  function setDefaults() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sleep-date').value = today;
    document.getElementById('sleep-filter-date').value = today;
  }

  /* ── Calcul de la durée en minutes ── */
  function calcDuration(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    // Gestion du passage de minuit
    if (endMin <= startMin) endMin += 1440;
    return endMin - startMin;
  }

  /* ── Formulaire ── */
  function initForm() {
    document.getElementById('sleep-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('sleep-date').value;
      const startTime = document.getElementById('sleep-start').value;
      const endTime = document.getElementById('sleep-end').value;
      if (!date || !startTime || !endTime) return;

      const duration = calcDuration(startTime, endTime);
      try {
        db.collection('sleep').add({
          date, startTime, endTime, duration,
          createdAt: new Date().toISOString()
        });
        document.getElementById('sleep-start').value = '';
        document.getElementById('sleep-end').value = '';
        App.showToast('Sommeil enregistré ! 😴');
      } catch(e) { App.showToast('Erreur : configurez Firebase'); }
    });
  }

  function deleteEntry(id) {
    if (confirm('Supprimer cette session ?')) {
      db.collection('sleep').doc(id).delete();
      App.showToast('Session supprimée');
    }
  }

  /* ── Formater les minutes ── */
  function fmtDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + 'h' + (m > 0 ? String(m).padStart(2, '0') : '');
  }

  /* ── Liste filtrée par jour ── */
  function listenFiltered() {
    const filterInput = document.getElementById('sleep-filter-date');

    function query() {
      const date = filterInput.value;
      if (!date) return;
      try {
        db.collection('sleep')
          .where('date', '==', date)
          .orderBy('startTime', 'desc')
          .onSnapshot((snap) => {
            renderList(snap.docs);
          }, () => {});
      } catch(e) {}
    }

    filterInput.addEventListener('change', query);
    query();
  }

  function renderList(docs) {
    const container = document.getElementById('sleep-list');
    if (docs.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune session ce jour</p>';
      return;
    }
    container.innerHTML = docs.map(doc => {
      const d = doc.data();
      return `<div class="entry-item">
        <div class="entry-main">
          <span class="entry-primary">${d.startTime} → ${d.endTime}</span>
          <span class="entry-secondary">Durée : ${fmtDuration(d.duration)}</span>
        </div>
        <button class="btn-delete" onclick="Sleep.deleteEntry('${doc.id}')">✕</button>
      </div>`;
    }).join('');
  }

  /* ── Graphique : sommeil cumulé par jour vs recommandations ── */
  function listenChartData() {
    try {
    db.collection('sleep').orderBy('date', 'desc').onSnapshot((snap) => {
      const byDate = {};
      snap.forEach(doc => {
        const d = doc.data();
        if (!byDate[d.date]) byDate[d.date] = 0;
        byDate[d.date] += d.duration || 0;
      });

      const entries = Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14);

      const labels = entries.map(([date]) =>
        new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      );
      const values = entries.map(([, min]) => +(min / 60).toFixed(1));

      renderChart(labels, values);
    }, () => {});
    } catch(e) {}
  }

  function renderChart(labels, values) {
    const ctx = document.getElementById('sleep-chart');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Sommeil réel (h)',
            data: values,
            backgroundColor: COLORS.medLight,
            borderColor: COLORS.medDeep,
            borderWidth: 2,
            borderRadius: 6,
            order: 2,
          },
          {
            label: 'Recommandé min (14h)',
            data: labels.map(() => RECOMMENDED_MIN),
            type: 'line',
            borderColor: COLORS.recBorder,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1,
          },
          {
            label: 'Recommandé max (17h)',
            data: labels.map(() => RECOMMENDED_MAX),
            type: 'line',
            borderColor: COLORS.gold,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: '-1',
            backgroundColor: COLORS.goldLight,
            order: 0,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ' : ' + ctx.parsed.y + 'h' } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            beginAtZero: true,
            max: 24,
            title: { display: true, text: 'Heures', font: { size: 12 } },
            ticks: { callback: v => v + 'h', font: { size: 11 } }
          }
        }
      }
    });
  }

  function init() {
    setDefaults();
    initForm();
    listenFiltered();
    listenChartData();
  }

  return { init, deleteEntry };
})();
