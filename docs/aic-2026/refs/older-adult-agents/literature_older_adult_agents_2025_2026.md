# 2025—2026「老年人 × 移动/GUI 智能体 与 老年人-AI 交互」调研清单

**取证方式**：全部条目用 `python3 requests` 实际抓取。分两级标注：
- **【abs页核验】** = 抓取 `https://arxiv.org/abs/<ID>` 并解析 `citation_title` / `citation_author` / `citation_date` / `citation_doi` / Comments / blockquote.abstract；
- **【ACL核验】** = 抓取 `https://aclanthology.org/...` 并解析 `citation_*` meta；
- **【API核验】** = 抓取 `export.arxiv.org/api/query`，标题/作者/日期/摘要来自 Atom `entry`（未再抓 abs 页）。
- 无任何凭记忆补写的条目。抓取时间：本会话（2026-10-03）。
- **检索范围**：arXiv（全库检索 API，20+ 组关键词）+ ACL Anthology。**未系统覆盖** ACM DL / IEEE / PubMed / 中文期刊（`web_fetch` 被 fake-IP 阻断，ACM DL 未逐条抓取）。

**年份口径**：均为 2025 或 2026 年首次投稿/发表。会议以 Comments 或 DOI 为准，未标注者写「arXiv 预印本」。

---

## 〇、对差异化声明的直接影响（最重要，先看这一节）

**结论：三个机制的"单个原则"在 2025—2026 年已有他人提出，但"三者合并 + 在跨应用手机 GUI 执行框架里作为运行时机制实现"未检索到同类工作。**

| 我们的机制 | 是否已有先行工作 | 证据 |
|---|---|---|
| **关键操作交还本人**（敏感步骤停手、本人确认） | **有，且很直接** | 2606.28777 明确对比"confirmation required / auto with undo / fully automatic"三种自动化条件；2608.17175 把 **Human Oversight Embedding** 列为五个机制之一；AgeMate（ACL REALM 2025）提出 "mechanisms for preventing and correcting user errors" |
| **结果可核验**（不靠模型自称完成） | **有，但多在聊天/读屏场景，非跨应用办事** | 2603.11303 提出从 blind trust 转向 "informed reliance **prioritizing verifiable evidence**"；2608.09944 NeXUI 把"解释是否 grounded in interface state"和 "support user oversight" 写进评测 |
| **失败交真人/家人** | **有，但主要是家人作为"被选择性调用的支持通道"，不是运行时交接协议** | 2608.24297 提出 "consentful help requests"、"family as a selectively invoked support channel"、"preserves OA task ownership" |
| 三者**同时**作为跨应用手机智能体的运行机制 | **未检索到** | 见下方逐条；2608.17175 最接近但研究对象是生成式 AI（信息查询/健康/沟通），不是 GUI 操作执行；2606.28777 领域是服药提醒，不是手机跨应用办事 |

**建议的差异化措辞（把"我们首创"降级为"我们把它做成可执行机制"）**：
> 现有工作已在适老自动化边界（2606.28777）、照护中的能动性再分配（2608.17175）、跨代支持通道（2608.24297）与辅助型 UI 智能体的可解释/可监督评测（2608.09944）中指出"交还本人、结果可核验、求助真人"的必要性；本项目的新意在于把这三条从**设计原则/访谈结论**落成**跨应用手机 GUI 智能体执行框架内的运行时机制**（证据门控的完成判定、风险分级的本人交接、失败时的家人接力），并给出可复现的实现与验证路径。

---

## 一、面向老年人的智能体评测基准（benchmark）

