(function() {
    'use strict';

    var chartModal = document.getElementById('chartModal');
    var modalTitle = document.getElementById('modalTitle');
    var modalBody = document.getElementById('modalBody');
    var closeBtn = document.getElementById('closeModal');
    var currentChart = null;

    function hideModal() {
        if (chartModal) chartModal.style.display = 'none';
        if (currentChart) { currentChart.destroy(); currentChart = null; }
    }

    function showModal(id, name) {
        if (!chartModal || !modalBody) return;
        var card = document.querySelector('.server-card[data-server-id="' + id + '"]');
        var iconHtml = '';
        if (card) {
            var iconEl = card.querySelector('.server-icon');
            if (iconEl && iconEl.textContent) {
                iconHtml = '<span class="modal-title-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:rgba(255,255,255,0.08);border-radius:10px;">' + iconEl.textContent + '</span>';
            }
        }
        modalTitle.innerHTML = iconHtml + name + ' — 在线人数历史';
        modalBody.innerHTML =
            '<div class="date-selector">' +
                '<label>📅 选择日期（模拟）</label>' +
                '<input type="date" id="mockDate" class="date-input" value="' + new Date().toISOString().split('T')[0] + '">' +
            '</div>' +
            '<div class="chart-wrapper"><canvas id="modalPlayerChart"></canvas></div>' +
            '<p class="modal-note">* 静态演示数据，非真实服务器状态</p>';

        var chartCtx = document.getElementById('modalPlayerChart');
        if (chartCtx && typeof Chart !== 'undefined') {
            if (currentChart) currentChart.destroy();
            currentChart = new Chart(chartCtx, {
                type: 'line',
                data: {
                    labels: ['10:00','11:00','12:00','13:00','14:00','15:00'],
                    datasets: [{
                        label: '在线人数', data: [3,8,15,12,18,22],
                        borderColor: '#8fd8ef', backgroundColor: 'rgba(143,216,239,0.15)',
                        borderWidth: 2, pointBackgroundColor: '#8fd8ef',
                        pointBorderColor: '#fff', pointBorderWidth: 1,
                        pointRadius: 4, tension: 0.35, fill: true
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: 'rgba(255,255,255,0.7)' } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { beginAtZero: true, ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                }
            });
        } else {
            modalBody.innerHTML += '<p class="status-error">⚠️ Chart.js 加载失败</p>';
        }
        chartModal.style.display = 'flex';
    }

    document.querySelectorAll('.server-card').forEach(function(card) {
        var id = card.getAttribute('data-server-id');
        var name = card.querySelector('.server-name')?.textContent || '服务器';
        card.addEventListener('click', function() { showModal(id, name); });
    });

    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (chartModal) chartModal.addEventListener('click', function(e) { if (e.target === this) hideModal(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideModal(); });

    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'mockDate' && currentChart) {
            currentChart.data.datasets[0].data = Array.from({length: 6}, function() { return Math.floor(Math.random() * 28) + 2; });
            currentChart.update();
        }
    });
})();
