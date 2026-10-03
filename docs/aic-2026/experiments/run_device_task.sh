#!/usr/bin/env bash
# 真机实验驱动：通过 adb 调试通道启动任务 / 校准 / 屏幕普查，并回收日志。
#
# 用法：
#   ./run_device_task.sh task "<目标>" [超时秒数]     # 跑一个任务，等到 settle 行为止
#   ./run_device_task.sh calibrate [超时秒数]         # R3：坐标量化校准（不点按）
#   ./run_device_task.sh census                       # 观察当前屏幕，记录树 vs 呈现
#   ./run_device_task.sh log                          # 直接打印当前 loop.log 末尾
#
# 前提：设备已连接、App 已安装并授予无障碍、屏幕已解锁。
# 调试通道的安全边界：endpoint 与 auto_confirm 不能经 intent 修改，只能在设置页改。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PKG=com.yinling.hotline
ACTIVITY="$PKG/.MainActivity"
MODE="${1:?用法: run_device_task.sh task|calibrate|census|log ...}"

if [ -f "$ROOT/.env.local" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
fi

adb_log() { timeout 30 adb shell run-as "$PKG" cat files/loop.log 2>/dev/null; }

wake() {
  local state
  state=$(timeout 20 adb shell dumpsys power 2>/dev/null | grep -m1 "mWakefulness=" | cut -d= -f2)
  if [ "$state" != "Awake" ]; then
    timeout 20 adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
    sleep 1
    # 仅在熄屏时上滑解锁：设备已唤醒时上滑会误触当前应用（例如把聊天列表滑走），
    # 在"把任务放进相关 App 内"的实验里会构成混杂因素。
    timeout 20 adb shell input swipe 540 1800 540 600 >/dev/null 2>&1 || true
    sleep 1
  fi
}

launch() {
  timeout 30 adb shell am start -n "$ACTIVITY" \
    --ez developer_mode true \
    --es apikey "${DEEPSEEK_API_KEY:-}" \
    --es model "${DEEPSEEK_MODEL:-deepseek-chat}" \
    --ez vision true \
    "$@" >/dev/null 2>&1
}

case "$MODE" in
  task)
    GOAL="${2:?需要目标}"
    LIMIT="${3:-240}"
    wake
    # 清空日志，便于把本次的 settle 从历史里区分出来
    launch --ez clear_log true --ez start true --es goal "$GOAL"
    echo "== 已启动：$GOAL（上限 ${LIMIT}s）=="
    waited=0
    while [ "$waited" -lt "$LIMIT" ]; do
      sleep 5; waited=$((waited + 5))
      if adb_log | grep -q "^.*settle:"; then break; fi
    done
    echo "== 日志（过滤心跳噪音）=="
    adb_log | grep -vE "\[server\]|\[health\]" | tail -60
    echo "== settle =="
    adb_log | grep "settle:" | tail -1
    ;;

  calibrate)
    LIMIT="${2:-300}"
    wake
    launch --ez clear_log true --ez calibrate_tap true
    echo "== 已启动坐标校准（上限 ${LIMIT}s）=="
    waited=0
    while [ "$waited" -lt "$LIMIT" ]; do
      sleep 5; waited=$((waited + 5))
      if adb_log | grep -q "\[calib\] SUMMARY"; then break; fi
    done
    adb_log | grep "\[calib\]" | tail -30
    ;;

  census)
    wake
    launch --ez clear_log true --ez census true
    sleep 6
    adb_log | grep -viE "\[server\]|\[health\]" | tail -30
    ;;

  log)
    adb_log | grep -viE "\[server\]|\[health\]" | tail -80
    ;;

  *)
    echo "未知模式：$MODE"; exit 2 ;;
esac