1. **ElderBench: Benchmarking Autonomous Mobile Agents for Older Adults** — Weide Zhan, Qumu Shaqu, Yuanqing Liu（共 9 位）。2026。arXiv 预印本（Comments: 19 pages, 5 figures）。arXiv:2609.04850。https://arxiv.org/abs/2609.04850 【abs页核验】
   - 原文：*"we present ElderBench, the first benchmark for evaluating mobile GUI agents in authentic elderly-oriented scenarios."*
   - 原文：*"existing GUI benchmarks mainly rely on explicit, goal-oriented instructions and rarely capture the naturally occurring language patterns of older users, such as indirect speech, referential ambiguity, and under-specified requests."*
   - 关系：**基准**。本方向**唯一**检索到的"面向老年人的移动 GUI 智能体评测基准"，测的是老年真实语言模式下的移动 GUI 任务执行。**未检索到第二篇同类基准。**

2. **GrandGuard: Taxonomy, Benchmark, and Safeguards for Elderly-Chatbot Interaction Safety** — Changxuan Fan, Xi Yang, Yueyuan Zheng（共 12 位）。2026。Findings of ACL 2026（DOI: 10.18653/v1/2026.findings-acl.1116）。arXiv:2605.20203。https://arxiv.org/abs/2605.20203 【abs页核验 + ACL核验】
   - 原文：*"We introduce GrandGuard, the first comprehensive framework for assessing and mitigating elderly-specific contextual risks in LLM interactions."*
   - 原文：*"we construct a benchmark of 10,404 labeled prompts and responses, showing that several leading LLMs mishandle elderly-specific contextual risks in over 50% of cases."*（三级分类法，**50 类细粒度风险**，覆盖心理健康、金融、医疗、毒性、隐私；两个护栏达 96.2% / 90.9% 检出率）
   - 关系：**基准（安全维度）**。但测的是**对话/聊天机器人的适老情境安全**，不涉及 GUI 点击与跨应用办事。是"老年人 × 智能体安全基准"最直接的对标物。

3. **Navigation Alone Is Not Enough: Evaluating Explanatory Assistive UI Agents（NeXUI）** — Santosh Patapati（**单作者**）。2026。arXiv 预印本。arXiv:2608.09944。https://arxiv.org/abs/2608.09944 【abs页核验】
   - 原文：*"for assistive agents to be truly useful, they must behave as collaborators that keep users informed and in control, rather than as tools that simply take actions on users' behalf."*
   - 原文：*"Most existing benchmarks judge systems primarily by task completion, without assessing how well they explain their actions or support user oversight."*（评测含 safety / efficiency / task success + 解释是否 grounded in interface state）
   - 关系：**基准**。对象是**盲/低视力用户的 UI 智能体**而非老年人，但它把"用户可监督 + 解释可核验"做成了基准维度——**这是"结果可核验"主张最需要引用的对标基准**。

4. **OPEN: A Benchmark Dataset and Baseline for Older Adult Patient Engagement Recognition in Virtual Rehabilitation Learning Environments** — Ali Abedi, Sadaf Safa, Tracey J. F. Colella（共 4 位）。2025。arXiv 预印本。arXiv:2507.17959。https://arxiv.org/abs/2507.17959 【abs页核验】
   - 原文：*"This paper introduces OPEN (Older adult Patient ENgagement), a novel dataset supporting AI-driven engagement recognition."*（11 位老年人、6 周、35+ 小时）
   - 关系：**基准（非智能体办事）**。是"面向老年人的 AI 评测数据集"，但测**参与度识别**，不测智能体操作能力。证明"老年人基准"这一层已有人做，但不在 GUI 智能体轨道上。

5. **MECO: A Multimodal Dataset for Emotion and Cognitive Understanding in Older Adults** — Hongbin Chen, Jie Li, Wei Wang（共 7 位）。2026。arXiv 预印本。arXiv:2604.03050。https://arxiv.org/abs/2604.03050 【abs页核验】
   - 原文：*"Existing multimodal benchmarks predominantly target young, cognitively healthy subjects, neglecting the influence of cognitive decline on emotional expression and physiological responses."*（42 人、约 38 小时、30,592 同步样本）
   - 关系：**基准（非智能体办事）**。同上，属"老年人专用数据集/基准"生态，与 GUI 办事智能体无直接竞争。

