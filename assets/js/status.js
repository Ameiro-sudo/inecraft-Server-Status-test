/* ============================================================
 * 状态探测 + 历史记录 + 卡片渲染
 *
 * - 真实状态: 多 API 提供商(默认 api.mcstatus.io, 支持 CORS)
 * - 历史记录: localStorage, 每分钟去重, 保留 7 天
 * - 调用日志: 每次轮询的真实结果写入 AdminConfig(可清空)
 * - 回退: API 不可用时展示配置里的 demo 数据并标注"演示"
 * - 仅在含 .server-grid 的状态页启动轮询, 避免历史/管理页空转
 * ============================================================ */
(function () {
    'use strict';

    var FETCH_TIMEOUT = 8000;
    var POLL_MS = 60 * 1000;
    var HIST_PREFIX = 'sb_mc_hist_';
    var HIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
    var HIST_MAX_POINTS = 7 * 24 * 60;

    var state = { demo: false };

    /* ===== API 提供商表(与 api-management 联动) ===== */
    var PROVIDERS = {
        mcstatus: {
            label: 'api.mcstatus.io',
            base: {
                java: 'https://api.mcstatus.io/v2/status/',
                bedrock: 'https://api.mcstatus.io/v2/status/'
            },
            url: function (type, addr, port) {
                return this.base[type] + type + '/' + addr + (port ? ':' + port : '');
            },
            parse: function (d) {
                return {
                    online: !!d.online,
                    players: (d.players && d.players.online != null) ? d.players.online : 0,
                    max: (d.players && d.players.max != null) ? d.players.max : 0,
                    version: d.version && d.version.name_raw ? d.version.name_raw : '',
                    motd: d.motd && d.motd.clean ? d.motd.clean.join(' ') : '',
                    latency: d.latency != null ? d.latency : null
                };
            }
        },
        mcsrvstat: {
            label: 'api.mcsrvstat.us',
            base: {
                java: 'https://api.mcsrvstat.us/2/',
                bedrock: 'https://api.mcsrvstat.us/bedrock/3/'
            },
            url: function (type, addr, port) {
                return this.base[type] + addr + (port ? ':' + port : '');
            },
            parse: function (d) {
                return {
                    online: !!d.online,
                    players: (d.players && d.players.online != null) ? d.players.online : 0,
                    max: (d.players && d.players.max != null) ? d.players.max : 0,
                    version: typeof d.version === 'string' ? d.version : (d.version && d.version.name_raw ? d.version.name_raw : ''),
                    motd: d.motd && d.motd.clean ? d.motd.clean.join(' ') : '',
                    latency: null
                };
            }
        },
        mc6: {
            label: 'cow.mc6.cn 原始API',
            base: {
                java: 'http://cow.mc6.cn:10709/raw/',
                bedrock: 'http://cow.mc6.cn:10709/raw/'
            },
            url: function (type, addr, port) {
                return this.base[type] + addr + (port ? ':' + port : '');
            },
            parse: function (d) {
                var list = d.players;
                var online = d.online === true || d.online === 'true' ||
                             d.status === 'online' || (list && list.length != null);
                return {
                    online: !!online,
                    players: online && list && list.length != null ? list.length : 0,
                    max: d.maxPlayers || d.max_players || d.playersMax || 0,
                    version: d.version || d.gameVersion || '',
                    motd: d.motd || d.description || '',
                    latency: null
                };
            }
        }
    };

    /* ===== 服务器列表(配置层优先) ===== */
    function currentServers() {
        if (typeof AdminConfig !== 'undefined' && AdminConfig.servers) return AdminConfig.servers();
        return window.SERVERS || [];
    }

    function getProvider(type) {
        var key = 'mcstatus';
        if (typeof AdminConfig !== 'undefined' && AdminConfig.api) key = AdminConfig.api(type);
        return PROVIDERS[key] || PROVIDERS.mcstatus;
    }

    function cleanMotd(str) {
        return String(str || '')
            .replace(/[^\x20-\x7E\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalize(st) {
        st.motd = cleanMotd(st.motd);
        st.version = String(st.version || '').trim();
        st.players = Math.max(0, Math.floor(st.players) || 0);
        st.max = Math.max(0, Math.floor(st.max) || 0);
        return st;
    }

    /* ===== 真实状态探测 ===== */
    function fetchStatus(srv) {
        var provider = getProvider(srv.type);
        var url = provider.url(srv.type, srv.address, srv.port);
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error('timeout')); }, FETCH_TIMEOUT);
            fetch(url)
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (d) {
                    clearTimeout(timer);
                    resolve(normalize(provider.parse(d)));
                })
                .catch(function (err) {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    /* ===== 卡片渲染 ===== */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function cardHtml(srv, st) {
        var online = st.online;
        var cls = online ? 'online' : 'offline';
        if (srv.type === 'bedrock' && online) cls += ' bedrock';
        var addr = srv.address + (srv.port ? ':' + srv.port : '');
        var info = '';
        info += '<div class="server-info"><label>地址</label><p>' + esc(addr) + '</p></div>';
        info += '<div class="server-info"><label>类型</label><span class="server-type-badge ' + srv.type + '">' + (srv.type === 'bedrock' ? '基岩' : 'Java') + '</span></div>';
        if (online) {
            info += '<div class="server-info"><label>人数</label><p>' + st.players + ' / ' + st.max + '</p></div>';
            if (st.version) info += '<div class="server-info"><label>版本</label><p>' + esc(st.version) + '</p></div>';
            if (st.latency != null) info += '<div class="server-info"><label>延迟</label><p>' + st.latency + ' ms</p></div>';
            info += '<div class="server-motd">' + esc(st.motd || '暂无介绍') + '</div>';
        } else {
            info += '<div class="server-motd" style="color:var(--text-muted);">服务器无法连接</div>';
        }
        return '<div class="server-card" data-server-id="' + esc(srv.id) + '" tabindex="0" role="button" aria-label="查看 ' + esc(srv.name) + ' 的在线人数历史">' +
            '<div class="server-header ' + cls + '">' +
                '<div class="server-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.8rem;">' + esc(srv.icon || '?') + '</div>' +
                '<div class="server-name">' + esc(srv.name) + '</div>' +
                '<div class="server-status">' + (online ? '在线' : '离线') + '</div>' +
            '</div>' +
            '<div class="server-body">' + info + '</div>' +
        '</div>';
    }

    /* 首屏骨架卡(数据到达前的占位,避免闪现演示数据) */
    function skeletonHtml(srv) {
        return '<div class="server-card skeleton" data-server-id="' + esc(srv.id) + '" aria-hidden="true">' +
            '<div class="server-header">' +
                '<div class="server-icon">&nbsp;</div>' +
                '<div class="server-name">&nbsp;</div>' +
            '</div>' +
            '<div class="server-body">' +
                '<div class="sk-line w60"></div>' +
                '<div class="sk-line w40"></div>' +
                '<div class="sk-line w80"></div>' +
            '</div>' +
        '</div>';
    }

    function bindCardEvents(grid) {
        grid.querySelectorAll('.server-card').forEach(function (card) {
            var id = card.getAttribute('data-server-id');
            card.addEventListener('click', function () { showHistoryModal(id); });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showHistoryModal(id); }
            });
        });
    }

    function renderCards(statuses) {
        var grid = document.querySelector('.server-grid');
        if (!grid) return;
        var list = currentServers();
        if (!list.length) {
            grid.innerHTML = '<div class="no-servers"><h2>暂无服务器</h2><p>请前往管理面板添加服务器</p></div>';
            grid.removeAttribute('data-rendered');
            return;
        }
        var html = '';
        list.forEach(function (srv) {
            if (statuses && statuses[srv.id]) html += cardHtml(srv, statuses[srv.id]);
            else if (statuses) html += cardHtml(srv, demoStatus(srv));
            else html += skeletonHtml(srv);
        });
        /* 数据无变化时跳过重绘 — 保留用户焦点/悬停/选区 */
        if (grid.getAttribute('data-rendered') === html) return;
        grid.innerHTML = html;
        grid.setAttribute('data-rendered', html);
        bindCardEvents(grid);
    }

    function demoStatus(srv) {
        var d = srv.demo || {};
        return {
            online: !!d.online,
            players: d.players || 0,
            max: d.max || 0,
            version: d.version || '',
            motd: d.motd || '',
            latency: d.latency != null ? d.latency : null
        };
    }

    /* ===== 状态轮询 ===== */
    function logResults(results, list) {
        if (typeof AdminConfig === 'undefined' || !AdminConfig.addLog) return;
        results.forEach(function (r) {
            var srv = null;
            for (var i = 0; i < list.length; i++) if (list[i].id === r.id) { srv = list[i]; break; }
            if (!srv) return;
            var label = srv.address + (srv.port ? ':' + srv.port : '') + ' (' + (srv.type === 'bedrock' ? '基岩' : 'Java') + ')';
            if (r.real) {
                AdminConfig.addLog('API请求成功: ' + label + (r.st.online ? ' — 在线人数 ' + r.st.players + '/' + r.st.max : ' — 服务器离线'));
            } else {
                AdminConfig.addLog('API请求失败(已回退演示数据): ' + label);
            }
        });
    }

    function checkAll() {
        var list = currentServers();
        if (!list.length) { renderCards({}); return; }
        var jobs = list.map(function (srv) {
            return fetchStatus(srv).then(function (st) {
                return { id: srv.id, st: st, real: true };
            }).catch(function () {
                return { id: srv.id, st: demoStatus(srv), real: false };
            });
        });
        Promise.all(jobs).then(function (results) {
            var statuses = {};
            var anyReal = false;
            results.forEach(function (r) {
                statuses[r.id] = r.st;
                if (r.real) anyReal = true;
                if (r.real) recordPoint(r.id, r.st.online ? r.st.players : 0);
            });
            state.demo = !anyReal;
            renderCards(statuses);
            var note = document.querySelector('.page-header .sub');
            if (note) {
                note.innerHTML = '<a href="https://snowblock.top"><i class="fa-solid fa-snowflake"></i> SnowBlock</a><span class="dot">·</span>' +
                    (state.demo ? '演示模式(状态接口不可用)' : '实时监控 · 每 60s 刷新');
            }
            logResults(results, list);
            hydrateRemoteHistory(list.map(function (s) { return s.id; }));
        });
    }

    /* ===== localStorage 历史 ===== */
    function loadHistory(id) {
        try {
            var raw = localStorage.getItem(HIST_PREFIX + id);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function saveHistory(id, hist) {
        try {
            localStorage.setItem(HIST_PREFIX + id, JSON.stringify(hist));
        } catch (e) { /* 存储满则静默丢弃 */ }
    }

    /* ===== 远端历史注水(后端化方案A · 渐进增强) =====
     * REMOTE_HISTORY_BASE 非空时，周期性把采样器的 recent.json 合并进本地缓存，
     * 历史曲线即获得 7x24 连续数据；为空则维持纯 localStorage 行为，零破坏。
     * 部署见 sampler.py 与 deploy/DEPLOY.md。 */
    var REMOTE_HISTORY_BASE = '';
    function hydrateRemoteHistory(ids) {
        if (!REMOTE_HISTORY_BASE) return;
        ids.forEach(function (id) {
            fetch(REMOTE_HISTORY_BASE + '/' + encodeURIComponent(id) + '/recent.json')
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(function (points) {
                    if (!Array.isArray(points) || !points.length) return;
                    var seen = {}, merged = [];
                    loadHistory(id).concat(points).forEach(function (p) {
                        if (!p || typeof p.t !== 'number' || seen[p.t]) return;
                        seen[p.t] = 1;
                        merged.push({ t: p.t, n: p.n || 0 });
                    });
                    merged.sort(function (a, b) { return a.t - b.t; });
                    saveHistory(id, merged);
                })
                .catch(function () { /* 远端不可达时静默保持本地行为 */ });
        });
    }

    function recordPoint(id, n) {
        var hist = loadHistory(id);
        var now = Date.now();
        if (hist.length && now - hist[hist.length - 1].t < 60 * 1000) {
            hist[hist.length - 1] = { t: now, n: n };
        } else {
            hist.push({ t: now, n: n });
        }
        var cutoff = now - HIST_MAX_AGE;
        while (hist.length > HIST_MAX_POINTS || (hist.length && hist[0].t < cutoff)) hist.shift();
        saveHistory(id, hist);
    }

    /* ===== 历史弹窗 ===== */
    var lastModalFocus = null;

    function watchModalClose(modal) {
        if (!modal || modal.dataset.focusWatched) return;
        modal.dataset.focusWatched = '1';
        new MutationObserver(function () {
            if (modal.style.display === 'none' && lastModalFocus && document.contains(lastModalFocus)) {
                try { lastModalFocus.focus(); } catch (e) { /* 元素已不可聚焦 */ }
                lastModalFocus = null;
            }
        }).observe(modal, { attributes: true, attributeFilter: ['style'] });
    }

    function showHistoryModal(id) {
        var srv = currentServers().filter(function (s) { return s.id === id; })[0];
        if (!srv) return;
        var modal = document.getElementById('chartModal');
        var title = document.getElementById('modalTitle');
        var body = document.getElementById('modalBody');
        if (!modal || !body) return;
        watchModalClose(modal);
        title.innerHTML = '<span class="modal-title-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:rgba(255,255,255,0.08);border-radius:10px;">' + esc(srv.icon || '?') + '</span>' +
            esc(srv.name) + ' — 在线人数历史';

        var hist = loadHistory(id);
        if (!hist.length) {
            body.innerHTML = '<div class="chart-wrapper" style="height:320px;display:flex;align-items:center;justify-content:center;">' +
                '<p class="modal-note">暂无历史数据(每 60s 自动采样记录)</p></div>';
        } else {
            var daily = aggregateByDay(hist);
            var hourly = aggregateByHour(hist);
            body.innerHTML =
                '<div class="date-selector">' +
                    '<label>查看范围</label>' +
                    '<select id="histRange" class="date-input">' +
                        '<option value="day">近 7 天(按天)</option>' +
                        '<option value="hour">近 24 小时(按时段)</option>' +
                    '</select>' +
                '</div>' +
                '<div class="chart-wrapper"><canvas id="modalPlayerChart"></canvas></div>' +
                '<p class="modal-note">* 数据来自浏览器本地记录(' + hist.length + ' 个采样点)</p>';
            drawLineChart(document.getElementById('modalPlayerChart'), daily.labels, daily.values, '平均在线');
            document.getElementById('histRange').addEventListener('change', function () {
                var d = this.value === 'hour' ? hourly : daily;
                drawLineChart(document.getElementById('modalPlayerChart'), d.labels, d.values, '平均在线');
            });
        }
        lastModalFocus = document.activeElement;
        modal.style.display = 'flex';
        var closeBtn = document.getElementById('closeModal');
        if (closeBtn) closeBtn.focus();
    }

    function aggregateByDay(hist) {
        var map = {};
        hist.forEach(function (p) {
            var d = new Date(p.t);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (!map[key]) map[key] = { sum: 0, n: 0 };
            map[key].sum += p.n;
            map[key].n++;
        });
        return toSeries(map, function (k) { return k; });
    }

    function aggregateByHour(hist) {
        var map = {};
        var now = Date.now();
        hist.forEach(function (p) {
            if (now - p.t > 24 * 60 * 60 * 1000) return;
            var d = new Date(p.t);
            var key = String(d.getHours()).padStart(2, '0') + ':00';
            if (!map[key]) map[key] = { sum: 0, n: 0 };
            map[key].sum += p.n;
            map[key].n++;
        });
        return toSeries(map, function (k) { return k; });
    }

    function toSeries(map, keyFn) {
        var labels = [], values = [];
        Object.keys(map).sort().forEach(function (k) {
            labels.push(keyFn(k));
            values.push(Math.round(map[k].sum / map[k].n));
        });
        return { labels: labels, values: values };
    }

    function drawLineChart(canvas, labels, values, label) {
        if (!canvas || typeof Chart === 'undefined') return;
        var existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
        new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label, data: values,
                    borderColor: '#8fd8ef', backgroundColor: 'rgba(143,216,239,0.15)',
                    borderWidth: 2, pointBackgroundColor: '#8fd8ef',
                    pointBorderColor: '#fff', pointBorderWidth: 1,
                    pointRadius: 3, tension: 0.35, fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'var(--chart-tick)' } }, tooltip: { mode: 'index', intersect: false } },
                scales: {
                    x: { ticks: { color: 'var(--chart-tick)' }, grid: { color: 'var(--chart-grid)' } },
                    y: { beginAtZero: true, ticks: { color: 'var(--chart-tick)', stepSize: 1 }, grid: { color: 'var(--chart-grid)' } }
                }
            }
        });
    }

    /* ===== 对外接口 ===== */
    var api = {
        state: state,
        PROVIDERS: PROVIDERS,
        currentServers: currentServers,
        fetchStatus: fetchStatus,
        loadHistory: loadHistory,
        recordPoint: recordPoint,
        aggregateByDay: aggregateByDay,
        aggregateByHour: aggregateByHour,
        renderCards: renderCards,
        showHistoryModal: showHistoryModal
    };
    window.mcStatus = api;

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.querySelector('.server-grid')) return; // 仅状态页轮询
        renderCards(null); // 首屏骨架屏
        checkAll();
        setInterval(checkAll, POLL_MS);
    });
})();