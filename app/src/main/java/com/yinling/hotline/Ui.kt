package com.yinling.hotline

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Icon
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * One place for how the elder-facing screens look.
 *
 * Written down because the alternative is what we had: every call site choosing its own colour and
 * font size, so five features later nothing matches and every new screen is another guess. The
 * numbers here are chosen for one reader — someone who may not see well and may not be able to type
 * — not for a design portfolio.
 *
 * Sizes are in `sp` on purpose: they follow the system font scale, which is the setting the elder
 * (or their family) already knows how to change.
 */
object Elder {

    // --- colour: one green, one ink, and three tones that mean something
    val brand = Color(0xFF1A7F6B)
    val brandDeep = Color(0xFF12604F)
    val ink = Color(0xFF17202A)
    val inkSoft = Color(0xFF5D6D7E)
    val surface = Color(0xFFF6F7F8)
    val card = Color(0xFFFFFFFF)
    val line = Color(0xFFDDE3E6)

    /** Needs the person's attention, but nothing is wrong. */
    val attention = Color(0xFFC46A14)

    /** Something is wrong, or the app cannot do its job. */
    val problem = Color(0xFFC0392B)

    /** Done, or working normally. */
    val good = Color(0xFF1E8449)

    // --- spacing
    val screenPadding = 22.dp
    val gap = 16.dp
    val gapSmall = 10.dp
    val radius = 16.dp

    // --- type
    val title: TextUnit = 30.sp
    val status: TextUnit = 26.sp
    val heading: TextUnit = 22.sp
    val body: TextUnit = 21.sp
    val action: TextUnit = 22.sp
    val hint: TextUnit = 16.sp

    // --- touch targets: an unsteady hand needs more than the usual 48dp
    val primaryHeight = 76.dp
    val secondaryHeight = 62.dp

    /** The voice circle: large enough to hit without looking, small enough to leave room for text. */
    val voiceCircle = 200.dp
    val voiceIcon = 56.dp
}

/** A large filled button; the one thing we want pressed on this screen. */
@Composable
fun ElderPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(Elder.primaryHeight),
        shape = RoundedCornerShape(Elder.radius),
        colors = ButtonDefaults.buttonColors(
            containerColor = Elder.brand,
            contentColor = Color.White,
        ),
    ) { Text(text, fontSize = Elder.action, fontWeight = FontWeight.SemiBold) }
}

/** A large outlined button for the alternatives, kept visually quieter than the main action. */
@Composable
fun ElderSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(Elder.secondaryHeight),
        shape = RoundedCornerShape(Elder.radius),
    ) { Text(text, fontSize = Elder.body) }
}

/**
 * The state of the assistant, as one line with a coloured dot.
 *
 * This is the answer to "它在干什么?" — the question an elder actually has. It replaces a screen full
 * of status text that only made sense to whoever wrote it.
 */
@Composable
fun ElderStatusLine(text: String, tone: Color = Elder.good, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Elder.gapSmall),
    ) {
        Spacer(
            Modifier.size(16.dp).clip(CircleShape).background(tone),
        )
        Text(text, fontSize = Elder.status, fontWeight = FontWeight.SemiBold, color = Elder.ink)
    }
}

/** A white rounded card; everything the person reads sits in one of these. */
@Composable
fun ElderCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Elder.radius))
            .background(Elder.card)
            .padding(Elder.gap),
        verticalArrangement = Arrangement.spacedBy(Elder.gapSmall),
    ) { content() }
}

/** A quiet card for something merely informative, such as a warning that can wait. */
@Composable
fun ElderNotice(text: String, tone: Color = Elder.attention, action: (@Composable () -> Unit)? = null) {
    ElderCard {
        Text(text, fontSize = Elder.body, color = tone)
        action?.invoke()
    }
}

/** A label + value row used inside cards. */
@Composable
fun ElderKeyValue(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, fontSize = Elder.hint, color = Elder.inkSoft)
        Text(value, fontSize = Elder.body, color = Elder.ink)
    }
}


/**
 * The one control on the elder's screen: a big circle that talks when idle and stops when busy.
 *
 * Everything else was moved out of the way, because a screen with five options is a screen where
 * the person has to decide before they can ask for help. The circle's size is the affordance: an
 * unsteady hand cannot miss it, and it never moves.
 */
@Composable
fun ElderVoiceCircle(
    caption: String,
    hint: String,
    listening: Boolean,
    busy: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    /** Shown inside the circle: a microphone when speech works, a pen when it does not. */
    icon: ImageVector = Icons.Default.Mic,
) {
    val fill = when {
        busy -> Elder.inkSoft
        listening -> Elder.attention
        else -> Elder.brand
    }
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Elder.gap),
    ) {
        Box(
            modifier = Modifier
                .size(Elder.voiceCircle)
                .clip(CircleShape)
                .background(fill)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    imageVector = if (busy) Icons.Default.Close else icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(Elder.voiceIcon),
                )
                Text(
                    caption,
                    fontSize = Elder.body,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                )
            }
        }
        Text(hint, fontSize = Elder.hint, color = Elder.inkSoft)
    }
}

@Composable
fun ElderVerticalGap(height: androidx.compose.ui.unit.Dp = Elder.gap) {
    Spacer(Modifier.height(height).width(0.dp))
}

/**
 * What the assistant's state is called, in one place.
 *
 * The home screen and the floating panel are drawn with different toolkits (Compose and plain
 * Views), and they used to describe the same state with different words and different colours. The
 * person sees both, sometimes at once; the wording belongs to the product, not to a toolkit.
 */
fun statusText(phase: TaskPhase): String = when (phase) {
    TaskPhase.WORKING -> "我正在办，点一下可暂停"
    TaskPhase.CONFIRMING -> "等您点一下确认"
    TaskPhase.ASKING -> "等您回答一句"
    TaskPhase.NEEDS_PERSON -> "这一步要您自己做"
    TaskPhase.NEEDS_FAMILY -> "需要家人帮忙"
    TaskPhase.PAUSED -> "已暂停，您可继续或求助"
    TaskPhase.CANNOT -> "这件事我办不了"
    TaskPhase.COMPLETED -> "办好了"
    TaskPhase.IDLE -> "我在"
}

/** The colour that goes with [statusText]: green means fine, orange means it wants you, red means no. */
fun statusTone(phase: TaskPhase): Color = when (phase) {
    TaskPhase.CANNOT -> Elder.problem
    TaskPhase.COMPLETED, TaskPhase.IDLE, TaskPhase.WORKING -> Elder.good
    else -> Elder.attention
}
