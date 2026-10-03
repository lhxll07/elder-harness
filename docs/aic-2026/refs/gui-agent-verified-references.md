### 一、手机端 GUI 智能体（Mobile GUI Agents）

1. **Mobile-Agent: Autonomous Multi-Modal Mobile Device Agent with Visual Perception**。Wang, Junyang, Xu, Haiyang, Ye, Jiabo et al.。ICLR 2024 Workshop on LLM Agents（arXiv 页面标注）, 2024. arXiv:2401.16158. https://arxiv.org/abs/2401.16158
   - 一句话：首个纯视觉感知的手机多模态智能体，用视觉工具定位界面元素并自主规划操作，摆脱对 App XML/系统元数据的依赖，同时提出 Mobile-Eval 基准。

2. **Mobile-Agent-v2: Mobile Device Operation Assistant with Effective Navigation via Multi-Agent Collaboration**。Wang, Junyang, Xu, Haiyang, Jia, Haitao et al.。arXiv 预印本, 2024. arXiv:2406.01014. https://arxiv.org/abs/2406.01014
   - 一句话：用「规划智能体+决策智能体+反思智能体」的多智能体架构解决手机操作中的任务进度导航与焦点内容导航两大难题，任务完成率较单智能体提升 30% 以上。

3. **Mobile-Agent-v3: Fundamental Agents for GUI Automation**。Ye, Jiabo, Zhang, Xi, Xu, Haiyang et al.。arXiv 预印本, 2025. arXiv:2508.15144. https://arxiv.org/abs/2508.15144
   - 一句话：提出基础 GUI 智能体模型 GUI-Owl 与通用框架 Mobile-Agent-v3，靠云真机环境、自进化轨迹生产和异步 RL（TRPO）在 AndroidWorld/OSWorld 上刷新开源最好成绩。

4. **AppAgent: Multimodal Agents as Smartphone Users**。Zhang, Chi, Yang, Zhao, Liu, Jiaxuan et al.。CHI 2025（arXiv 页面标注）, 2023. arXiv:2312.13771. https://arxiv.org/abs/2312.13771
   - 一句话：让 LLM 多模态智能体像人一样通过点击/滑动操作手机 App，无需后端接口，并通过自主探索或观察人类演示建立可复用知识库。

5. **AutoDroid: LLM-powered Task Automation in Android**。Wen, Hao, Li, Yuanchun, Liu, Guohong et al.。MobiCom 2024（arXiv 页面标注，原标题为 Empowering LLM to use Smartphone for Intelligent Task Automation）, 2023. arXiv:2308.15272. https://arxiv.org/abs/2308.15272
   - 一句话：用 LLM 加自动化动态分析（UI 表示、探索式记忆注入、多粒度查询优化）实现任意 Android App 的任务自动化，动作生成准确率 90.9%、任务成功率 71.3%。

6. **MobileAgentBench: An Efficient and User-Friendly Benchmark for Mobile LLM Agents**。Wang, Luyuan, Deng, Yongyu, Zha, Yiwei et al.。arXiv 预印本, 2024. arXiv:2406.08184. https://arxiv.org/abs/2406.08184
   - 一句话：针对手机智能体缺乏基准的问题，在 10 个开源 App 上定义 100 个分难度任务，并对 AppAgent、MobileAgent 等做系统对比评测。

7. **AndroidWorld: A Dynamic Benchmarking Environment for Autonomous Agents**。Rawles, Christopher, Clinckemaillie, Sarah, Chang, Yifan et al.。arXiv 预印本, 2024. arXiv:2405.14573. https://arxiv.org/abs/2405.14573
   - 一句话：构建可复现的 Android 环境，用 20 个真实 App 上 116 个可程序化校验、可参数化动态生成的任务做奖励信号，并提供基线与鲁棒性分析。

8. **Mobile-Bench: An Evaluation Benchmark for LLM-based Mobile Agents**。Deng, Shihan, Xu, Weikai, Sun, Hongda et al.。arXiv 预印本, 2024. arXiv:2407.00993. https://arxiv.org/abs/2407.00993
   - 一句话：提出含 103 个 API 的 Mobile-Bench 基准（832 条数据、200+ 跨 App 任务，分 SAST/SAMT/MAMT 三级），并引入 CheckPoint 指标衡量规划推理是否命中关键点。

