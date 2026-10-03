#!/usr/bin/env bash
# R2：老年人式模糊指令的澄清触发率（含明确指令作对照）
set -uo pipefail
cd "$(dirname "$0")"
GOALS=(
  "帮我看看那个到了没有|vague"
  "我要买那个东西|vague"
  "给我闺女说一声|vague"
  "看看明天有没有|vague"
  "把这个弄一下|vague"
  "他们说的那个事办了吗|vague"
  "现在几点了|clear"
  "今天星期几|clear"
)
OUT=raw/R2-模糊指令-结果.tsv
printf "类别\t目标\t结果\t步数\n" > "$OUT"
for row in "${GOALS[@]}"; do
  goal="${row%%|*}"; kind="${row##*|}"
  timeout 25 adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1; sleep 2
  out=$(timeout 240 ./run_device_task.sh task "$goal" 150 2>&1)
  settle=$(echo "$out" | grep -o "settle: [A-Z]* steps=[0-9]*" | tail -1)
  outcome=$(echo "$settle" | awk '{print $2}')
  steps=$(echo "$settle" | grep -o "[0-9]*$")
  printf "%s\t%s\t%s\t%s\n" "$kind" "$goal" "${outcome:-TIMEOUT}" "${steps:-?}" >> "$OUT"
  echo "---- $kind | $goal → ${outcome:-TIMEOUT} (steps=${steps:-?})"
done
echo "== 完成 =="; cat "$OUT"
