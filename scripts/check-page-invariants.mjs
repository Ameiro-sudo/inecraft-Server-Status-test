/**
 * 页面不变量检查。
 *
 * 这三条约束以前写成 HTML 注释里的散文 —— 而散文拦不住回归。
 * index.html 里那段讲 frame-ancestors 的说明少写了一个 `<!--`，整段说明就变成正文，
 * 把 <title> 和 20 个 <meta> 从 head 挤进了 body：线上 15125 字节的响应里含着它，
 * 每个访客都会先看到一段无样式的黑字。防错措施自己成了最大的那次错误。
 *
 * 所以只保留「删掉它之后，下一个人会做出一个具体的错动作、而且不会报错」的那类约束，
 * 并且把它做成会红的检查，而不是更长的注释。
 *
 * 规则
 *   1. head 里不许有注释之外的裸文本，注释必须闭合。
 *      这是那次事故的直接形态，也顺带盖住「少写一个 `<!--`」这一类错。
 *   2. 内联 <style> 里不许出现 @media (prefers-color-scheme: dark)。
 *      深色主题挂在 <html class="dark"> 上，与页面顶部那段同步脚本同源；换成
 *      media query 后，「系统浅色 + localStorage 里存过 dark」会得到深色卡片配
 *      浅色背景。它是教科书写法，会被顺手改回去，而且改回去不会报错。
 *   3. toast.css 的 <link> 必须排在 style.css 之后。
 *      它靠层叠盖过 style.css 里的同名规则，顺序反了就是静默失效。
 *
 * 只报事实，不报「该不该改」。用法：node scripts/check-page-invariants.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_TEXT = new Set(['style', 'script', 'title', 'textarea'])
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const squash = (s) => s.trim().replace(/\s+/g, ' ').slice(0, 70)

const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()
if (pages.length === 0) {
  console.error('没找到任何 .html —— 检查脚本是不是被放到别处了：' + ROOT)
  process.exit(2)
}

/** head 区域里，落在注释外、原始文本元素外的正文文字。 */
function headText(html) {
  const open = /<head[^>]*>/i.exec(html)
  if (!open) return { err: '没有 <head>' }
  const from = open.index + open[0].length
  const close = /<\/head\s*>/i.exec(html.slice(from))
  if (!close) return { err: '没有 </head>，结构已经断了' }
  const region = html.slice(from, from + close.index)
  const re = /<!--[\s\S]*?(?:-->|$)|<\/?\s*[a-zA-Z][^>]*?>/g
  const hits = []
  let last = 0
  let m
  while ((m = re.exec(region)) !== null) {
    const gap = region.slice(last, m.index)
    if (gap.trim() !== '') hits.push(squash(gap))
    last = re.lastIndex
    const tok = m[0]
    if (tok.startsWith('<!--')) {
      if (!tok.endsWith('-->')) return { err: '注释没有闭合：走到这里还停在 <!-- 里面' }
      continue
    }
    const name = ((/^<\/?\s*([a-zA-Z][^\s/>]*)/.exec(tok) || [null, ''])[1] || '').toLowerCase()
    if (!RAW_TEXT.has(name) || tok.startsWith('</')) continue
    // 原始文本元素的内容是合法的，整段跳过，别把它当成裸文本
    const end = new RegExp('</' + name + '\\s*>', 'i').exec(region.slice(re.lastIndex))
    if (!end) return { err: '未闭合的 <' + name + '>' }
    re.lastIndex = re.lastIndex + end.index + end[0].length
    last = re.lastIndex
  }
  const tail = region.slice(last)
  if (tail.trim() !== '') hits.push(squash(tail))
  return { hits }
}

function styleBlocks(html) {
  const out = []
  const re = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi
  let m
  while ((m = re.exec(html)) !== null) out.push(m[1])
  return out
}

function stylesheets(html) {
  const out = []
  const re = /<link\b[^>]*>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    const rel = (/\brel\s*=\s*["']([^"']*)["']/i.exec(tag) || [null, ''])[1].toLowerCase()
    const href = (/\bhref\s*=\s*["']([^"']*)["']/i.exec(tag) || [null, ''])[1]
    if (rel.split(/\s+/).includes('stylesheet') && /\.css(\?|#|$)/.test(href)) out.push(href)
  }
  return out
}

let bad = 0
let cmtTotal = 0
let bytesTotal = 0
for (const name of pages) {
  const html = readFileSync(join(ROOT, name), 'utf-8')
  const problems = []

  const { err, hits } = headText(html)
  if (err) problems.push('head 结构：' + err)
  else for (const t of hits) problems.push('head 里有注释外的裸文本，会被当正文画出来：「' + t + '」')

  for (const css of styleBlocks(html)) {
    if (/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i.test(stripCssComments(css))) {
      problems.push('内联 <style> 里用了 @media (prefers-color-scheme: dark)：深色主题挂在 html.dark 上，'
        + '用 media query 会和 localStorage 里的主题打架（系统浅色 + 存过 dark = 卡片深色、背景浅色）')
    }
  }

  const links = stylesheets(html)
  const si = links.findIndex((h) => /(^|\/)style\.css(\?|#|$)/.test(h))
  const ti = links.findIndex((h) => /(^|\/)toast\.css(\?|#|$)/.test(h))
  if (si >= 0 && ti >= 0 && ti < si) {
    problems.push('toast.css 排在 style.css 之前：它靠层叠盖过 style.css 的同名规则，顺序反了就不生效')
  }

  const cmt = (html.match(/<!--[\s\S]*?-->/g) || []).reduce((n, c) => n + c.length, 0)
  const bytes = Buffer.byteLength(html, 'utf-8')
  cmtTotal += cmt
  bytesTotal += bytes
  const pct = (100 * cmt / bytes).toFixed(1) + '%'
  if (problems.length === 0) {
    console.log('  ' + name.padEnd(28) + 'ok     注释 ' + String(cmt).padStart(5) + ' B / ' + bytes + ' B = ' + pct)
    continue
  }
  bad++
  console.log('  ' + name.padEnd(28) + 'FAIL   注释 ' + String(cmt).padStart(5) + ' B / ' + bytes + ' B = ' + pct)
  for (const p of problems) console.log('      - ' + p)
}

console.log('')
console.log(pages.length + ' 个页面，注释合计 ' + cmtTotal + ' B / 共 ' + bytesTotal + ' B = '
  + (100 * cmtTotal / bytesTotal).toFixed(1) + '%')
if (bad) {
  console.error(bad + ' 个页面不合格。上面每条都对应一个具体的、不会被浏览器报出来的错动作。')
  process.exit(1)
}
console.log('页面不变量全部成立。')