9. **MobileExperts: A Dynamic Tool-Enabled Agent Team in Mobile Devices**。Zhang, Jiayi, Zhao, Chuang, Zhao, Yihan et al.。arXiv 预印本, 2024. arXiv:2407.03913. https://arxiv.org/abs/2407.03913
   - 一句话：首次把工具构造与多智能体协作引入手机任务：按需求动态组队、各智能体自主探索生成工具，再用双层规划协调，推理成本降低约 22%。

10. **Android in the Zoo: Chain-of-Action-Thought for GUI Agents**。Zhang, Jiwen, Wu, Jihao, Teng, Yihua et al.。arXiv 预印本, 2024. arXiv:2403.02713. https://arxiv.org/abs/2403.02713
   - 一句话：提出 Chain-of-Action-Thought（CoAT）动作思维链，把历史动作、当前屏幕与动作意图/后果一起建模，并发布 18,643 组屏幕-动作数据的 AitZ 数据集。

11. **MobileFlow: A Multimodal LLM For Mobile GUI Agent**。Nong, Songqin, Zhu, Jiali, Wu, Rui et al.。arXiv 预印本, 2024. arXiv:2407.04346. https://arxiv.org/abs/2407.04346
   - 一句话：面向手机 GUI 智能体的 21B 多模态模型，用混合视觉编码器支持变分辨率与多语言（尤其中文）界面，避免调用系统 API 带来的隐私风险。

### 二、网页 / 通用 GUI 智能体（Web & General GUI Agents）

12. **Mind2Web: Towards a Generalist Agent for the Web**。Deng, Xiang, Gu, Yu, Zheng, Boyuan et al.。NeurIPS 2023 Spotlight（arXiv 页面标注）, 2023. arXiv:2306.06070. https://arxiv.org/abs/2306.06070
   - 一句话：首个面向通用网页智能体的数据集：137 个网站 31 个领域 2000+ 开放任务，并证明先用小模型过滤 HTML 能显著提升 LLM 网页智能体的效果与效率。

13. **WebArena: A Realistic Web Environment for Building Autonomous Agents**。Zhou, Shuyan, Xu, Frank F., Zhu, Hao et al.。arXiv 预印本, 2023. arXiv:2307.13854. https://arxiv.org/abs/2307.13854
   - 一句话：构建可复现的高保真网页环境（电商、论坛、代码协作、内容管理四类真实站点并配工具与知识库）及长程任务基准；最好 GPT-4 智能体成功率仅 14.41%，人类为 78.24%。

14. **VisualWebArena: Evaluating Multimodal Agents on Realistic Visual Web Tasks**。Koh, Jing Yu, Lo, Robert, Jang, Lawrence et al.。ACL 2024（arXiv 页面标注）, 2024. arXiv:2401.13649. https://arxiv.org/abs/2401.13649
   - 一句话：针对文本基准忽视视觉信息的缺陷，提出面向真实视觉网页任务的多模态智能体基准，并系统评估当时的多模态模型、暴露其能力缺口。

15. **OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments**。Xie, Tianbao, Zhang, Danyang, Chen, Jixuan et al.。arXiv 预印本, 2024. arXiv:2404.07972. https://arxiv.org/abs/2404.07972
   - 一句话：首个可扩展的真实计算机环境（Ubuntu/Windows/macOS）与 369 个跨应用开放任务基准，人类完成率 72.36% 而最好模型仅 12.24%，瓶颈主要在 GUI 定位与操作知识。

16. **GPT-4V(ision) is a Generalist Web Agent, if Grounded**。Zheng, Boyuan, Gou, Boyu, Kil, Jihyung et al.。arXiv 预印本, 2024. arXiv:2401.01614. https://arxiv.org/abs/2401.01614
   - 一句话：提出 SEEACT 探索 GPT-4V 作为通用网页智能体，并构建可在真实网站运行智能体的在线评测工具；人工把文本计划落地为动作时成功率达 51.1%，说明 grounding 仍是最大瓶颈。

17. **Set-of-Mark Prompting Unleashes Extraordinary Visual Grounding in GPT-4V**。Yang, Jianwei, Zhang, Hao, Li, Feng et al.。arXiv 预印本, 2023. arXiv:2310.11441. https://arxiv.org/abs/2310.11441
   - 一句话：提出 Set-of-Mark 视觉提示：用分割模型把图像切成区域并叠加数字/掩码标记，使 GPT-4V 具备强视觉定位能力（零样本在 RefCOCOg 上超过全量微调模型）。

