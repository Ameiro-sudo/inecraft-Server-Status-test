(function() {
    'use strict';
    /* 退出登录: 清除会话并回到登录页 */
    if (/[?&]logout=/.test(location.search)) {
        try { sessionStorage.removeItem('admin_logged_in'); } catch (e) {}
        if (location.pathname.split('/').pop() !== 'login.html') location.replace('login.html');
    }
})();

var app = (function() {
    'use strict';

    var config = {
        bgImage: (window.matchMedia('(orientation: portrait)').matches
            ? 'assets/vendor/images/bg-portrait.webp'
            : 'assets/vendor/images/bg.webp'),
        chartCdn: 'https://cdn.jsdelivr.net/npm/chart.js'
    };

    /* ===== Loader ===== */
    var loader = document.getElementById('loader');
    var loaded = false;
    var minTimePassed = false;
    var loaderTimeout;

    if (loader) {
        var img = new Image();
        img.src = config.bgImage;
        img.onload = function() { loaded = true; checkHideLoader(); };
        img.onerror = function() { loaded = true; checkHideLoader(); };

        setTimeout(function() {
            minTimePassed = true;
            checkHideLoader();
        }, 1000);

        loaderTimeout = setTimeout(function() {
            if (!loader.classList.contains('hidden')) {
                loaded = true;
                minTimePassed = true;
                checkHideLoader();
            }
        }, 5000);
    }

    function checkHideLoader() {
        if (loaded && minTimePassed && loader && !loader.classList.contains('hidden')) {
            clearTimeout(loaderTimeout);
            loader.classList.add('hidden');
            document.body.classList.add('bg-loaded');
            loader.addEventListener('transitionend', function() {
                if (loader.classList.contains('hidden')) {
                    loader.style.display = 'none';
                }
            }, { once: true });
        }
    }

    /* ===== Snow Canvas ===== */
    var canvas = document.getElementById('snowCanvas');
    if (canvas) {
        var ctx = canvas.getContext('2d');
        var particles = [];
        var w, h;
        var frame = 0;
        var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var isMobile = window.innerWidth < 768;

        function resizeCanvas() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        var MAX_PARTICLES = isMobile ? 15 : 30;

        function createParticle() {
            return {
                x: Math.random() * w,
                y: Math.random() * h - 20,
                r: Math.random() * 2.4 + 1,
                speed: Math.random() * 0.6 + 0.2,
                wind: Math.random() * 0.3 - 0.12,
                alpha: Math.random() * 0.4 + 0.15
            };
        }

        function initSnow() {
            for (var i = 0; i < MAX_PARTICLES; i++) {
                var p = createParticle();
                p.y = Math.random() * h;
                particles.push(p);
            }
        }
        initSnow();

        function drawSnow() {
            frame++;
            if (frame % 2 === 0) {
                requestAnimationFrame(drawSnow);
                return;
            }
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, ' + p.alpha + ')';
                ctx.fill();
                p.y += p.speed;
                p.x += p.wind;
                if (p.y > h + 25) particles[i] = createParticle();
                if (p.x > w + 20) p.x = -15;
                if (p.x < -20) p.x = w + 10;
            }
            while (particles.length < (isMobile ? 20 : 30)) {
                particles.push(createParticle());
            }
            requestAnimationFrame(drawSnow);
        }
        if (!reducedMotion) drawSnow();
    }

    /* ===== Toast ===== */
    var toast = document.getElementById('toast');
    var toastTimer = null;

    function showToast(msg, dur) {
        if (!toast) return;
        if (dur === undefined) dur = 2000;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() {
            toast.classList.remove('show');
        }, dur);
    }

    /* ===== Auth (管理页守卫) ===== */
    function requireAuth() {
        if (sessionStorage.getItem('admin_logged_in') !== '1') {
            var from = encodeURIComponent(location.pathname.split('/').pop());
            location.replace('login.html?from=' + from);
        }
    }

    function logout() {
        try { sessionStorage.removeItem('admin_logged_in'); } catch (e) {}
        location.replace('login.html');
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ===== Modal (index.html) ===== */
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
                '<label>选择日期（模拟）</label>' +
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
            modalBody.innerHTML += '<p class="status-error">Chart.js 加载失败</p>';
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

    return {
        config: config,
        showToast: showToast,
        hideModal: hideModal,
        showModal: showModal,
        requireAuth: requireAuth,
        logout: logout,
        esc: esc
    };
})();
