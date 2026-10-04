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
            : 'assets/vendor/images/bg.webp')
    };

    /* ===== Loader =====
     * 内容展示与背景大图解耦: 最短展示 1s 后即撤掉 loader。
     * 背景图由 CSS(body::after)自行渲染,无需等待 JS 预载完整下载
     * (此前内容被 ~700KB 的背景图下载卡住,严重拖慢首屏)。 */
    var loader = document.getElementById('loader');
    var minTimePassed = false;

    if (loader) {
        setTimeout(function() {
            minTimePassed = true;
            checkHideLoader();
        }, 1000);
    }

    function checkHideLoader() {
        if (minTimePassed && loader && !loader.classList.contains('hidden')) {
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

    /* ===== Modal =====
     * 这里原来还有一整套 showModal()：硬编码的假数据（data: [3,8,15,12,18,22]）、
     * 一句「* 静态演示数据，非真实服务器状态」、以及切日期时 Math.random() 现编
     * 6 个数。它与 status.js 的 showHistoryModal() 操作**同一组 DOM id**
     * （#chartModal / #modalTitle / #modalBody / #modalPlayerChart）。
     *
     * 两套并存的后果不是「冗余但无害」：下面那三条关闭绑定（closeBtn / 背景点击 /
     * Escape）确实在跑，于是 status.js 建出来的 Chart 从来不被销毁——关闭动作走
     * 的是这里的 hideModal()，而它自己的 currentChart 永远是 null。每开关一次
     * 弹窗就泄漏一个 Chart 实例。
     *
     * 所以这里只留「把弹层藏起来」这一件事。图表与关闭绑定都归 status.js，
     * 因为它是唯一打开弹层的一方。 */
    var chartModal = document.getElementById('chartModal');

    function hideModal() {
        if (chartModal) chartModal.style.display = 'none';
    }

    return {
        config: config,
        showToast: showToast,
        hideModal: hideModal,
        requireAuth: requireAuth,
        logout: logout,
        esc: esc
    };
})();