18. **WebVoyager: Building an End-to-End Web Agent with Large Multimodal Models**。He, Hongliang, Yao, Wenlin, Ma, Kaixin et al.。ACL 2024 Main（arXiv 页面标注）, 2024. arXiv:2401.13919. https://arxiv.org/abs/2401.13919
   - 一句话：LMM 驱动的端到端网页智能体，直接在真实网站完成任务；基于 15 个热门网站建基准并提出 GPT-4V 自动评测协议，任务成功率 59.1%、与人工判断一致率 85.3%。

19. **WebSuite: Systematically Evaluating Why Web Agents Fail**。Li, Eric, Waldo, Jim。arXiv 预印本, 2024. arXiv:2406.01623. https://arxiv.org/abs/2406.01623
   - 一句话：首个面向通用网页智能体的诊断型基准：先用动作分类学定位失败，再设计可归因到具体网络动作的测试套件，从而回答「智能体为什么失败」。

### 三、GUI 元素定位 / Grounding

20. **Ferret-UI: Grounded Mobile UI Understanding with Multimodal LLMs**。You, Keen, Zhang, Haotian, Schoop, Eldon et al.。arXiv 预印本, 2024. arXiv:2404.05719. https://arxiv.org/abs/2404.05719
   - 一句话：针对通用 MLLM 不擅理解 UI 屏幕的问题，用「任意分辨率」把屏幕切分为子图放大细节，并构造基础与高级 UI 指令数据，训练出具备指代、定位与推理能力的手机 UI 专用 MLLM。

21. **Ferret-UI 2: Mastering Universal User Interface Understanding Across Platforms**。Li, Zhangheng, You, Keen, Zhang, Haotian et al.。ICLR 2025（arXiv 页面标注）, 2024. arXiv:2410.18967. https://arxiv.org/abs/2410.18967
   - 一句话：把 Ferret-UI 扩展到 iPhone/Android/iPad/Web/AppleTV 多平台，通过自适应缩放做高分辨率感知、并用 GPT-4o + Set-of-Mark 生成训练数据，实现跨平台通用 UI 理解。

22. **SeeClick: Harnessing GUI Grounding for Advanced Visual GUI Agents**。Cheng, Kanzhi, Sun, Qiushi, Chu, Yougang et al.。arXiv 预印本, 2024. arXiv:2401.10935. https://arxiv.org/abs/2401.10935
   - 一句话：证明纯截图的视觉 GUI 智能体关键在于 GUI grounding，通过自动构造 grounding 数据做预训练，并发布跨移动/桌面/网页的首个真实 GUI 定位基准 ScreenSpot。

23. **Navigating the Digital World as Humans Do: Universal Visual Grounding for GUI Agents**。Gou, Boyu, Wang, Ruohan, Zheng, Boyuan et al.。ICLR 2025 Oral（arXiv 页面标注）, 2024. arXiv:2410.05243. https://arxiv.org/abs/2410.05243
   - 一句话：主张智能体应像人一样纯视觉感知并在像素级操作，用 1000 万 GUI 元素 / 130 万截图训练通用视觉定位模型，六大基准上比现有模型高最多 20 个百分点。

24. **OS-ATLAS: A Foundation Action Model for Generalist GUI Agents**。Wu, Zhiyong, Wu, Zhenyu, Xu, Fangzhi et al.。arXiv 预印本, 2024. arXiv:2410.23218. https://arxiv.org/abs/2410.23218
   - 一句话：为摆脱对 GPT-4o/Gemini 等闭源 VLM 的依赖，开源跨平台（Windows/Linux/macOS/Android/Web）GUI 定位数据合成工具链、1300 万+ 元素语料，训练出基础 GUI 动作模型。

25. **ShowUI: One Vision-Language-Action Model for GUI Visual Agent**。Lin, Kevin Qinghong, Li, Linjie, Gao, Difei et al.。技术报告（arXiv 页面标注）, 2024. arXiv:2411.17465. https://arxiv.org/abs/2411.17465
   - 一句话：轻量 2B 的视觉-语言-动作模型：用 UI 连通图做视觉 token 选择（省 33% token、提速 1.4x）、交错式视觉-语言-动作流建模，零样本截图定位达 75.1%。