> 小结：**"面向老年人的智能体基准"目前存在两条互不相交的线**——(a) 老年对话安全（GrandGuard）、(b) 老年移动 GUI 任务执行（ElderBench）。ElderBench 在 (b) 线上**是唯一的**。

---

## 二、老年人 × 手机/GUI 智能体的系统或方法（含机制）

6. **Designing Automation Boundaries for Trustworthy Smart Medication Support** — Liqian You, Jianlong Zhou（**仅 2 位**）。2026。arXiv 预印本。arXiv:2606.28777。https://arxiv.org/abs/2606.28777 【abs页核验】
   - 原文：*"We present a mixed-methods study of a Smart Medication Support system comparing three automation conditions: **confirmation required, automatic logging with undo, and fully automatic support**."*
   - 原文：*"Participants preferred automation that reduced routine effort while **preserving opportunities for correction**. Fully automatic support was less interruptive but was rated lower in autonomy, trust, transparency, dignity, and satisfaction."*（53 名被试 + 11 位老年人访谈）
   - 关系：**方法（自动化边界机制）**。**这是"关键操作交还本人"最直接、最强的先行工作**。但它作用于**服药识别/提醒/记录**，不是手机 GUI 跨应用办事；其贡献是"按任务风险校准自动化程度"的实证与设计启示，**未给出在手机智能体里的可执行交接协议**。

7. **Balancing Safety and Autonomy: Accessibility-Oriented Interventions in Generative AI for Cognitive Impairment** — Yibo Meng, Jingruo Chen, Lyumanshan Ye（共 5 位）。2026。ASSETS 2026（DOI: 10.1145/3797867.3829017）。arXiv:2608.17175。https://arxiv.org/abs/2608.17175 【abs页核验】
   - 原文：*"We identify five accessibility-oriented mechanisms: **AI Capability Constraint, Human Oversight Embedding, Cognitive Engagement Maintenance, Human-AI Relationship Regulation, and Risk Transparency and Control**, through which systems structure interaction."*
   - 原文：*"These mechanisms both support and constrain users by **redistributing decision-making across users and caregivers**."*（45 位认知障碍者及其照护者质性研究）
   - 关系：**方法（能动性再分配机制）**。**这是与"交还本人 + 可核验 + 交真人"最接近的一篇**：五机制里包含 Human Oversight Embedding 与 Risk Transparency and Control。但研究对象是生成式 AI 的日常使用（信息查询、健康管理、沟通），**不涉及 GUI 操作执行**，且结论是"按障碍程度动态平衡"，未落到手机办事框架。

8. **Bridging the Digital Divide: Empowering Elderly Smartphone Users with Intelligent and Human-Centered Design in Agemate** — Liangliang Chen, Yongzhen Mu（**仅 2 位**）。2025。Proceedings of the 1st Workshop for Research on Agent Language Models (REALM 2025)（DOI: 10.18653/v1/2025.realm-1.23）。https://aclanthology.org/2025.realm-1.23/ 【ACL核验】
   - 原文：*"we present AgeMate, a prototype **mobile agent** designed to support seniors in acquiring smartphone skills more intuitively and effectively."*
   - 原文：*"we investigate how personalized feedback generated by large language models (LLMs), appropriate granularity in instructional content, and **mechanisms for preventing and correcting user errors** can contribute to more adaptive and user-friendly learning experiences for elderly users."*
   - 关系：**系统/方法**。直接做"老年人 + 手机智能体"且提出了机制（错误预防与纠正、反馈粒度）。但目标是**教会老人自己用手机**（教学），不是**代老人跨应用办事**。

