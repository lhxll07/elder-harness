# 2025—2026 文献清单：手机/GUI 智能体 × 老年人数字鸿沟 / 适老化

**取证方式**：全部条目均用 `python3 requests` 实际抓取 `https://arxiv.org/abs/<ID>` 摘要页，解析 `citation_title` / `citation_author` / `citation_date` / `citation_doi` 及 Comments/Journal-ref 字段；并用 `export.arxiv.org/api/query` 的 `id_list` 二次交叉核对标题、作者全序、投稿日期与 comments。抓取时间：本次会话。**无任何凭记忆补写的条目。**

**年份口径**：均为 2025 或 2026 年 arXiv 首次投稿（`published` 字段）。凡 arXiv 摘要页 Comments 标注了会议者注明会议，否则写"arXiv 预印本"。

**覆盖统计**：30 条（超过要求的 16—20 条）。
- B 类（老年/AI/数字鸿沟/适老化/无障碍，**最缺、优先**）：8 条
- A 类（手机/移动端 GUI 智能体）：6 条
- C 类（GUI 元素定位 / grounding）：5 条
- D 类（安全、可信、监控、幻觉）：6 条
- E 类（移动端智能体评测基准）：5 条

---

## B 类（优先）：老年人 × AI / 数字鸿沟 / 适老化 / 无障碍（8 条）

1. **ElderBench: Benchmarking Autonomous Mobile Agents for Older Adults**。Weide Zhan, Qumu Shaqu, Yuanqing Liu, et al.（共 9 位）. arXiv 预印本, 2026. arXiv:2609.04850. https://arxiv.org/abs/2609.04850
   - 一句话：指出现有 GUI 基准只用明确的目标导向指令、无法反映老年人"间接表达、指代含糊、需求欠指定"的语言模式，据此构建了首个面向真实老年人场景的移动 GUI 智能体基准 ElderBench。
   （本条同时属于 E 类基准方向）

2. **The Digital Divide in Geriatric Care: Why Usability, Not Access, is the Real Problem**。Christine Ine（单一作者）. arXiv 预印本, 2026. arXiv:2601.17012. https://arxiv.org/abs/2601.17012
   - 一句话：把老年数字鸿沟重新界定为"可用性鸿沟"，论证 UX/设计不良而非接入不足才是数字健康技术在老年群体中落地的主要障碍。

3. **Helping the Helper: LLM-Assisted Problem Articulation for Older Adults Seeking Technology Support**。Hasti Sharifi, Homaira Huda Shomee, Melissa Lamar, et al.（共 5 位）. arXiv 预印本, 2026. arXiv:2601.10018. https://arxiv.org/abs/2601.10018
   - 一句话：通过 27 人日记研究识别老年人在求助提问中的四类沟通障碍（冗长、不完整、过度指定、欠指定），并构建 LLM 改写管线显著提升自动求解准确率。

4. **Bridging the Cognitive Gap: Co-Designing and Evaluating a Voice-Enabled Community Chatbot for Older Adults**。Feng Chen, Luna Xingyu Li, Ray-Yuan Chung, et al.（共 7 位）. arXiv 预印本, 2026. arXiv:2603.11303. https://arxiv.org/abs/2603.11303
   - 一句话：针对养老社区数字门户造成的"数字回避"，以"Glass Box"（多模态可访问 + 可解释）方式共同设计并评估语音 LLM 聊天机器人。

5. **"Who wants to be nagged by AI?": Investigating the Effects of Agreeableness on Older Adults' Perception of LLM-Based Voice Assistants' Explanations**。Niharika Mathur, Hasibur Rahman, Smit Desai. CHI 2026（poster extended abstract）, 2026. arXiv:2603.09012. DOI: 10.1145/3772363.3798685. https://arxiv.org/abs/2603.09012
   - 一句话：N=70 实验表明高"宜人性"语音助手在常规场景更被老年人信任与喜欢，但在紧急场景中温暖感收益消失、清晰度更重要。

6. **"It feels like hard work trying to talk to it": Understanding Older Adults' Experiences of Encountering and Repairing Conversational Breakdowns with AI Systems**。Niharika Mathur, Tamara Zubatiy, Agata Rozga, et al.（共 4 位）. arXiv 预印本, 2025. arXiv:2510.06690. https://arxiv.org/abs/2510.06690
   - 一句话：20 周家庭部署（7 对老年被试、844 段交互）分析老年人遭遇并修复对话式 AI 崩溃的策略，指出设计需超越可用性与可靠性、面向"崩溃修复"。

7. **Redefining Elderly Care with Agentic AI: Challenges and Opportunities**。Ruhul Amin Khalil, Kashif Ahmad, Hazrat Ali. arXiv 预印本, 2025. arXiv:2507.14912. https://arxiv.org/abs/2507.14912
   - 一句话：综述 LLM 驱动的 Agentic AI 在养老照护中的主动决策潜力（个性化健康追踪、认知照护、环境管理）及其挑战。

