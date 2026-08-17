/* ============================================================
 * 管理员配置层 — 真实管理接口(预留)
 *
 * 当前实现: localStorage 持久化(纯静态站, 无需后端)
 *
 * ---- 接入真实后端时, 只需替换 load/save/verify 三个函数 ----
 *   GET  /api/config      -> load()     返回完整配置对象
 *   POST /api/config      -> save()     提交完整配置对象
 *   POST /api/auth        -> verify()   校验用户名+密码(SHA-256)
 * 其余页面代码无需改动, 即完成真实管理员配置接口对接。
 * ============================================================ */
var AdminConfig = (function () {
    'use strict';

    var STORE_KEY = 'sb_admin_config_v1';
    var LOG_KEY = 'sb_mc_logs';
    var LOG_MAX = 200;

    var DEFAULT_SERVERS = (window.SERVERS || []).map(function (s) {
        return JSON.parse(JSON.stringify(s));
    });

    var defaults = {
        username: 'admin',
        passwordHash: '',   /* SHA-256 hex; 留空 = 任意密码可登录(演示) */
        servers: DEFAULT_SERVERS,
        javaApi: 'mcstatus',    /* mcstatus | mcsrvstat | mc6 */
        bedrockApi: 'mcstatus'  /* mcstatus | mcsrvstat */
    };

    var cache = null;

    function load() {
        if (cache) return cache;
        var cfg = null;
        try {
            var raw = localStorage.getItem(STORE_KEY);
            if (raw) cfg = JSON.parse(raw);
        } catch (e) { cfg = null; }
        if (!cfg) {
            cfg = JSON.parse(JSON.stringify(defaults));
        } else {
            /* 仅补缺失字段, 不覆盖已存储的空值(如管理员删空的服务器列表) */
            if (cfg.servers == null) cfg.servers = JSON.parse(JSON.stringify(DEFAULT_SERVERS));
            if (!cfg.username) cfg.username = defaults.username;
            if (!cfg.javaApi) cfg.javaApi = defaults.javaApi;
            if (!cfg.bedrockApi) cfg.bedrockApi = defaults.bedrockApi;
        }
        cache = cfg;
        return cfg;
    }

    function save() {
        if (!cache) return;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(cache)); } catch (e) { /* 存储满则静默 */ }
    }

    function reset() {
        cache = null;
        try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    }

    /* ===== 服务器 ===== */
    function servers() { return load().servers; }
    function saveServers(list) {
        load().servers = Array.isArray(list) ? list : [];
        save();
    }
    function server(id) {
        var list = load().servers;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
        return null;
    }

    /* ===== API 提供商 ===== */
    function api(type) {
        var c = load();
        return type === 'bedrock' ? c.bedrockApi : c.javaApi;
    }
    function saveApi(javaApi, bedrockApi) {
        var c = load();
        c.javaApi = javaApi || defaults.javaApi;
        c.bedrockApi = bedrockApi || defaults.bedrockApi;
        save();
    }

    /* ===== 凭据 ===== */
    function credentials() {
        var c = load();
        return { username: c.username, passwordHash: c.passwordHash };
    }
    function saveCredentials(username, hash) {
        var c = load();
        c.username = username || defaults.username;
        c.passwordHash = hash || '';
        save();
    }

    function shaAvailable() {
        return window.crypto && crypto.subtle && window.TextEncoder;
    }

    function sha256(str) {
        var data = new TextEncoder().encode(str);
        return crypto.subtle.digest('SHA-256', data).then(function (buf) {
            return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                return ('0' + b.toString(16)).slice(-2);
            }).join('');
        });
    }

    /* 校验用户名+密码; 未配置密码时(演示)任意密码通过 */
    function verify(username, password) {
        var cred = credentials();
        if (username !== cred.username) return Promise.resolve(false);
        if (!cred.passwordHash) return Promise.resolve(true);
        if (!shaAvailable()) return Promise.reject(new Error('no-crypto'));
        return sha256(password).then(function (hex) { return hex === cred.passwordHash; });
    }

    /* 由明文密码生成 SHA-256 hex(用于设置新密码) */
    function setPassword(password) {
        if (!shaAvailable()) return Promise.reject(new Error('no-crypto'));
        return sha256(password);
    }

    /* ===== 调用日志(真实记录) ===== */
    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function loadLogs() {
        try {
            var raw = localStorage.getItem(LOG_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function addLog(msg) {
        var logs = loadLogs();
        var d = new Date();
        var time = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
                   pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        logs.push({ time: time, msg: msg });
        if (logs.length > LOG_MAX) logs = logs.slice(logs.length - LOG_MAX);
        try { localStorage.setItem(LOG_KEY, JSON.stringify(logs)); } catch (e) {}
        return logs;
    }

    function clearLogs() {
        try { localStorage.removeItem(LOG_KEY); } catch (e) {}
    }

    return {
        load: load, save: save, reset: reset,
        servers: servers, saveServers: saveServers, server: server,
        api: api, saveApi: saveApi,
        credentials: credentials, saveCredentials: saveCredentials,
        shaAvailable: shaAvailable, setPassword: setPassword, verify: verify,
        loadLogs: loadLogs, addLog: addLog, clearLogs: clearLogs
    };
})();