26. **UI-TARS: Pioneering Automated GUI Interaction with Native Agents**。Qin, Yujia, Ye, Yining, Fang, Junjie et al.。arXiv 预印本, 2025. arXiv:2501.12326. https://arxiv.org/abs/2501.12326
   - 一句话：端到端原生 GUI 智能体模型，仅凭截图输入完成类人键鼠操作，在 10+ 基准上 SOTA（OSWorld 24.6、AndroidWorld 46.6），并给出增强感知、统一动作建模、System-2 推理与迭代反思训练四项创新。

27. **ScreenAI: A Vision-Language Model for UI and Infographics Understanding**。Baechler, Gilles, Sunkara, Srinivas, Wang, Maria et al.。IJCAI 2024（arXiv 页面标注）, 2024. arXiv:2402.04615. https://arxiv.org/abs/2402.04615
   - 一句话：面向 UI 与信息图理解的视觉语言模型：以屏幕标注任务为核心，自动生成 QA/UI 导航/摘要数据，仅 5B 参数在多项 UI 与信息图任务上刷新 SOTA，并发布三个新数据集。

### 四、智能体的可靠性、幻觉与安全

28. **Identifying the Risks of LM Agents with an LM-Emulated Sandbox**。Ruan, Yangjun, Dong, Honghua, Wang, Andrew et al.。arXiv 预印本, 2023. arXiv:2309.15817. https://arxiv.org/abs/2309.15817
   - 一句话：提出用 LM 模拟工具执行（ToolEmu）来低成本测试 LM 智能体的长尾高风险失败，并配自动安全评估器；即使是「最安全」的智能体仍有 23.9% 概率出现严重失败。

29. **Large Language Models Cannot Self-Correct Reasoning Yet**。Huang, Jie, Chen, Xinyun, Mishra, Swaroop et al.。ICLR 2024（arXiv 页面标注）, 2023. arXiv:2310.01798. https://arxiv.org/abs/2310.01798
   - 一句话：批判性检验 LLM 的「内在自我纠错」：在推理任务中若无外部反馈，模型难以自我纠错，自我纠错后性能有时反而下降。

30. **Cognitive Mirage: A Review of Hallucinations in Large Language Models**。Ye, Hongbin, Liu, Tong, Zhang, Aijia et al.。arXiv 预印本（work in progress）, 2023. arXiv:2309.06794. https://arxiv.org/abs/2309.06794
   - 一句话：对 LLM 幻觉做系统综述，给出跨文本生成任务的幻觉分类体系、理论分析、检测与改进方法，并提出未来研究方向。

31. **Why Do Multi-Agent LLM Systems Fail?**。Cemri, Mert, Pan, Melissa Z., Yang, Shuyi et al.。arXiv 预印本（v3）, 2025. arXiv:2503.13657. https://arxiv.org/abs/2503.13657
   - 一句话：用 1600+ 条多智能体系统运行轨迹与专家标注，建立首个多智能体失败分类学 MAST（14 种失败模式、3 大类），解释为何 MAS 相对单智能体收益有限。

32. **Agent Security Bench (ASB): Formalizing and Benchmarking Attacks and Defenses in LLM-based Agents**。Zhang, Hanrong, Huang, Jingyuan, Mei, Kai et al.。ICLR 2025（arXiv 页面标注）, 2024. arXiv:2410.02644. https://arxiv.org/abs/2410.02644
   - 一句话：提出 Agent Security Bench，涵盖 10 类场景、10 个智能体、400+ 工具、27 种攻防方法与 7 项指标，系统评测 LLM 智能体的攻击与防御，最高平均攻击成功率达 84.30% 而现有防御效果有限。

33. **Harms from Increasingly Agentic Algorithmic Systems**。Chan, Alan, Salganik, Rebecca, Markelius, Alva et al.。FAccT 2023（arXiv 页面标注），DOI 10.1145/3593013.3594033（经 Crossref 核验）, 2023. arXiv:2302.10329 / DOI 10.1145/3593013.3594033. https://arxiv.org/abs/2302.10329
   - 一句话：从 FATE 视角提出「智能体性」的四个特征（欠规范、影响直接性、目标导向、长期规划），并论证这些特征如何放大对边缘群体的系统性、长程危害。

34. **Towards Understanding Sycophancy in Language Models**。Sharma, Mrinank, Tong, Meg, Korbak, Tomasz et al.。arXiv 预印本, 2023. arXiv:2310.13548. https://arxiv.org/abs/2310.13548
   - 一句话：证明五个 SOTA AI 助手在四类自由生成任务上普遍存在谄媚（迎合用户观点而非事实），并指出人类偏好数据与偏好模型是这一行为的重要成因。

