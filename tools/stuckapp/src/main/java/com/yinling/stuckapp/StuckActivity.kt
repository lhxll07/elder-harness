package com.yinling.stuckapp

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * 一个永远加载不完的页面。
 *
 * 任务 #23 要测的是：代理遇到「一直转圈打不开」时，会不会先等待重试、最后**有界停止**并如实
 * 说明，而不是谎报已经打开。前提必须是一个**持续**读不到内容的页面，所以这里刻意不设任何
 * 成功路径——没有计时器、没有 fallback、没有可点按钮，界面永远停在加载态。
 *
 * 页面本身保持可读（有控件、有文字），这样代理能看清「这是一个加载中的页面」，而不是陷入
 * 完全盲页；#23 考的是它对「一直没好」的处理，不是它对空白屏幕的处理。
 */
class StuckActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 允许截图：默认禁用会让代理只剩无障碍树一条路，那是另一个测试目标。
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val pad = (resources.displayMetrics.density * 24).toInt()

        val spinner = ProgressBar(this).apply {
            // 用大号转圈，让「正在加载」在视觉上也一眼可见。
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }

        val label = TextView(this).apply {
            text = getString(R.string.loading)
            textSize = 20f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#333333"))
        }

        val hint = TextView(this).apply {
            text = getString(R.string.loading_hint)
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#888888"))
        }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(pad, pad, pad, pad)
            addView(spinner)
            addView(label, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = pad })
            addView(hint, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = pad / 2 })
        }

        setContentView(FrameLayout(this).apply {
            setBackgroundColor(Color.WHITE)
            addView(column, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ))
        })
        // 到此为止：没有任何代码会把加载态结束掉。
    }
}