9. **ExplorAR: Assisting Older Adults to Learn Smartphone Apps through AR-powered Trial-and-Error with Interactive Guidance** — Jiawei Li, Linjie Qiu, Zhiqing Wu（共 6 位）。2025。Proceedings of the 33rd ACM International Conference on Multimedia（DOI: 10.1145/3746027.3755578）。arXiv:2508.01282。https://arxiv.org/abs/2508.01282 【API核验】
   - 原文：*"Compared to traditional support methods such as video tutorials, trial-and-error allows older adults to learn to use smartphone apps by **making and correcting mistakes**."*
   - 原文：*"we designed and implemented ExplorAR, an AR-based trial-and-error system that offers re[al-time guidance]…"*
   - 关系：**系统**。同为"老年人 + 手机"且强调**纠错**，但路径是 AR 教学叠加在真人操作上，**不是自主 GUI 智能体**。

10. **Are We There Yet? Assessing Computer-Use Agents for Blind Users' Accessible Interaction with Desktop Applications（OLLA）** — Satwik Ram Kodandaram, Monalika Padma Reddy, Xiaojun Bi（共 6 位）。2026。EMNLP 2026 Main Conference。arXiv:2609.00524。https://arxiv.org/abs/2609.00524 【abs页核验】
    - 原文：*"We present a three-week diary study with 8 blind users using OLLA, a screen-reader-accessible CUA prototype, collecting 1,258 commands across 12 applications…"*
    - 原文：*"Trace analysis reveals grounding, planning, constraint-tracking, and termination failures, while interviews reveal **beyond-automation needs**."*（GPT-5 成功率仅 52.5%）
    - 关系：**系统 + 实证**。是"辅助型 computer-use agent"的真机部署研究，**"beyond-automation needs"这一措辞可作为我们主张的旁证**。对象是盲用户不是老年人，平台是桌面不是手机。

11. **Unremarkable to Remarkable AI Agent: Exploring Boundaries of Agent Intervention for Adults With and Without Cognitive Impairment** — Mai Lee Chang, Samantha Reig, Alicia Lee（共 13 位）。2025。CSCW 2025（Comments: To appear in 2025 ACM CSCW）。arXiv:2505.14872。https://arxiv.org/abs/2505.14872 【abs页核验】
    - 原文：*"we conducted a speed dating with storyboards study to reveal invisible social boundaries that might keep older adults and their caregivers from accepting and using agents."*
    - 原文：*"an agent who really knew them well might be an effective **advocate for their needs** when they were less able to advocate for themselves. That is, the agent may need to transition from being unremarkable to remarkable."*
    - 关系：**设计研究（边界机制）**。直接讨论**智能体介入的边界**与老人/照护者分工，是"交还本人 vs 代替本人"张力的核心 HCI 依据。

12. **When AI "Works," When Does Help Begin?: Intergenerational Support Around Older Adults' LLM Usage** — Hyehyun Chu, Yuri Lee, Yeon Su Park（共 5 位）。2026。CSCW 2026 workshop "Growing Up (and Old) with AI"（5 pages, 1 table）。arXiv:2608.24297。https://arxiv.org/abs/2608.24297 【abs页核验】
    - 原文：*"OA participants described using LLMs to lighten their recurring reliance on family, while **preserving family as a selectively invoked support channel**."*
    - 原文：*"we propose design implications for intergenerational LLM support (e.g., **consentful help requests**, learning-oriented family support that **preserves OA task ownership**)."*
    - 关系：**实证研究 + 设计机制**。**这是"失败交真人/家人接力"最直接的先行工作**（"selectively invoked support channel"、"consentful help requests"）。但它是访谈研究，**没有实现运行时交接**，且场景是 LLM 问答而非跨应用办事。

