import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { CHAPTERS, DURATION, SUBTITLES } from '../src/timeline.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'tmp/gemini-copy')
const sources = [
  'src/screen.js', 'src/shots/prologue.js', 'src/shots/voice.js',
  'src/shots/voice-chain.js', 'src/shots/cinema-chapter.js',
  'src/shots/cinema-perception.js', 'src/shots/cinema-agency.js',
  'src/shots/cinema-proof.js', 'src/shots/cinema-finale.js',
  'src/shots/cinema-finish.js', 'src/shots/mechanism-chapter.js',
  'src/shots/mechanism-actions.js', 'src/shots/journey-ui.js',
]
const items = []
for (const source of sources) {
  const content = readFileSync(join(root, source), 'utf8')
  const tokens = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g
  for (const match of content.matchAll(tokens)) {
    const literal = match[0]
    if (literal.startsWith('//') || literal.startsWith('/*') || !/[\u3400-\u9fff]/u.test(literal)) continue
    const template = literal.startsWith('`') && literal.includes('${')
    const text = template ? literal.slice(1, -1) : runInNewContext(literal, Object.create(null), { timeout: 100 })
    const line = content.slice(0, match.index).split('\n').length
    items.push({ id: `screen-${String(items.length + 1).padStart(3, '0')}`, file: source, line, template, text })
  }
}
const inventory = {
  film: { title: '银龄智办', duration: DURATION, format: '214 秒无音轨机制演示；中文主字幕与英文副字幕；11 章节', existingVideo: 'film-v16' },
  chapters: CHAPTERS,
  subtitles: SUBTITLES.map((cue, index) => ({ id: `subtitle-${String(index + 1).padStart(3, '0')}`, ...cue, seconds: Number((cue.b - cue.a).toFixed(3)) })),
  screenText: items,
  narrative: readFileSync(join(root, 'docs/narrative.md'), 'utf8'),
}
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n')
const timestamp = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`
const packet = [
  '# 全片文案包：提交 Gemini 润色', '',
  '本文件为原文与润色要求，不是 Gemini 的润色结果。完整覆盖当前影片的章节、字幕和画内候选文字；当前成片与视频源文件均未修改。', '',
  readFileSync(join(root, 'docs/gemini-copy-brief.md'), 'utf8'), '',
  '## 当前章节与时间轴', '',
  ...inventory.chapters.map((chapter) => `- ${timestamp(chapter.start)}—${timestamp(chapter.end)} · ${chapter.name} · ${chapter.title} · ${chapter.en}${chapter.section ? ` · ${chapter.section}` : ''}`), '',
  '## 当前中英文字幕', '',
]
for (const cue of inventory.subtitles) packet.push(`### ${cue.id} · ${timestamp(cue.a)}—${timestamp(cue.b)} · ${cue.seconds} 秒`, '', `中文：${cue.zh}`, '', `英文：${cue.en}`, '')
packet.push('## 当前画内候选文字', '', '包含共享界面与备用分支；内部对象名称、实际按钮、技术返回及业务状态不应仅为语言风格而改写。', '')
for (const item of items) packet.push(`### ${item.id} · \`video/${item.file}:${item.line}\``, '', item.text, '')
packet.push('## 当前已确认叙事', '', inventory.narrative, '')
writeFileSync(join(root, 'docs/gemini-copy-packet.md'), packet.join('\n'))
console.log(JSON.stringify({ chapters: CHAPTERS.length, subtitles: SUBTITLES.length, screenText: items.length, output: join(output, 'inventory.json') }))
