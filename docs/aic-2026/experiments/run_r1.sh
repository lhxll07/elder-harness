#!/usr/bin/env bash
# R1：跨应用泛化——同一目标在不同 App 上是否同样办得成。
# 协议：启动 App → 同一目标 → 截"答案卡" → 收起面板 → 截"App 原页面"（供人工交叉核对）。
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p raw
GOAL="看看我的快递到哪了"
APPS=(
  "com.xunmeng.pinduoduo|拼多多"
  "com.taobao.taobao|淘宝"
  "com.jingdong.app.mall|京东"
)
OUT=raw/R1-跨应用泛化-结果.tsv
printf "App\t目标\t结果\t步数\t答案卡\t原页面\n" > "$OUT"
for row in "${APPS[@]}"; do
  pkg="${row%%|*}"; name="${row##*|}"
  timeout 30 adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 6
  out=$(timeout 300 ./run_device_task.sh task "$GOAL" 200 2>&1)
  settle=$(echo "$out" | grep -o "settle: [A-Z]* steps=[0-9]*" | tail -1)
  outcome=$(echo "$settle" | awk '{print $2}'); steps=$(echo "$settle" | grep -o "[0-9]*$")
  shot1="raw/R1-${name}-答案卡.png"; shot2="raw/R1-${name}-原页面.png"
  timeout 30 adb exec-out screencap -p > "$shot1" 2>/dev/null
  timeout 20 adb shell input tap 635 2251 >/dev/null 2>&1; sleep 2
  timeout 30 adb exec-out screencap -p > "$shot2" 2>/dev/null
  printf "%s\t%s\t%s\t%s\t%s\t%s\n" "$name" "$GOAL" "${outcome:-TIMEOUT}" "${steps:-?}" "$shot1" "$shot2" >> "$OUT"
  echo "---- $name → ${outcome:-TIMEOUT} (steps=${steps:-?})"
  # 把结论原文也留档，便于逐项核对
  echo "$out" | grep -A40 "== 日志" | grep -E "settle:|final:|msg=" | tail -3 >> "raw/R1-${name}-结论.txt"
  echo "$out" | grep "settle:" | tail -1 >> "raw/R1-${name}-结论.txt"
done
echo "== 完成 =="; cat "$OUT"