13. **Learning from Elders: Making an LLM-powered Chatbot for Retirement Communities more Accessible through User-centered Design** — Luna Xingyu Li, Ray-yuan Chung, Feng Chen（共 6 位）。2025。CALD-AI@ASIS&T 2025 workshop（DOI: 10.5281/zenodo.15292697）。arXiv:2504.08985。https://arxiv.org/abs/2504.08985 【API核验】
    - 原文：*"we designed an LLM-powered chatbot prototype using a human-centered approach for a local retirement community."*
    - 关系：**系统**。属"老年人 + LLM 助手"的系统设计线，但不是手机 GUI 操作。

14. **MCP-Driven Accessibility Tree Standardization for AI-Powered Screen Reader Agents** — Vishnu Ramineni, Nitin Saksena, Akash Kumar Agarwal（共 8 位）。2026。arXiv 预印本。arXiv:2608.24898。https://arxiv.org/abs/2608.24898 【abs页核验】
    - 原文：*"screenshot-based perception lacks the semantic roles and relationships required by screen readers, while platform-specific APIs … require separate integrations for each platform. This paper proposes an architecture th[at standardizes accessibility trees across platforms]"*
    - 关系：**方法（感知层）**。为 LLM 智能体提供统一无障碍树——对我们"适老执行框架"的感知层有直接参考价值，但无交接/核验机制。

---

## 三、老年人 × LLM / 语音助手的实证研究

15. **"It feels like hard work trying to talk to it": Understanding Older Adults' Experiences of Encountering and Repairing Conversational Breakdowns with AI Systems** — Niharika Mathur, Tamara Zubatiy, Agata Rozga（共 4 位）。2025。arXiv 预印本。arXiv:2510.06690。https://arxiv.org/abs/2510.06690 【abs页核验】
    - 原文：*"Through a 20-week in-home deployment with 7 older adult participant dyads, we analyzed 844 recoded interactions to identify conversational breakdowns and user-initiated repair strategies."*
    - 原文：*"we identify four types of conversational breakdowns and demonstrate how older adults draw on their situated knowledge and environment to make sense of and recover from these disruptions, highlighting the **cognitive effort** required in doing so."*
    - 关系：**实证研究**。为"失败时如何兜底"提供最扎实的用户侧证据。

16. **Sometimes You Need Facts, and Sometimes a Hug: Understanding Older Adults' Preferences for Explanations in LLM-Based Conversational AI Systems** — Niharika Mathur, Tamara Zubatiy, Agata Rozga（共 5 位）。2026。ACM CHI 2026（DOI: 10.1145/3772318.3790812）。arXiv:2510.06697。https://arxiv.org/abs/2510.06697 【abs页核验】
    - 原文：*"explanations are often interpreted as **interactive, multi-turn conversational exchanges** with the AI, and can be helpful in calibrating urgency, guiding actionability, and providing insights into older adults' daily lives **for their family members**."*
    - 关系：**实证研究**。解释被老人当作多轮对话、且要能传给家人看——支持我们"结果可核验 / 向家人可解释"的设计。

17. **"Who wants to be nagged by AI?": Investigating the Effects of Agreeableness on Older Adults' Perception of LLM-Based Voice Assistants' Explanations** — Niharika Mathur, Hasibur Rahman, Smit Desai。2026。CHI 2026 poster extended abstract（DOI: 10.1145/3772363.3798685）。arXiv:2603.09012。https://arxiv.org/abs/2603.09012 【abs页核验】
    - 原文：*"High-agreeableness assistants were perceived as more trustworthy, empathetic, and likable, but these benefits **diminished in emergencies where clarity outweighed warmth**."*
    - 关系：**实证研究**。N=70；对"敏感/紧急场景下助手该怎样说话"有直接设计含义。

18. **Tell Me Why, When, and How: Effects of Personality, Evidence, and Context on Older Adults' Perceptions of Conversational AI Explanations** — Niharika Mathur, Hasibur Rahman, Smit Desai。2026。arXiv 预印本。arXiv:2603.08164。https://arxiv.org/abs/2603.08164 【abs页核验】
    - 原文：*"we conducted a mixed-design study with 140 older adults, examining two dimensions of explanation design: **evidential grounding (source of information)** and the VA's conversational personality…"*
    - 关系：**实证研究**。"证据来源"维度正是"结果可核验"的用户侧依据。

