# v17 · 声音第二版：和谐优先

## 修改范围

用户反馈第一版不够和谐。本轮重写配乐和声与配器，不修改画面、字幕、时长及音效的动作落点。第一版音视频及其源码快照保留。

## 和声调整

- 明确以 D 大调为中心。主要进行为 D → A/C# → Bm → G，结尾 A → D 回到主和弦。
- 用三和弦替代第一版同时堆叠的九、十一、六和弦，收紧声部距离。三条音垫声部由 F#—A—D、E—A—C#、F#—B—D、G—B—D 等近距离连接。
- 主题降低音区，以 F#—A—D 为基本轮廓，逐音适配当时的和弦；旋律、拨弦、低音和带音高的提示声不再各走各的调性。
- 不属于下一和弦的干声在换和弦前结束并淡出；共同音才允许延续。音垫不再以多秒重叠叠加不同和弦，音乐混响也缩短、减量。
- 键盘音色更柔和，减少失谐；提示声使用整数倍泛音。拨弦改为更稀疏的两拍间隔，降低拨弦、低音和打击乐的相对电平。
- 保留提问、暂停与本人确认处的留白，以及本地审计和独立复核的干、润音色差异。提交与待确认状态仍不使用成功庆祝音。

## 交付

目录：`out/review/fusion-v17-sound-v02/`。

- `fusion-v17-sound-v02.mp4`：完整 196 秒、1080p60，原 H.264 画面流直接复制，AAC 48 kHz 双声道 320 kbps，无旁白。
- `master-48k-24bit.wav`：无损母带。
- `music.wav`、`sfx.wav`、`stems/`：母带处理前的配乐、音效及细分音轨。
- `cues.json`：逐音音高、起点、时长、和弦、动作音效和章节时间表。
- `harmony-check.json`：逐一检查所有配乐干声音符及带音高音效的起点和持续区间；检查范围不包括混响尾音，也不替代试听评价。
- `mastering.json`、`validation.json`、`delivery.json`：响度、音画同步、完整解码、视频包哈希及交付信息。
- `audio-source/`：本轮制作代码、依赖和说明快照。

不自动播放或打开审片页。母带仍以约 -16 LUFS、-2 dBTP 为处理目标，并检查最终 AAC 的峰值余量。

## 重现

在 `video/` 目录运行：

```bash
uv venv tmp/audio-venv
uv pip install --python tmp/audio-venv/bin/python -r render/requirements-audio.txt
OPENBLAS_NUM_THREADS=2 tmp/audio-venv/bin/python render/soundtrack.py --output out/review/NEW-SOUND-VERSION
```

第一版的代码保存在其 `audio-source/` 内；当前 `render/` 代码制作第二版和声方案。生成器拒绝覆盖已经完成的交付目录。
