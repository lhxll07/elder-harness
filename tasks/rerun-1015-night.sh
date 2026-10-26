#!/usr/bin/env bash
# 2026-10-15 夜间重跑：每条任务各跑一遍，用干净入口。
#
# #17 单独处理：上一批里「UI 档位」和「系统 font_scale」会在批内逐渐不一致（runner 每轮把
# font_scale 写回基线，而 ColorOS 的字体页记得自己上次的档位）。既然要判「有没有真的调大」，
# 每次运行前就把设置页恢复到冷入口：回桌面 + 杀掉设置进程。
set -u
cd "$(dirname "$0")/.." || exit 1

echo "############ 第一组：#14 天气 / #19 网络 / #20 亮度 ############"
python3 -u tasks/run.py --only 14,19,20 --yes --timeout 200 < /dev/null 2>&1

echo
echo "############ 第二组：#17 字号（3 次，每次冷入口） ############"
for i in 1 2 3; do
  echo "---------- #17 干净入口 第 $i 次 ----------"
  adb shell am force-stop com.android.settings >/dev/null 2>&1
  adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1
  sleep 2
  echo "  跑前 font_scale = $(adb shell settings get system font_scale | tr -d '\r')"
  python3 -u tasks/run.py --only 17 --yes --font-baseline 1.15 --timeout 200 < /dev/null 2>&1
done

echo
echo "############ 跑批结束 ############"