19. **Bridging the Cognitive Gap: Co-Designing and Evaluating a Voice-Enabled Community Chatbot for Older Adults** — Feng Chen, Luna Xingyu Li, Ray-Yuan Chung（共 7 位）。2026。arXiv 预印本。arXiv:2603.11303。https://arxiv.org/abs/2603.11303 【abs页核验】
    - 原文：*"we applied a "Glass Box" approach combining multimodal accessibility with intentional AI education… shifting their interaction model from **blind trust to informed reliance prioritizing verifiable evidence**."*
    - 原文：*"usability scores dropped significantly for users aged 80 and older (r=-0.50), indicating that truly age-inclusive AI must evolve beyond touch-based interfaces toward zero-touch navigation."*（N=25）
    - 关系：**系统 + 实证**。"优先可核验证据的知情依赖"是我们"结果可核验"最贴切的原文表述。

20. **"MeBo Leaves a Piece of You Behind": Designing a Relational Voice-Based Memory Companion for Older Adults** — Hasibur Rahman, Mahsa Nasri, Manasi Vaidya（共 6 位）。2026。arXiv 预印本。arXiv:2609.24706。https://arxiv.org/abs/2609.24706 【abs页核验】
    - 原文：*"Participants described how MeBo followed their stories, returned to earlier memories, adapted to their preferences, and **made its growing memory visible and controllable**."*（PD 11 人 + 评估 20 人，SUS=87.75）
    - 关系：**系统 + 实证**。"让记忆可见可控"= 可核验 + 可交还本人，是同一设计母题在记忆陪伴场景的实例。

21. **Conversational Agents for Older Adults' Health: A Systematic Literature Review** — Jiaxin An, Siqi Yi, Yao Lyu（共 5 位）。2025。arXiv 预印本。arXiv:2503.23153。https://arxiv.org/abs/2503.23153 【abs页核验】
    - 原文：*"Older adults expect CAs to be able to support multiple functions, to communicate using natural language, to be personalized, and to **allow users full control**."*
    - 原文：*"Older adults mainly showed low acceptance CAs for health due to various reasons, such as unstable effects, **harm to independence**, and privacy concerns."*（72 篇系统综述）
    - 关系：**综述（实证汇总）**。为"must not harm independence / users want full control"提供文献级背书。

22. **Large Language Model Counterarguments in Older Adults: Cognitive Offloading or Susceptibility to Moral Persuasion?** — Kou Tamura, Sayaka Ishibashi, Ayana Goma（共 5 位）。2026。Computers in Human Behavior（Comments: published in Computers in Human Behavior；DOI: 10.1016/j.chb.2026.109142）。arXiv:2604.22356。https://arxiv.org/abs/2604.22356 【abs页核验】
    - 原文：*"More than 30% of participants reversed their judgments in both dilemmas… Older adults tended to be more likely than younger adults to reverse their judgments."*
    - 关系：**实证研究**。为"老人易被模型说服"这一安全前提提供量化证据（130 人：74 老 + 56 少）。

23. **Challenges in Automatic Speech Recognition for Adults with Cognitive Impairment** — Michelle Cohn, Alyssa Lanzi, Yui Ishihara（共 6 位）。2026。arXiv 预印本。arXiv:2602.23436。https://arxiv.org/abs/2602.23436 【API核验】
    - 原文：*"Prior work has shown reduced ASR performance for adults with cognitive impairment; however, the acoustic factors underlying these disparities remain poorly understood."*（83 位老年人，认知正常/MCI/痴呆分组）
    - 关系：**实证研究**。语音入口在老年群体上的可靠性地基。

