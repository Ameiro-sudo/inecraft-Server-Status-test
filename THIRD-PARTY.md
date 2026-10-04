# 第三方组件

本仓库**没有任何构建步骤**，所有依赖都是把文件直接提交进 ssets/vendor/，
所以这份清单就是仓库里实际存在的那些文件。ssets/js/ 下的四个 js
（pp.js、status.js、dmin-config.js、servers.js）是本站原创。

目录名带版本号是为了让"现在跑的是哪一版"能一眼看出来。

---

## Font Awesome Free 6.5.1

- 文件：ssets/vendor/font-awesome@6.5.1/
- 主页：https://fontawesome.com
- 许可：**图标** CC BY 4.0、**字体** SIL OFL 1.1、**代码** MIT
- 本仓库只取了 Free 版里的 Solid / Regular / Brands 三套图标字体与 ll.min.css

### 本站修过的一个问题

这份 webfonts/fa-solid-900.woff2 曾经只有 **1828 字节**（	otalSfntSize=3628，
约 1% 的字形），于是全站图标渲染成豆腐块。修法是从个人站那份完整的
156496 字节文件复制过来（	otalSfntSize=399877），同时补上了
ll.min.css 引用、但从未进过仓库的 a-brands-400.woff2 与
a-regular-400.woff2。

**还差一个**：ll.min.css 仍然引用 a-v4compatibility.woff2，本仓库没有它。
现在没问题——本页只用 a-solid（a-brands / a-regular 是补齐的，
a-v4compatibility 只有在用到 v4 时代图标类名时才会请求）。但那是**当前**恰好
不请求，不是结构上不会请求。

**教训**：vendor 里的残缺文件不会自己报警，只会在页面上表现为"图标全没了"。
体积本身就是一项检查。

---

## Chart.js 4.4.1

- 文件：ssets/vendor/chartjs/chart.umd.min.js（205419 字节）
- 主页：https://www.chartjs.org
- 许可：MIT
- 来源：jsDelivr 的 /npm/chart.js@4.4.1/dist/chart.umd.js
- 注意：文件名里的 chartjs/ **没有版本号**，是全仓唯一一个不带版本号的 vendor
  目录。文件头里那句「Do NOT use SRI with dynamically generated files」说明
  它是 jsDelivr 动态拼出来的——将来要固定来源就换成带版本号的目录名，
  并自己存一份静态文件

---

## ZCOOL KuaiLe

- 文件：ssets/vendor/fonts/ZCOOL_KuaiLe.css、iles/ZCOOL_KuaiLe.woff2
- 来源：Google Fonts
- 许可：SIL Open Font License 1.1
- 改动：原样搬运，未修改字形

---

## 本站自有代码

ssets/css/tokens.css、style.css、ssets/js/*.js、七个 .html
（index / 404 / login / dmin / pi-management / iew-logs /
player-history-chart）与 ssets/sampler/ 均为本站原创。
