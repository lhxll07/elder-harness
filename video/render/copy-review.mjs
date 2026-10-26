import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const folder = join(root, 'tmp/gemini-copy')
const inventory = JSON.parse(readFileSync(join(folder, 'inventory.json'), 'utf8'))
const envelope = JSON.parse(readFileSync(join(folder, 'response-envelope.json'), 'utf8'))
assert(!envelope.error, 'Gemini 返回错误，不能作为润色结果')
assert.equal(typeof envelope.response, 'string', '缺少 Gemini 原始回复')
const payload = envelope.response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
const proposal = JSON.parse(payload)
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
assert(nonempty(proposal.editorialDirection), '缺少编辑口径')
for (const key of ['chapters', 'subtitles', 'screenText', 'notes', 'strongestLines']) assert(Array.isArray(proposal[key]), `缺少 ${key}`)
const validateIds = (proposed, originals, field) => {
  const known = new Set(originals.map((item) => item[field]))
  const received = new Set()
  for (const item of proposed) {
    assert(known.has(item[field]), `未知条目 ${item[field]}`)
    assert(!received.has(item[field]), `重复条目 ${item[field]}`)
    received.add(item[field])
  }
  return received
}
const subtitleIds = validateIds(proposal.subtitles, inventory.subtitles, 'id')
const chapterIds = validateIds(proposal.chapters, inventory.chapters, 'name')
validateIds(proposal.screenText, inventory.screenText, 'id')
assert.equal(subtitleIds.size, inventory.subtitles.length, '字幕未完整覆盖')
assert.equal(chapterIds.size, inventory.chapters.length, '章节未完整覆盖')
for (const item of proposal.subtitles) assert(nonempty(item.zh) && nonempty(item.en), `${item.id} 缺少中英字幕`)
for (const item of proposal.chapters) assert(nonempty(item.title) && nonempty(item.en), `${item.name} 缺少标题`)
const screens = new Map(inventory.screenText.map((item) => [item.id, item]))
const warnings = []
for (const item of proposal.screenText) {
  assert(nonempty(item.text), `${item.id} 缺少画内文案`)
  const original = screens.get(item.id)
  if (original.template) assert.deepEqual(item.text.match(/\$\{[^}]*\}/g), original.text.match(/\$\{[^}]*\}/g), `${item.id} 改动了动态占位符`)
  if (item.text.length > original.text.length * 1.15 + 2) warnings.push(`${item.id} 画内文案明显增长，需检查现有面板宽度。`)
  for (const token of ['SELF_TYPED', 'reading_tables', 'load_skill', 'ask_person', 'T0', 'T1', 'T2']) {
    if (original.text.includes(token) && !item.text.includes(token)) warnings.push(`${item.id} 移除了技术锚点 ${token}，需技术审核。`)
  }
}
const revisedSubtitles = new Map(proposal.subtitles.map((item) => [item.id, item]))
for (const original of inventory.subtitles) {
  const revised = revisedSubtitles.get(original.id)
  if (revised.zh.length > original.zh.length + 3) warnings.push(`${original.id} 中文字幕增加 ${revised.zh.length - original.zh.length} 字，时长 ${original.seconds} 秒。`)
}
const timestamp = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${(seconds - minutes * 60).toFixed(2).padStart(5, '0')}`
}
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>')
const models = Object.keys(envelope.stats?.models ?? {})
const lines = [
  '# 全片文案润色对照稿（Gemini）', '',
  '状态：真实调用本机 Gemini CLI 生成的候选稿，尚未替换视频源文件或重新渲染。现有 film-v16 成片保持不变。', '',
  `范围：${inventory.chapters.length} 章、${inventory.subtitles.length} 条中英文字幕、${inventory.screenText.length} 项画内候选文字。画内清单含共享界面与备用分支，应用前需按实际镜头筛选。`, '',
  `调用记录模型：${models.length ? models.map((model) => `\`${model}\``).join('、') : 'CLI 未在结构化统计中报告模型名称'}。原始请求与回复保存在 \`video/tmp/gemini-copy/\`，并禁用 Gemini 的全部工具调用。`, '',
  '## 编辑口径', '', proposal.editorialDirection, '',
  '## 章节导航', '',
  '| 时间 | 原标题 | 建议标题 | 英文 | 所属层次 / 机制 |',
  '| --- | --- | --- | --- | --- |',
]
const revisedChapters = new Map(proposal.chapters.map((item) => [item.name, item]))
for (const original of inventory.chapters) {
  const revised = revisedChapters.get(original.name)
  lines.push(`| ${timestamp(original.start)}—${timestamp(original.end)} | ${cell(original.title)} | ${cell(revised.title)} | ${cell(revised.en)} | ${cell(revised.section)} |`)
}
lines.push('', '## 全片中英文字幕', '')
for (const original of inventory.subtitles) {
  const revised = revisedSubtitles.get(original.id)
  lines.push(`### ${original.id} · ${timestamp(original.a)}—${timestamp(original.b)}`, '',
    `- 原中文：${original.zh}`, `- 建议中文：${revised.zh}`,
    `- 原英文：${original.en}`, `- 建议英文：${revised.en}`, '')
}
lines.push('## 画内文案修改建议', '', `建议修改 ${proposal.screenText.length} 项；未列出的条目保留原文。真实界面按钮、程序标识符、工具返回与业务状态仍需核对后应用。`, '',
  '| 定位 | 原文 | 建议 | 理由 |', '| --- | --- | --- | --- |')
for (const revised of proposal.screenText) {
  const original = screens.get(revised.id)
  lines.push(`| ${original.id} · \`video/${original.file}:${original.line}\` | ${cell(original.text)} | ${cell(revised.text)} | ${cell(revised.reason)} |`)
}
lines.push('', '## Gemini 审校提醒', '', ...proposal.notes.map((note) => `- ${note}`), '',
  '## 自动长度与技术锚点检查', '', ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- 未发现明显增长或技术锚点丢失；仍需上画面检查排版。']), '',
  '## 建议保留的核心表达', '', ...proposal.strongestLines.map((text) => `- ${text}`), '',
  '## 应用边界', '',
  '- 保留 214 秒与现有镜头时长、真实业务状态和技术事实，不按候选稿自动改写程序枚举或真实服务端界面。',
  '- 本次交付为文案审阅稿。正式应用时需复核技术准确性、字幕时长、画内文字宽度，再完整渲染与编码，不复用旧帧。', '')
writeFileSync(join(folder, 'suggestion.json'), JSON.stringify(proposal, null, 2) + '\n')
writeFileSync(join(root, 'docs/gemini-copy-review.md'), lines.join('\n'))
writeFileSync(join(folder, 'validation.json'), JSON.stringify({ passed: true, chapters: chapterIds.size, subtitles: subtitleIds.size, screenTextCandidates: inventory.screenText.length, screenTextChanges: proposal.screenText.length, warnings, models }, null, 2) + '\n')
console.log(JSON.stringify({ chapters: chapterIds.size, subtitles: subtitleIds.size, screenTextChanges: proposal.screenText.length, warnings: warnings.length, models, output: join(root, 'docs/gemini-copy-review.md') }, null, 2))
