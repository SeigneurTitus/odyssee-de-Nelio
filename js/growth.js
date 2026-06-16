/* ============================================================
   L'ODYSSÉE DE NELIO — Suivi Poids & Taille (Growth)
   ============================================================ */

const Growth = (() => {
  let chart = null;

  const COLORS = {
    bordeaux: '#8B2252',
    bordeauxLight: 'rgba(139,34,82,0.15)',
    mediterranean: '#2E6B8A',
    medLight: 'rgba(46,107,138,0.15)',
  };

  function setDefaults() {
    document.getElementById('growth-date').value = new Date().toISOString().split('T')[0];
  }

  /* ── Formulaire ── */
  function initForm() {
    document.getElementById('growth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('growth-date').value;
      const weight = parseFloat(document.getElementById('growth-weight').value);
      const height = parseFloat(document.getElementById('growth-height').value);
      if (!date || isNaN(weight) || isNaN(height)) return;

      const data = { date, weight, height, createdAt: new Date().toISOString() };

      // Sauvegarder en local
      LocalStore.save('growth', null, data);

      // Sauvegarder sur Firebase si disponible
      if (db) {
        db.collection('growth').add(data).catch(err => {
          console.warn('[Growth] Erreur Firebase:', err.message);
        });
      } else {
        refreshLocalDisplay();
      }

      document.getElementById('growth-weight').value = '';
      document.getElementById('growth-height').value = '';
      App.showToast('Mesure enregistrée ! 📏');
    });
  }

  function deleteEntry(id) {
    if (confirm('Supprimer cette mesure ?')) {
      LocalStore.delete('growth', id);

      if (db) {
        db.collection('growth').doc(id).delete().catch(() => {});
      } else {
        refreshLocalDisplay();
      }

      App.showToast('Mesure supprimée');
    }
  }

  /* ── Liste ── */
  function renderList(docs) {
    const container = document.getElementById('growth-list');
    if (docs.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune mesure enregistrée</p>';
      return;
    }
    container.innerHTML = docs.map(doc => {
      const d = doc.data();
      const dateStr = new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
      return `<div class="entry-item">
        <div class="entry-main">
          <span class="entry-primary">⚖️ ${d.weight} kg — 📏 ${d.height} cm</span>
          <span class="entry-secondary">${dateStr}</span>
        </div>
        <button class="btn-delete" onclick="Growth.deleteEntry('${doc.id}')">✕</button>
      </div>`;
    }).join('');
  }

  /* ── Graphique double axe ── */
  function renderChart(docs) {
    const ctx = document.getElementById('growth-chart');
    const sorted = docs.map(doc => doc.data()).sort((a, b) => a.date.localeCompare(b.date));
    const labels = sorted.map(d =>
      new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
    );

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Poids (kg)',
            data: sorted.map(d => d.weight),
            borderColor: COLORS.bordeaux,
            backgroundColor: COLORS.bordeauxLight,
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: COLORS.bordeaux,
            yAxisID: 'y',
          },
          {
            label: 'Taille (cm)',
            data: sorted.map(d => d.height),
            borderColor: COLORS.mediterranean,
            backgroundColor: COLORS.medLight,
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: COLORS.mediterranean,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            position: 'left',
            title: { display: true, text: 'Poids (kg)', color: COLORS.bordeaux, font: { size: 12 } },
            ticks: { font: { size: 11 } },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Taille (cm)', color: COLORS.mediterranean, font: { size: 12 } },
            grid: { drawOnChartArea: false },
            ticks: { font: { size: 11 } },
          }
        }
      }
    });
  }

  /* ── Rafraîchir depuis localStorage ── */
  function refreshLocalDisplay() {
    const docs = LocalStore.sort(LocalStore.getAll('growth'), 'date', 'desc');
    renderList(docs);
    renderChart(docs);
  }

  /* ── Listener Firestore (avec fallback local) ── */
  function listenGrowth() {
    if (db) {
      try {
        db.collection('growth').orderBy('date', 'desc').onSnapshot((snap) => {
          // Mettre en cache dans localStorage
          snap.docs.forEach(doc => {
            LocalStore.save('growth', doc.id, doc.data());
          });
          renderList(snap.docs);
          renderChart(snap.docs);
        }, () => {
          refreshLocalDisplay();
        });
      } catch(e) {
        refreshLocalDisplay();
      }
    } else {
      refreshLocalDisplay();
    }
  }

  function init() {
    setDefaults();
    initForm();
    listenGrowth();
  }

  return { init, deleteEntry };
})();