24. **Out of the Box, into the Clinic? Evaluating State-of-the-Art ASR for Clinical Applications for Older Adults** — Bram van Dijk, Tiberon Kuiper, Sirin Aoulad si Ahmed（共 8 位）。2025。Fourth Workshop on Bridging HCI and NLP（HCINLP, EMNLP）。arXiv:2508.08684。https://arxiv.org/abs/2508.08684 【abs页核验】
    - 原文：*"This study evaluates state-of-the-art ASR models on language use of older Dutch adults, who interacted with the Welzijn.AI chatbot designed for geriatric contexts."*
    - 关系：**实证研究**。再次确认"语音输入对老人并非免费午餐"。

25. **"We need to avail ourselves of GenAI to enhance knowledge distribution": Empowering Older Adults through GenAI Literacy** — Eunhye Grace Ko, Shaini Nanayakkara, Earl W. Huff Jr. 2025。CHI EA 2025（DOI: 10.1145/3706599.3720032）。arXiv:2506.06225。https://arxiv.org/abs/2506.06225 【abs页核验】
    - 原文：*"while Litti provided a positive learning experience, it did not significantly enhance participants' trust or sense of safety regarding GenAI."*
    - 关系：**实证研究**。说明"讲清楚"并不自动带来信任，需机制而非仅教育。

26. **Exploration of Foundation Model-Based Robots in Patient and Elderly Care** — Zhiwen Qiu, Wei Liu, Yuexing Hao（共 3 位）。2026。arXiv 预印本。arXiv:2606.10208。https://arxiv.org/abs/2606.10208 【API核验】
    - 原文：*"care settings require reliable and workflow-compatible systems with **accountable human oversight**"*
    - 关系：**综述/立场文**。为"照护场景必须有可问责的人类监督"提供领域共识。

---

## 四、未能确认 / 抓取失败（不计入上述条目）

- **WePilot: Integrating Younger Family Members and Chatbot to Support Older Adults Learning Smartphone Usage**：**仅从 web_search 结果页标题与机构库链接（VTechWorks）得知**，未能用 python 抓到论文页/摘要页，**未确认作者、年份、会议、DOI**。标题显示它是"**子女 + 聊天机器人**共同支持老人学手机"的系统——**如果确认，它将是"家人接力"机制最直接的竞争者**，建议优先补抓。
- **Finding the Right Balance: User Control and Automation in AI Tools for Supporting Older Adults' Health Information Tasks**：web_search 返回 ACM DOI `10.1145/3706599.3719773`（DOI 前缀指向 CHI 2025 Extended Abstracts），**但未 python 抓取确认作者、摘要原文**。标题直指"**user control vs automation**"，与本项目"关键操作交还本人"高度相关，**建议优先补抓**。
- **`aclanthology.org/2025.realm-1.23/` 的 Agemate 条目**：已抓取并确认（见第 8 条），但作者仅 2 位，不满足"前 3 位作者"要求，已注明。
- **ACM DL / IEEE Xplore / PubMed / 中文期刊（CNKI、中文核心）**：本会话**未系统检索**，仅通过 web_search 间接获得线索。若报告要声明"唯一性"，这一层空白必须补。
- **`lit/ids2.txt` 中 2609.34139（AnyAppBench）、2605.29486（PhoneWorld）、2606.31410（Xiaomi-GUI-0）等通用移动 GUI 基准**：本会话未重新抓取，已在 `lit/literature_2025_2026.md` 中记录，均**非老年人专用**。
- **`web_fetch` 工具**：本机 DNS 解析到 198.18.0.x fake-IP，全部被拒；本文所有抓取均经 `python3 requests`（`verify=False`）完成。

---

### 数据文件（本会话新增）
- 抓取脚本：`lit/detail2.py`（abs 页 `citation_*` + Comments + abstract 解析）
- 查询定义：`lit/q4.json`、`lit/q5.json`
- 原始结果：`lit/r4.json`、`lit/r5.json`、`lit/detail3.json`
