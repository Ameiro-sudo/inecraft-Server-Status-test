/**
 * 设计令牌漂移检查。
 *
 * A（个人导航）、B（状态站）、blog 三站的 `assets/css/tokens.css` 是同一套
 * 设计令牌的三份副本。实测过：三站里**只有这一份文件是共享资产**——
 * `style.css` 三份全不同、`toast.css` 只有两站有、`shell.css` 只有 blog 有，
 * 它们都是各站自己的样式表，不在这条检查的范围内。
 *
 * 比的是**每一处**自定义属性的取值，按出现顺序比，不是文件字节：
 * 注释各站自己写，字节相等是个错的目标。
 *
 * 为什么不能只比「每个属性的最后一个值」：深色主题在文件后面，所以每个属性
 * 最后出现的那次一定是深色的值。只比那个的话，**浅色主题的漂移完全查不出来**——
 * 而那恰好是最常被改的一处。（第一版就是这么写的，注入一处浅色改动试过，没报。）
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SELF = join(HERE, '..', 'assets', 'css', 'tokens.css')

/** `--名字: 取值` 的全部出现（按顺序）。同一个名字出现多次就存多条。 */
function parseTokens(css) {
  const out = new Map()
  for (const line of css.split('\n')) {
    const s = line.trim()
    if (!s.startsWith('--')) continue
    const i = s.indexOf(':')
    if (i < 0) continue
    const name = s.slice(0, i).trim()
    const value = s.slice(i + 1).trim().replace(/;\\s*$/, '').replace(/\\s+/g, ' ')
    if (!out.has(name)) out.set(name, [])
    out.get(name).push(value)
  }
  return out
}

function show(vals) {
  return Array.isArray(vals) ? vals.join(' | ') : String(vals)
}

function diff(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort()
  const rows = []
  for (const k of keys) {
    const x = show(a.get(k) ?? ['(缺)'])
    const y = show(b.get(k) ?? ['(缺)'])
    if (x !== y) rows.push({ name: k, self: x, other: y })
  }
  return rows
}

async function load(spec) {
  // 先按本地路径试，再按 URL：本机没有出网 HTTPS（git 走代理而 fetch 不走），
  // 只支持 URL 的话这条检查本地根本没法验，只能等 CI 说了算。
  try {
    return readFileSync(resolve(spec), 'utf-8')
  } catch { /* 不是可读路径，走 URL */ }
  const res = await fetch(spec)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.text()
}

const peers = process.argv.slice(2)
if (peers.length === 0) {
  console.error('用法: node scripts/check-tokens-drift.mjs <label>=<url|路径> ...')
  process.exit(2)
}

const mine = parseTokens(readFileSync(SELF, 'utf-8'))
let total = 0
for (const v of mine.values()) total += v.length
console.log('本仓 tokens.css: ' + mine.size + ' 个自定义属性 / ' + total + ' 处取值')

let bad = 0
for (const spec of peers) {
  const i = spec.indexOf('=')
  if (i < 0) {
    console.error('参数格式不对（要 label=url）: ' + spec)
    bad++
    continue
  }
  const label = spec.slice(0, i)
  const where = spec.slice(i + 1)
  let text
  try {
    text = await load(where)
  } catch (e) {
    console.error('  ' + label + ': 取不到 ' + where + ' —— ' + e.message)
    console.error('       这也算漂移：对方仓里要么没有这个文件，要么改名了。')
    bad++
    continue
  }
  const rows = diff(mine, parseTokens(text))
  if (rows.length === 0) {
    console.log('  ' + label + ': 一致')
    continue
  }
  bad++
  console.error('  ' + label + ': ' + rows.length + ' 处不同')
  for (const r of rows.slice(0, 40)) {
    console.error('     ' + r.name + ':')
    console.error('        本仓 = ' + r.self)
    console.error('        ' + label + ' = ' + r.other)
  }
  if (rows.length > 40) console.error('     …… 还有 ' + (rows.length - 40) + ' 处')
}

if (bad) {
  console.error('')
  console.error('tokens.css 已漂移：要么把改动同步过去，要么把那份改回来。')
  console.error('两边都像是故意的？那就挑一个当成这次改动的意图，把另一个对齐它。')
  process.exit(1)
}
console.log('')
console.log('tokens.css 与各站一致。')