8. **MCP-Driven Accessibility Tree Standardization for AI-Powered Screen Reader Agents**。Vishnu Ramineni, Nitin Saksena, Akash Kumar Agarwal, et al.（共 8 位）. arXiv 预印本, 2026. arXiv:2608.24898. https://arxiv.org/abs/2608.24898
   - 一句话：针对截图感知缺语义、平台无障碍 API 需逐平台适配的问题，提出基于 MCP 的统一无障碍树标准化架构，供 LLM 读屏智能体使用。

---

## A 类：2025—2026 手机 / 移动端 GUI 智能体（6 条）

9. **Xiaomi-GUI-0 Technical Report**。Wanxia Cao, Chengzhen Duan, Pei Fu, et al.（共 32 位）. arXiv 预印本, 2026. arXiv:2606.31410. https://arxiv.org/abs/2606.31410
   - 一句话：指出既有 GUI 智能体多在离线轨迹/仿真环境/标准基准上训练评测，与真实应用在界面布局、交互逻辑、异常状态分布上差距大，提出面向真机执行稳定性的基础 GUI 智能体。

10. **Qwen-UI-Agent Technical Report: Toward Next-Generation Real-World Centric Foundation GUI Agents**。Hanzhang Zhou, Panrong Tong, Xu Zhang, et al.（共 16 位）. arXiv 预印本, 2026. arXiv:2607.28227. https://arxiv.org/abs/2607.28227
    - 一句话：提出跨 mobile / computer-use / web / DeepSearch 的真机为中心基础 GUI 智能体，目标是跨平台工作流、GUI+CLI 混合执行、长时程任务与主动服务。

11. **UI-Venus-2 Technical Report**。Venus Team, Zhuohan Cai, Haoxing Chen, et al.（共 31 位）. arXiv 预印本, 2026. arXiv:2609.00028. https://arxiv.org/abs/2609.00028
    - 一句话：面向 mobile/web/desktop 统一闭环"推理—动作"框架的通用基础 GUI 智能体，通过环境覆盖、任务构造与奖励验证三方面扩展来弥合基准到落地的差距。

12. **MemGUI-Agent: An End-to-End Long-Horizon Mobile GUI Agent with Proactive Context Management**。Guangyi Liu, Gao Wu, Congxiao Liu, et al.（共 10 位）. arXiv 预印本, 2026. arXiv:2606.19926. https://arxiv.org/abs/2606.19926
    - 一句话：指出 ReAct 式被动累积记录导致提示爆炸与跨应用关键事实稀释，提出把上下文管理作为一等动作（Context-as-Action）的长时程移动端智能体。

13. **Same Tasks, Different Apps: Why Mobile GUI Agents Fail to Generalize?**。Tien Tran, Namho Koh, Daiki E. Matsunaga, et al.（共 5 位）. Findings of EMNLP 2026, 2026. arXiv:2609.34139. https://arxiv.org/abs/2609.34139
    - 一句话：提出 AnyAppBench（10 类功能、100 任务模板、52 应用 520 任务-应用对），揭示高分可能只是"记住了某个应用"而非理解任务。

14. **PhoneWorld: From Real-App Trajectories to Dynamic and Verifiable Environments for Phone-Use Agents**。Yuxuan Liu, Xin Lai, Junyi Li, et al.（共 24 位）. arXiv 预印本, 2026. arXiv:2605.29486. https://arxiv.org/abs/2605.29486
    - 一句话：真实应用难以重置、安全扩展与程序化验证，PhoneWorld 把真实轨迹转成可运行、可重置、可验证的 Android 环境以生成新经验。

---

## C 类：2025—2026 GUI 元素定位 / grounding（5 条）

15. **ScreenHaystack: Finding Blind Zones in GUI Grounding**。Chenyue Li, Xiaoxiao Sun, Yubo Deng, et al.（共 6 位）. EMNLP 2026 Main Conference, 2026. arXiv:2609.32036. https://arxiv.org/abs/2609.32036
    - 一句话：用"高分辨率界面里迁移目标图标"的动态大海捞针基准，发现 Qwen3-VL、UI-TARS、GTA、UI-Venus 等领先模型存在随空间位置剧烈掉点的"盲区"。

16. **Hallucination-Free GUI Grounding via Regression-Free Layout-Aware Matching**。Yuke Li, Xuehan Hou（**仅 2 位作者**）. arXiv 预印本, 2026. arXiv:2608.09654. https://arxiv.org/abs/2608.09654
    - 一句话：针对端到端 MLLM 因细粒度感知不足产生坐标幻觉的问题，提出免回归、由冻结 MLLM 做指令理解加布局感知匹配的 grounding 框架。

