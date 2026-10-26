import { voicePlaybackTime } from './voice-timing.js'

export const VOICE_EXTRA_SECONDS = 4
export const OBSERVE_EXTRA_SECONDS = -2

export const CHAPTERS = [
  { name: 'prologue', title: '序幕', start: 0, end: 16, en: 'The gap' },
  { name: 'voice', title: '一句话进入办事闭环', section: '架构总览', start: 16, end: 44, en: 'Speech to action' },
  { name: 'observe', title: '看懂页面', section: '一次办事 · 双通道感知', start: 44, end: 64, en: 'Understand the page' },
  { name: 'loop', title: '找准目标', section: '一次办事 · 稳定身份重绑定', start: 64, end: 86, en: 'Locate the right control', core: true },
  { name: 'ladder', title: '流程折叠', section: '一次办事 · 操作收拢，问题浮现', start: 86, end: 104, en: 'Fold the steps, reveal the question', core: true },
  { name: 'guard', title: '局部接力', section: '一次办事 · 补一项，不重来', start: 104, end: 126, en: 'Fill one gap, keep the progress' },
  { name: 'handback', title: '决定留下', section: '一次办事 · 关键提交由本人操作', start: 126, end: 142, en: 'Keep the decision with the person' },
  { name: 'evidence', title: '结论有据', section: '一次办事 · 回到事实出处', start: 142, end: 166, en: 'Trace the result to its source', core: true },
  { name: 'teach', title: '读懂关系', section: '方法与经验 · 记方法，不记位置', start: 166, end: 186, en: 'Remember the method, not the coordinates', core: true },
  { name: 'evolve', title: '验证经验', section: '方法与经验 · 三层准入', start: 186, end: 206, en: 'Validate reusable experience', core: true },
  { name: 'coda', title: '尾声', start: 206, end: 214, en: 'Evidence, and boundaries' },
]

export const DURATION = CHAPTERS.at(-1).end

export function sharedTimelineTime(time) {
  const chapter = CHAPTERS.find((entry) => entry.name === 'observe')
  if (time <= chapter.start) return time
  if (time >= chapter.end) return time - OBSERVE_EXTRA_SECONDS
  const originalDuration = chapter.end - chapter.start - OBSERVE_EXTRA_SECONDS
  return chapter.start + (time - chapter.start) * originalDuration / (chapter.end - chapter.start)
}