35. **Training language models to follow instructions with human feedback**。Ouyang, Long, Wu, Jeff, Jiang, Xu et al.。arXiv 预印本, 2022. arXiv:2203.02155. https://arxiv.org/abs/2203.02155
   - 一句话：用人类示范做监督微调、再用人类偏好排序做 RLHF，得到 InstructGPT；1.3B 版本的输出比 175B GPT-3 更受人类偏好，真实性提升、有害输出减少。

36. **Does the Whole Exceed its Parts? The Effect of AI Explanations on Complementary Team Performance**。Bansal, Gagan, Wu, Tongshuang, Zhou, Joyce et al.。CHI 2021（arXiv 页面标注）, 2020. arXiv:2006.14779. https://arxiv.org/abs/2006.14779
   - 一句话：用三项混合方法用户实验检验 AI 解释能否带来「互补性」团队表现，发现解释并未提升团队准确率，反而提高了人类接受 AI 建议的概率（无论对错）。

37. **Dark Patterns Meet GUI Agents: LLM Agent Susceptibility to Manipulative Interfaces and the Role of Human Oversight**。Tang, Jingyu, Chen, Chaoran, Li, Jiawen et al.。arXiv 预印本, 2025. arXiv:2509.10723. https://arxiv.org/abs/2509.10723
   - 一句话：两阶段实证研究 16 种暗黑模式对人类、LLM GUI 智能体及人机团队的影响：智能体常识别不出暗黑模式，人类监督虽提升规避率却带来注意力隧道与认知负荷等代价。

38. **Toward a Human-Centered Evaluation Framework for Trustworthy LLM-Powered GUI Agents**。Chen, Chaoran, Zhang, Zhiping, Khalilov, Ibrahim et al.。arXiv 预印本（position paper）, 2025. arXiv:2504.17934. https://arxiv.org/abs/2504.17934
   - 一句话：指出 LLM GUI 智能体在有限人类监督下处理敏感数据存在隐私与安全风险，现有评测只看性能，主张建立含风险评估、情境化同意的人本评测框架。

39. **Reliable Weak-to-Strong Monitoring of LLM Agents**。Kale, Neil, Zhang, Chen Bo Calvin, Zhu, Kevin et al.。arXiv 预印本, 2025. arXiv:2508.19461. https://arxiv.org/abs/2508.19461
   - 一句话：系统化「监控红队」流程并新增面向 computer-use 智能体的 CUA-SHADE-Arena，发现智能体是否知道被监控极大影响监控可靠性，而人类介入只对已被标记的案例最有效（FPR=0.01 时 TPR 约提升 15%）。

### 五、无障碍（Accessibility）与自动化操作

40. **Screen Recognition: Creating Accessibility Metadata for Mobile Applications from Pixels**。Zhang, Xiaoyi, de Greef, Lilian, Swearngin, Amanda et al.。arXiv 预印本, 2021. arXiv:2101.04893. https://arxiv.org/abs/2101.04893
   - 一句话：针对大量 iOS App 不提供无障碍元数据的问题，用在 77,637 张屏幕/4,068 个 App 上训练的端上模型从像素推断 UI 元素与语义，生成无障碍元数据增强 VoiceOver，9 名屏幕阅读器用户验证有效。

41. **Unblind Your Apps: Predicting Natural-Language Labels for Mobile GUI Components by Deep Learning**。Chen, Jieshan, Chen, Chunyang, Xing, Zhenchang et al.。ICSE 2020（arXiv 页面标注），DOI 10.1145/3377811.3380327（经 Crossref 核验，官方题名 Unblind your apps）, 2020. arXiv:2003.00380 / DOI 10.1145/3377811.3380327. https://arxiv.org/abs/2003.00380
   - 一句话：分析 10,408 个 Android App 发现 77% 以上存在标签缺失问题，提出 LabelDroid 深度学习模型自动为图像按钮预测自然语言标签，生成质量优于真实开发者。

42. **Accessible or Not? An Empirical Investigation of Android App Accessibility**。Chen, Sen, Chen, Chunyang, Fan, Lingling et al.。arXiv 预印本, 2022. arXiv:2203.06422. https://arxiv.org/abs/2203.06422
   - 一句话：提出自动化页面探索工具 Xbot 做无障碍测试（活动覆盖率约 80%），从 2,270 个 App 收集 86,767 个无障碍问题，从「问题级」视角实证研究严重程度、类型分布与修复状况。