17. **VenusBench-GD: A Comprehensive Multi-Platform GUI Benchmark for Diverse Grounding Tasks**。Beitong Zhou, Zhexiao Huang, Yuan Guo, et al.（共 13 位）. arXiv 预印本, 2025. arXiv:2512.16501. https://arxiv.org/abs/2512.16501
    - 一句话：针对现有 grounding 基准数据量小、域覆盖窄或平台单一需专业领域知识的问题，提出跨平台双语、支持分层评估的大规模 GUI grounding 基准。

18. **Uncertainty Quantification for Computer-Use Agents: A Benchmark across Vision-Language Models and GUI Grounding Datasets**。Divake Kumar, Sina Tayebati, Devashri Naik, et al.（共 8 位）. NeurIPS 2026, 2026. arXiv:2606.25760. https://arxiv.org/abs/2606.25760
    - 一句话：构建 Argus 跨情境基准（27 种 UQ 方法 × 4 个 VLM × 多个 grounding 数据集），检验不确定性排序在模型/基准/界面变化时是否稳定，服务于拒答、校准与空间安全区域。

19. **Enhancing Trustworthy GUI Grounding via Self-Critiqued Reinforcement Learning**。Shaojie Zhang, Pei Fu, Ruoceng Zhang, et al.（共 11 位）. arXiv 预印本, 2025（2026-05 更新）. arXiv:2510.27266. https://arxiv.org/abs/2510.27266
    - 一句话：指出 SFT/RL 训练出的 grounding 模型置信度与实际正确性错配、过度自信，提出 HyperClick 自批判强化学习框架提升可信度。

---

## D 类：2025—2026 智能体安全、可信、监控与幻觉（6 条）

20. **It Lied to a Doctor to Buy Poison Ingredients: Quantifying Real-World Misuse of Phone-use Agents**。Yiming Sun, Chen Chen, Zifan Zhou, et al.（共 4 位）. arXiv 预印本, 2026. arXiv:2606.27944. https://arxiv.org/abs/2606.27944
    - 一句话：在真机与 27 个商用应用上首次实测手机智能体滥用风险，发现 9 个主流商用/开源模型驱动的智能体会执行购买毒品与爆炸物前体、诈骗、骚扰、刷评等严重滥用任务。

21. **Safe, or Simply Incapable? Rethinking Safety Evaluation for Phone-Use Agents**。Zhengyang Tang, Yi Zhang, Chenxin Li, et al.（共 21 位）. arXiv 预印本, 2026. arXiv:2605.07630. https://arxiv.org/abs/2605.07630
    - 一句话：区分"识别风险后选择安全动作"与"根本没能力执行"这两种被现有基准混为一谈的免害情形，提出 PhoneSafety 基准（700 个真实手机交互中的安全关键时刻）。

22. **Alignment Is Local: A Paired Diagnostic for GUI Agents under User-Side Persuasion**。Haoxin An, Yunpeng Song, Zihao Bai, et al.（共 9 位）. arXiv 预印本, 2026. arXiv:2607.29199. https://arxiv.org/abs/2607.29199
    - 一句话：论证当前移动智能体主流的提示层对齐只是"局部现象"，仅在单轮、显式表达有害意图的狭窄评测切片有效，并可被真实用户沿两个方向系统性击穿。

23. **Operational Hallucination and Safety Drift in AI Agents**。Shasha Yu, Fiona Carroll, Barry L. Bentley. ICAD 2026（由 DOI 指向 IEEE ICAD 2026）, 2026. arXiv:2607.18366. DOI: 10.1109/ICAD69378.2026.11608655. https://arxiv.org/abs/2607.18366
    - 一句话：实证刻画多轮工具调用智能体的两种失效模式——"安全漂移"（已声明的安全意图逐步侵蚀、口头拒绝后仍侦察并执行）与"操作性幻觉"。

24. **Oversight Has a Capacity: Calibrating Agent Guards to a Subjective, Fatiguing Human**。Emre Turan（**单一作者**）. arXiv 预印本, 2026. arXiv:2606.08919. https://arxiv.org/abs/2606.08919
    - 一句话：反驳"风险有客观真值"和"人类审核者是无限可用的完美预言机"两个假设，基于 125 条对抗加权动作标注显示审核者之间仅中度一致，主张按主观、会疲劳的人来校准智能体审批闸门。

25. **Knowing Is Not Enough: Information Retrievability as a Precondition to Effective LLM Oversight**。Xinyu Fu, Narayan Ramasubbu, Dennis Galletta. arXiv 预印本, 2026. arXiv:2609.01976. https://arxiv.org/abs/2609.01976
    - 一句话：提出以"检索可得性"解释人类监督失效的替代理论，通过两项共 640 名一线员工的随机实地实验表明自生成解释能提升 LLM 错误检出率。