export const SUBTITLES = [
  { a: 0.8, b: 2.8, zh: '只是想约一次复诊', en: 'Just booking a follow-up visit.' },
  { a: 3.1, b: 8.7, zh: '却要看懂一层又一层的页面', en: 'Yet there are so many screens to understand.' },
  { a: 9.0, b: 11.25, zh: '把复杂的步骤，交给银龄智办', en: 'Let the assistant handle the complexity.' },
  { a: 11.5, b: 16.0, zh: '说出想办的事，不必记住每一步', en: 'Say what you need. No need to remember every step.' },
  { chapter: 'voice', a: 16.12, b: 16.8, zh: '从一句话，走进一次办事闭环', en: 'From one sentence to a complete action loop.' },
  { chapter: 'voice', a: 16.95, b: 19.5, zh: '目标说出口，系统开始协作', en: 'State the goal. The system begins coordinating.' },
  { chapter: 'voice', a: 19.9, b: 23.1, zh: '语音经代理上传，云端识别成文字', en: 'The speech proxy sends audio to cloud recognition.' },
  { chapter: 'voice', a: 23.3, b: 25.9, zh: '文字、页面与工具，送入模型', en: 'Text, the current page and available tools enter the model.' },
  { chapter: 'voice', a: 26.15, b: 28.75, zh: '模型选择下一步，生成调用', en: 'The model chooses the next step and generates a tool call.' },
  { chapter: 'voice', a: 29.0, b: 31.45, zh: '本机核对后，执行这一步', en: 'The phone verifies the page and permission, then executes.' },
  { chapter: 'voice', a: 31.7, b: 33.4, zh: '结果返回，更新决策', en: 'The result and new page inform the next decision.' },
  { chapter: 'voice', a: 33.65, b: 37.35, zh: '观察、决策、执行、回看，逐步推进', en: 'Observe, decide, act and review. Advance one step at a time.' },
  { chapter: 'voice', a: 38.65, b: 41.5, zh: '一句“等等”，整个闭环就停下来听', en: 'Say "wait", and the whole loop stops to listen.' },
  { chapter: 'voice', a: 42.05, b: 44.0, zh: '停下后，还在这一页等您', en: 'It stays on this page, waiting for you to continue.' },
  { chapter: 'observe', a: 44.35, b: 46.65, zh: '您说“继续”，复诊任务从当前页接上', en: 'You say "continue". The visit resumes on the current page.' },
  { chapter: 'observe', a: 47.0, b: 50.0, zh: '第一步，找出预约入口', en: 'First, find the booking entry.' },
  { chapter: 'observe', a: 50.2, b: 54.1, zh: '像素呈现外观，结构提供控件身份与关系', en: 'Pixels show appearance. Structure identifies controls and relationships.' },
  { chapter: 'observe', a: 54.35, b: 57.25, zh: '本人授权后，视觉补上图形入口的线索', en: 'With permission, vision supplies the graphical entry clues.' },
  { chapter: 'observe', a: 57.55, b: 60.6, zh: '两路信息对齐同一页，定位这一步的入口', en: 'Both channels align on one page to locate the entry.' },
  { chapter: 'observe', a: 61.0, b: 64.0, zh: '入口找到了，下一步选科室', en: 'The entry is found. Next, choose the department.' },
  { a: 64.7, b: 67.5, zh: '您说“普通内科”，系统定位对应控件', en: 'You name internal medicine. The system locates its control.' },
  { a: 67.7, b: 70.5, zh: '按钮换了位置，旧动作险些指向另一项', en: 'The layout moves. The old action now points at another entry.' },
  { a: 70.7, b: 72.1, zh: '页面版本变化，旧动作先暂停', en: 'A new page revision pauses the old action.' },
  { a: 72.3, b: 75.7, zh: '自身与父子、兄弟关系，组成稳定身份', en: 'The control and its parent, children and siblings define its identity.' },
  { a: 76.0, b: 79.4, zh: '唯一匹配，就重绑定；身份重复，就重新观察', en: 'A unique match rebinds. Duplicate identities trigger observation.' },
  { a: 79.6, b: 81.4, zh: '补读当前页，重新确认目标', en: 'Read the current page again to confirm the target.' },
  { a: 81.6, b: 85.7, zh: '科室已选定，接着找上次复诊的医生', en: 'The department is selected. Next, find the previous doctor.' },
  { a: 87.0, b: 90.5, zh: '一件复诊，要走过这么多页面', en: 'One follow-up visit takes so many screens.' },
  { a: 90.7, b: 93.3, zh: '明确、可逆的操作，逐段折叠', en: 'Clear, reversible steps fold away, one section at a time.' },
  { a: 93.7, b: 97.0, zh: '流程收拢，只留下此刻缺少的信息', en: 'The flow contracts, leaving the one missing fact.' },
  { a: 97.5, b: 103.6, zh: '您说“不记得了，问问女儿”，助手发出求助', en: 'You say: "I forgot. Ask my daughter." The assistant requests help.' },
  { a: 105.5, b: 109.4, zh: '已经走过的步骤保留，只把缺口交给家人', en: 'Keep the progress. Ask family only for the missing information.' },
  { a: 109.8, b: 111.6, zh: '需要补充什么，连同背景一起说明', en: 'Explain the missing fact with its context.' },
  { a: 111.9, b: 114.2, zh: '她补充：“上次陈医生，您再核对一下”', en: 'She adds: "It was Dr. Chen. Please check again."' },
  { a: 114.5, b: 118.0, zh: '同一条留言，经过提交、送达，再由本人确认已读', en: 'One message: submitted, delivered, then acknowledged by the person.' },
  { a: 118.3, b: 120.7, zh: '留言送到眼前，老人核对医生与时间', en: 'The message arrives. The person checks the doctor and time.' },
  { a: 121.0, b: 125.8, zh: '本人核对后接着办，不必从头再来', en: 'After the person checks, continue without starting over.' },
  { a: 127.6, b: 132.5, zh: '已明确、可逆的步骤，一页页折回手机', en: 'Clear, reversible steps fold back into the phone.' },
  { a: 133.0, b: 135.3, zh: '医生与时间已明确，最后的提交交给本人', en: 'The doctor and time are confirmed. Submission returns to the person.' },
  { a: 135.6, b: 138.0, zh: '折叠的是操作，不是您的决定', en: 'Fold the steps, not your decision.' },
  { a: 138.3, b: 141.8, zh: '您亲自提交，然后请助手核对结果', en: 'You submit, then ask the assistant to check the result.' },
  { a: 143.0, b: 145.0, zh: '您说“我点好了，帮我核对一下”', en: 'You say: "I tapped it. Please check the result."' },
  { a: 145.2, b: 147.9, zh: '每项结论，都回到它的出处', en: 'Trace every claim back to its source.' },
  { a: 148.1, b: 151.6, zh: '从医院页面取出记录，逐项核对状态', en: 'Read the hospital record and check each part of the state.' },
  { a: 151.8, b: 153.0, zh: '页面事实，留有来源', en: 'Page facts retain their provenance.' },
  { a: 153.3, b: 156.8, zh: '证据按来源分层：自己输入的文字，单独标记', en: 'Separate evidence by provenance. Mark self-entered text separately.' },
  { a: 157.0, b: 159.4, zh: '动作账配对调用与返回，证据账核对页面事实', en: 'The action ledger pairs calls and results. The evidence ledger checks facts.' },
  { a: 159.6, b: 162.5, zh: '本机审计通过，再交给模型复核', en: 'Passing local audit proceeds to model review.' },
  { a: 162.8, b: 165.8, zh: '这次办事的状态清楚了：已提交，待医院确认', en: 'The current state is clear: submitted, awaiting hospital confirmation.' },
  { a: 167.0, b: 169.3, zh: '回看这次办事：相似的排班，怎样读准周四？', en: 'Looking back: how do we read Thursday among similar columns?' },
  { a: 170.0, b: 173.3, zh: '常驻小目录，load_skill 只拉取 reading_tables', en: 'Keep a small catalog. Pull only reading_tables with load_skill.' },
  { a: 173.5, b: 177.2, zh: '页面换了布局，旧位置不再可靠', en: 'The layout changes. The old position no longer holds.' },
  { a: 177.8, b: 179.5, zh: '重新对齐表头，沿行列读取', en: 'Align the header again, then read the rows and columns.' },
  { a: 180.0, b: 182.7, zh: '表头、行与内容成组记录，进入下一轮判断', en: 'Record header, row and content together for the next decision.' },
  { a: 183.0, b: 185.7, zh: '记住的是方法，而不是上次的坐标', en: 'Remember the method, not the previous coordinates.' },
  { a: 187.5, b: 191.7, zh: '第一层 T0，检查参数契约、策略与脱敏', en: 'Layer one, T0: check contracts, policy and redaction.' },
  { a: 192.2, b: 196.8, zh: '第二层 T1，双轨回放检验目标命中与非目标暴露', en: 'Layer two, T1: replay target hits and non-target exposure.' },
  { a: 197.2, b: 201.0, zh: '第三层 T2，以实机回归检验收益与旧任务表现', en: 'Layer three, T2: device regression evaluates gains and existing tasks.' },
  { a: 201.3, b: 205.6, zh: '验证结果决定准入；版本留存，切换可回退', en: 'Validation determines admission. Retained versions support rollback.' },
].map((cue) => cue.chapter === 'voice'
  ? { ...cue, a: 16 + voicePlaybackTime(cue.a - 16), b: 16 + voicePlaybackTime(cue.b - 16) }
  : cue)

export const OPENING_STATS = [
  { value: '1.61', unit: '亿', label: '60 岁及以上网民', note: 'CNNIC 第 56 次报告，2025 年 6 月' },
  { value: '18.1', unit: '%', label: '会使用手机支付', note: '中国老龄科学研究中心，2021 年' },
  { value: '9.6', unit: '%', label: '会预约挂号', note: '中国老龄科学研究中心，2021 年' },
]

export function chapterAt(time) {
  return CHAPTERS.find((chapter) => time >= chapter.start && time < chapter.end) ?? CHAPTERS.at(-1)
}

export function subtitleAt(time) {
  return SUBTITLES.filter((cue) => time >= cue.a && time < cue.b)
}
