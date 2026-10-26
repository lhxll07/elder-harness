export const EDIT_DURATION = 196

export const EDITS = [
  { name: 'prologue', title: '把复杂留给软件', start: 0, end: 16, source: [0, 16] },
  { name: 'architecture', title: '一句话进入办事闭环', start: 16, end: 40, source: [16, 40] },
  { name: 'input', title: '接回同一次复诊', start: 40, end: 42, source: [40, 42] },
  { name: 'enter', title: '走进为人编译', start: 42, end: 47, source: [42, 50] },
  { name: 'parse', title: '两种观察，读懂同一页面', start: 47, end: 57, source: [50, 64] },
  { name: 'compile', title: '同一组页面抽出信息，操作收拢，决定留下', start: 57, end: 75, source: [64, 76] },
  { name: 'family', title: '带着背景向家人补齐线索', start: 75, end: 85, source: [76, 90] },
  { name: 'binding', title: '从线索到当前页面的目标', start: 85, end: 94, source: [90, 102] },
  { name: 'reobserve', title: '目标有歧义，先重新观察', start: 94, end: 102, source: [102, 102], detail: 'reobserve' },
  { name: 'reading', title: '装入方法，读准周四', start: 102, end: 109, source: [102, 112] },
  { name: 'decision', title: '核对和提交，回到本人', start: 109, end: 114, source: [112, 118] },
  { name: 'verify', title: '动作与结果，分别核验', start: 114, end: 120, source: [118, 125] },
  { name: 'evidence', title: '让事实托住结论', start: 120, end: 127, source: [125, 135] },
  { name: 'provenance', title: '自己输入的字，不能给自己作证', start: 127, end: 136, source: [135, 135], detail: 'provenance' },
  { name: 'distill', title: '经历中提炼通用阅读步骤', start: 136, end: 143, source: [135, 144] },
  { name: 'transfer', title: '换版式，仍从当前页面找目标', start: 143, end: 149, source: [144, 151] },
  { name: 'admission', title: '独立运行，报告与本机复算', start: 149, end: 159, source: [151, 164] },
  { name: 'shadow', title: '回放决策点，检查方法用在哪里', start: 159, end: 170, source: [164, 164], detail: 'shadow' },
  { name: 'adopt', title: '验证通过，家人手动采用', start: 170, end: 174, source: [164, 168] },
  { name: 'reuse', title: '下一次，只装入匹配的方法', start: 174, end: 179, source: [168, 173] },
  { name: 'human', title: '读懂页面，核实事实，留下方法。为人编译。', start: 179, end: 196, source: [173, 190] },
]

export function editAt(time) {
  return EDITS.find(edit => time >= edit.start && time < edit.end) ?? (time < 0 ? EDITS[0] : EDITS.at(-1))
}

export function editTime(time) {
  const edit = editAt(time)
  return edit.source[0] + (time - edit.start) / (edit.end - edit.start) * (edit.source[1] - edit.source[0])
}

export function fromEditTime(time) {
  const candidates = EDITS.filter(edit => edit.source[1] > edit.source[0] && time >= edit.source[0] && time <= edit.source[1])
  const edit = candidates.at(-1) ?? (time < 0 ? EDITS[0] : EDITS.at(-1))
  return edit.start + (time - edit.source[0]) / (edit.source[1] - edit.source[0]) * (edit.end - edit.start)
}