---

## E 类：2025—2026 移动端智能体评测基准（5 条）

26. **MobileWorldSafety: Benchmarking GUI Agent Safety Against Environmental Injection Attacks in Android Apps**。Sujin Chen, Lijun Li, Tianyi Du, Jing Shao. arXiv 预印本, 2026. arXiv:2608.17659. https://arxiv.org/abs/2608.17659
    - 一句话：针对智能体处理不可信环境内容易受间接提示注入/对抗指令操纵的问题，构建贴近日常使用场景的 Android 环境注入攻击安全基准。

27. **AndroidDaily: A Verifiable Benchmark for Mobile GUI Agents on Real-World Closed-Source Applications**。Yifan Sui, Xin Huang, Hongbing Li, et al.（共 17 位）. arXiv 预印本, 2026. arXiv:2605.27761. https://arxiv.org/abs/2605.27761
    - 一句话：闭源应用不暴露内部状态导致传统自动验证失效，该基准用 94 个高频 Android 应用的 350 个日常任务提供可验证评测。

28. **GUI-CEval: A Hierarchical and Comprehensive Chinese Benchmark for Mobile GUI Agents**。Yang Li, Yuchen Liu, Haoyu Lu, et al.（共 11 位）. CVPR 2026（Comments 标注 accepted by CVPR 2026）, 2026. arXiv:2603.15039. https://arxiv.org/abs/2603.15039
    - 一句话：指出现有基准以英语为中心、无法覆盖中文移动生态的语言与交互特性且只测孤立技能，提出首个中文移动 GUI 智能体分层综合基准。

29. **MobileBench-OL: A Comprehensive Chinese Benchmark for Evaluating Mobile GUI Agents in Real-World Environment**。Qinzhuo Wu, Zhizhuo Yang, Hanhao Li, et al.（共 6 位）. arXiv 预印本, 2026. arXiv:2601.20335. https://arxiv.org/abs/2601.20335
    - 一句话：指出现有在线基准偏重指令遵循而忽视推理与探索能力、且未考虑真实环境随机噪声，提出含 1080 个任务的中文在线基准。

30. **MobileWorld: Benchmarking Autonomous Mobile Agents in Agent-User Interactive and MCP-Augmented Environments**。Quyu Kong, Xu Zhang, Zhenyu Yang, et al.（共 13 位）. arXiv 预印本, 2025. arXiv:2512.19432. https://arxiv.org/abs/2512.19432
    - 一句话：针对 AndroidWorld 已被突破 90% 成功率而饱和、且缺少电商与企业通信类场景、不反映模糊指令与混合工具使用的问题，提出更具挑战性的在线移动基准。

---

## 未能确认 / 未完成（不计入上述 30 条）

- **UI-TARS-2 Technical Report: Advancing GUI Agent with Multi-Turn Reinforcement Learning**（arXiv:2509.02544, 2025-09-02）、**Mobile-Agent-v3: Fundamental Agents for GUI Automation**（arXiv:2508.15144, 2025-08-21）、**UI-TARS: Pioneering Automated GUI Interaction with Native Agents**（arXiv:2501.12326）：仅在 arXiv 列表检索结果中出现（标题、ID、提交日期来自 API 列表响应），**未逐条抓取摘要页做 citation_* 校验**，故不作为正式条目。回收站可补：如需，请授权再抓。
- **GUI-Owl**：以 `ti:"GUI-Owl"` 检索 arXiv 返回 0 条，未能定位该名称的论文，**未能确认**。
- **UGround**：`ti:"UGround"` 仅命中 `2510.03853 UGround: Towards Unified Visual Grounding with Unrolled Transformers`（2025-10-04），与"GUI grounding 的 UGround"疑为同名不同工作，**未能确认**，未计入。
- **中文期刊 / 权威机构报告（CNNIC、老龄科研中心等）**：本次**未抓取**，本条方向未完成。已获得的中文相关条目仅为 arXiv 上的中文生态基准（GUI-CEval、MobileBench-OL）。
- 作者数不足 3 位的条目已在正文标注（#2 单作者、#16 双作者、#24 单作者），如需严格满足"前 3 位作者"可剔除。
- 抓取环境说明：本机 `web_fetch` 被 fake-IP 阻断的站点无法使用；上述条目全部改用 `python3 requests`（`verify=False`）访问 `arxiv.org` 成功（HTTP 200）。

---

### 数据文件
- 抓取脚本：同目录 `verify.py`、`arxivq.py`
- 原始证据：同目录 `v1.json`、`v1_api.json`、`v2.json`、`v2_api.json`、`detail.txt`
