export const DURATION = 104

export const BEATS = [
  { name: 'source', title: '一句话，展开成一整套流程', start: 0, end: 14 },
  { name: 'parse', title: '从像素和控件中读出同一件事', start: 14, end: 28 },
  { name: 'reduce', title: '消去操作，留下决定', start: 28, end: 40 },
  { name: 'resolve', title: '保留缺项，局部求助', start: 40, end: 54 },
  { name: 'run', title: '绑定当前页面，再执行', start: 54, end: 68 },
  { name: 'commit', title: '最后一按交给本人', start: 68, end: 76 },
  { name: 'verify', title: '动作与结果分离，让结论接受事实对照', start: 76, end: 85 },
  { name: 'map', title: '页面事实托住结论，再回到悬浮窗', start: 85, end: 96 },
  { name: 'human', title: '为人编译', start: 96, end: 104 },
]

export const CUES = [
  { start: 0.8, end: 5.0, main: '老人说的是需求。', detail: '语音识别 API → 自然语言目标', phase: 'INPUT / 人的语言' },
  { start: 5.6, end: 12.5, main: '手机呈现的，却是一整套流程。', detail: '入口、科室、医生、排班、核对、提交', phase: 'SOURCE / 界面的语言' },
  { start: 13.1, end: 18.8, main: '如果，把它编译给人呢？', detail: '不是换一个入口，而是重写人与流程的关系。', phase: 'COMPILE / 为人编译' },
  { start: 19.4, end: 25.9, main: '控件给身份，截图补关系。', detail: '双通道观察：把控件语义与可见位置放到同一个页面里理解。', phase: 'PARSE / 读懂当前页面' },
  { start: 26.5, end: 31.5, main: '从一页页界面，提取这一次的目标。', detail: '普通内科 / 周四上午 / 待补全的医生', phase: 'SEMANTICS / 提取任务约束' },
  { start: 32.1, end: 38.7, main: '消去操作。留下决定。', detail: '导航交给软件；缺失的信息和人的选择，仍然保留。', phase: 'REDUCE / 压缩理解成本', hero: true },
  { start: 40.1, end: 44.8, main: '不知道的，不替人填。', detail: '医生这一项留空，流程停在原处。', phase: 'UNRESOLVED / 保留一个空位' },
  { start: 45.3, end: 49.8, main: '家人只需补上缺的这一项。', detail: '网页接手求助 → 留言回到手机', phase: 'RESOLVE / 局部协作' },
  { start: 50.3, end: 54.6, main: '本人核对后，从原处继续。', detail: '家人的线索回到任务，不变成远程操作指令。', phase: 'RESOLVE / 补齐而非重来' },
  { start: 55.1, end: 59.7, main: '需要的方法，只在此刻装入。', detail: '按需经验：触发推送 → load_skill 拉取当前方法', phase: 'LINK / 按需装入方法' },
  { start: 60.2, end: 67.2, main: '不是重放坐标，而是每一步重新对齐。', detail: '大模型规划 tool_call → 本地约束检查 → 执行 → 再观察', phase: 'RUN / 绑定当前页面' },
  { start: 68.0, end: 74.7, main: '流程走到这里，决定回到您手里。', detail: '医生、时间、费用摊开核对；提交由本人完成。', phase: 'COMMIT / 人的决定' },
  { start: 75.8, end: 79.8, main: '点下去，是动作；办到哪，要看返回。', detail: '动作记录与医院结果，分别进入核验。', phase: 'VERIFY / 分清动作与结果' },
  { start: 80.3, end: 84.6, main: '同一页事实，检验一句结论。', detail: '核验对照示意：“预约成功”与“待医院确认”不相符。', phase: 'PROOF / 让结论接受事实对照' },
  { start: 85.2, end: 90.2, main: '让事实，托住结论。', detail: '本地核对记录与证据，独立模型复核页面含义。', phase: 'SOURCE MAP / 结论长在证据上', hero: true },
  { start: 90.7, end: 95.2, main: '最后交付的，是有据可循的一句话。', detail: '已提交，待医院确认。结果回到手机顶部悬浮窗。', phase: 'OUTPUT / 回到人的语言' },
]
