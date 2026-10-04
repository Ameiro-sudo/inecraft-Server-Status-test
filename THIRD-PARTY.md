# 第三方组件

本仓库**没有任何构建步骤**，所有依赖都是把文件直接提交进 `assets/vendor/`，
所以这份清单就是仓库里实际存在的那些文件。`assets/js/` 下的四个 js
（`app.js`、`status.js`、`admin-config.js`、`servers.js`）是本站原创。

目录名带版本号是为了让「现在跑的是哪一版」能一眼看出来。

---

## Font Awesome Free 6.5.1

- 文件：`assets/vendor/font-awesome@6.5.1/`
- 主页：https://fontawesome.com
- 许可：**图标** CC BY 4.0、**字体** SIL OFL 1.1、**代码** MIT
- 本仓库只取了 Free 版里的 Solid / Regular / Brands 三套图标字体与 `all.min.css`

### 本站修过的一个问题

这份 `webfonts/fa-solid-900.woff2` 曾经只有 **1828 字节**（`totalSfntSize=3628`，
约 1% 的字形），于是全站图标渲染成豆腐块。修法是从个人站那份完整的
156496 字节文件复制过来（`totalSfntSize=399877`），同时补上了
`all.min.css` 引用、但从未进过仓库的 `fa-brands-400.woff2` 与
`fa-regular-400.woff2`。

**还差一个**：`all.min.css` 仍然引用 `fa-v4compatibility.woff2`，本仓库没有它。
现在没问题——本页只用 `fa-solid`（`fa-brands` / `fa-regular` 是补齐的，
`fa-v4compatibility` 只有在用到 v4 时代图标类名时才会请求）。但那是**当前**恰好
不请求，不是结构上不会请求。

**教训**：vendor 里的残缺文件不会自己报警，只会在页面上表现为「图标全没了」。
体积本身就是一项检查。

---

## Chart.js 4.4.1

- 文件：`assets/vendor/chartjs/chart.umd.min.js`（205419 字节）
- 主页：https://www.chartjs.org
- 许可：MIT
- 来源：jsDelivr 的 `/npm/chart.js@4.4.1/dist/chart.umd.js`
- 注意：目录名 `chartjs/` **没有版本号**，是全仓唯一一个不带版本号的 vendor 目录。
  文件头里那句「Do NOT use SRI with dynamically generated files」说明它是
  jsDelivr 动态拼出来的——将来要固定来源，就换成带版本号的目录名并自己存一份
  静态文件

---

## ZCOOL KuaiLe

- 文件：`assets/vendor/fonts/ZCOOL_KuaiLe.css`、`files/ZCOOL_KuaiLe.woff2`
- 来源：Google Fonts
- 许可：SIL Open Font License 1.1
- 改动：原样搬运，未修改字形

---

## 本仓库自有代码

`assets/css/tokens.css`、`assets/css/style.css`、`assets/js/*.js`、七个 `.html`
（index / 404 / login / admin / api-management / view-logs / player-history-chart）、
`sampler.py` 与 `deploy/` 下的两份文档，均为本站原创。

`sampler.py` 写好了也实测过，但**尚未部署**——它需要服务器上常驻
（systemd timer）并由 nginx 暴露只读目录。所以状态站的历史曲线目前只有访客
自己浏览器里积累的那几个点，页面上已经按实情说明（`showHistoryModal` 的空状态）。
上线步骤见 `deploy/DEPLOY.md`。
