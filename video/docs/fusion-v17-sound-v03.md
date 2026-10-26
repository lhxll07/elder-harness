# v17 · 声音第三版：连贯的钢琴叙事与动作同步

## 音乐方向

用户指定 Zeta / 3Blue1Brown 的气质作为方向参考。本轮制作新的原创配乐：温暖、好奇、克制，以连续钢琴织体和完整乐句推进，不使用参考曲的音频、旋律、转录或编曲素材。

- 96 BPM、4/4，6 秒引子后进入规则小节网格。每个八小节乐句为 20 秒，和声不再被每个分镜的任意长度打断。
- 原创三音主题 A—D—F# 形成问句与答句，九组长乐句逐步变化，结尾通过 A → D 回到主调。
- 使用真正的钢琴乐器采样而非合成提示音充当主旋律。右手轻琶音、前景旋律、低音及极轻音垫分轨组织；不再用通知音串替代音乐，也不铺满打击乐。
- 提问、暂停与本人确认处减少织体。钢琴演奏允许数毫秒的轻微人性化；音效不跟随这种偏移，也不吸附音乐节拍。

## 音效同步

同步的依据是已锁定 v17 的动画源码，而不是字幕的大致时间。`render/animation-sound-cues.mjs` 直接导入 v17 冻结快照中的剪辑、编译器、语音、运行、记忆等时钟，并将原动画的关键相位映射到导出 60 fps 时间线。

- 页面抽取的空气感配合运动速度峰值，短落点对应信息实际归位。
- 提交声对应本人触点动画；核验声对应本地与云端进度完成；采用声对应家人点按动画。
- 各音效先测量独立声音 5 ms RMS 能量峰的位置，再提前安排起始采样，使能量峰落在指定动画帧。不是把音频文件开头放到画面落点，也不是将音效挪到最近音乐拍。
- 对冻结动画表达式与文件哈希建立契约，保存每个落点的源码文件、行号、原始时钟值、导出帧号、起始采样和峰值偏移。
- 封装后另将 AAC 解码，与无损母带在多个关键区间互相关，检查编码是否引入整体音频位移。此数值检查不等同于主观审片。

## 钢琴采样署名

Salamander Grand Piano V3，作者 Alexander Holm，调音版本 Markus Fiedler，CC BY 3.0。乐器源为 `sfzinstruments/SalamanderGrandPiano`，固定提交 `3382bf9496bba2486f5ab0de55a264d1dfc38404`。使用 34 个软、中力度乐器采样，进行移调、重采样、滤波和包络处理。它们不是外部配乐录音。来源、文件哈希和授权保存在 `instrument-provenance.json`、`CREDITS.txt`、`PIANO-LICENSE.txt`；MP4 元数据同样保留署名。

## 交付与复现

完整文件：`out/review/fusion-v17-sound-v03/fusion-v17-sound-v03.mp4`。196 秒、1080p60，无旁白，原画面 H.264 流直接复制，不重渲染、不覆盖声音第一、二版。不自动播放或打开审片页。

同目录保留钢琴与音效分轨、无损母带、声音时间表、`animation-cues.json`、`cue-sync.json`、`harmony-check.json`、`encoded-sync-check.json`、响度与交付校验信息。

在 `video/` 目录运行：

```bash
uv pip install --python tmp/audio-venv/bin/python -r render/requirements-audio.txt
OPENBLAS_NUM_THREADS=2 tmp/audio-venv/bin/python render/soundtrack_v03.py --output out/review/NEW-SOUND-VERSION
```

首次下载固定版本的乐器采样；已有文件会复用。默认拒绝覆盖已经完成的交付目录。只有制作中断、尚未完成交付时，才可用 `--remaster` 复用已完成的分轨。