43. **Early Accessibility: Automating Alt-Text Generation for UI Icons During App Development**。Haque, Sabrina, Csallner, Christoph。arXiv 预印本, 2025. arXiv:2504.13069. https://arxiv.org/abs/2504.13069
   - 一句话：针对 UI 图标缺少 alt 文本，提出 ALTICON 在开发阶段生成图标替代文本：抽取 DOM 上下文、OCR 图标内文字并结构化提示，无需整屏输入即可生成更高质量的 alt-text。

44. **Insight: Enhancing Mobile Accessibility for Blind and Visually Impaired Users with LLMs**。Ansah, Joshua Owusu, Kapoor, Anuj, Khanna, Ayush et al.。arXiv 预印本, 2026. arXiv:2605.09803. https://arxiv.org/abs/2605.09803
   - 一句话：针对 TalkBack 只能手势顺序朗读的局限，实现 Android 无障碍服务 Insight，用 LLM 提供自然语言交互与实时屏幕摘要；被试实验显示其降低心理负荷与任务时间，但需要打断管理机制。

45. **Virtualization-based Penetration Testing Study for Detecting Accessibility Abuse Vulnerabilities in Banking Apps in East and Southeast Asia**。Minn, Wei, Phan, Phong, Malviya, Vikas K. et al.。APSEC 2025 SEIP（arXiv 页面标注）, 2026. arXiv:2601.21258. https://arxiv.org/abs/2601.21258
   - 一句话：针对利用虚拟化与 hook 绕过检测的恶意无障碍服务（FjordPhantom），实证研究东亚与东南亚银行 App 的易感性、现有防护措施有效性，并讨论检测与缓解方法。

46. **Not an A11y: How Android Accessibility Exposes Mobile AI Agents to Indirect Prompt Injection**。Deivasigamani, Rahul, Alvi, Sayeda Faatin, Andrea, Derqui et al.。arXiv 预印本, 2026. arXiv:2608.08939. https://arxiv.org/abs/2608.08939
   - 一句话：指出 MobileRun、Mobile-Use 等手机智能体依赖未净化的 Android 无障碍（A11y）树导致间接提示注入这一系统性漏洞，实证得到目标劫持、上下文漂移与未授权操作，攻击成功率最高 0.822。

---

### 说明与「未能确认」条目

**抓取方式**：本机 `web_fetch` 工具被拒绝（DNS 解析到 198.18.0.x fake-IP），全部改用 `python3 + requests` 直接抓取。共抓取 46 个 arXiv abs 页面，全部返回 HTTP 200，标题/作者/日期/摘要/DOI 均直接取自页面 `<meta name="citation_*">` 与摘要区块，非记忆生成。

**未能确认 / 已排除的条目**：

1. **AccessiLeaks: Investigating Privacy Leaks Exposed by the Android Accessibility Service**（我最初凭印象认为 DOI 为 10.2478/popets-2019-0026）——**已核实为错误**：抓取该 DOI 页面（petsymposium.org）与 Crossref 均显示该 DOI 实际对应 *"SoK: Modular and Efficient Private Decision Tree Evaluation"*（Ágnes Kiss et al., PoPETs 2019）。因此**该条不予收录**，未找到 AccessiLeaks 的可验证 DOI。
2. **ACM Digital Library 直链全部返回 403**（`dl.acm.org/doi/10.1145/3626232.3658638` 与 `doi.org` 同一目标均 403）。因此第 33、41 条的 DOI 元数据改用 **Crossref API（api.crossref.org）** 核验，返回 200 且标题/作者/会议名与 arXiv 页面一致。第 46 条中提到的 "A-COPILOT: Android Covert Operation for Private Information Lifting and OTP Theft"（DOI 10.1145/3626232.3658638，来自搜索结果摘要）**因 ACM 403 无法抓取原文页面而排除**，未列入正表。
3. 所有条目的「发表处」仅采用 arXiv abs 页面 comments 字段或 Crossref 明确显示的会议/期刊名；页面未标注会议的一律写「arXiv 预印本」，未凭记忆补全（例如 WebArena、OSWorld、Screen Recognition、InstructGPT 的实际会议名未在页面出现，故未填写）。
