// The camera's single continuous path through all 252 seconds.
//
// There are no cuts in this film. Chapters are regions of one space, and the
// camera travels between them — so the path is authored here, in one place,
// where its continuity can actually be checked. A chapter that needed its own
// camera would reintroduce the cut the film is built to avoid.
//
// Convention: the phone lives at the origin, screen facing +Z. Distance from
// origin is therefore distance from the subject, and the numbers below read as
// "how close are we".

import { EASE } from './ease.js'
import { VOICE_EXTRA_SECONDS, sharedTimelineTime } from './timeline.js'

/** The subject. All framing is expressed relative to this. */
export const FOCUS = [0, 0, 0]

// Close: 2.6 (the screen fills the frame). Mid: 4.4 (the whole phone).
// Wide: 7.5 (the phone plus its surroundings). Far: 14 (a room).
const NEAR = 2.55
const MID = 4.35
const WIDE = 7.4
const FAR = 13.5

export function buildCameraPath(rig) {
  rig
    // ── 序幕 · 困局 ───────────────────────────────────────────────────────
    .at(0.0, [0.0, 0.10, 6.4], [0, 0, 0], { fov: 34 })
    .at(2.8, [0.0, 0.10, 6.4], [0, 0, 0], { fov: 34 })
    .at(5.8, [1.1, 0.24, 6.4], [0, 0, -1.25], { fov: 35 })
    .at(8.2, [3.4, 0.35, 5.9], [0, 0, -2.2], { fov: 35 })
    .at(9.1, [3.4, 0.35, 5.9], [0, 0, -2.2], { fov: 35 })
    .at(10.7, [3.4, 0.35, 5.9], [0, 0, -2.2], { fov: 35 })
    .at(11.85, [0.0, 0.08, MID - 0.25], [0, 0, 0], { fov: 34 })
    .at(15.5, [0.0, 0.05, MID - 0.25], [0, 0, 0], { fov: 34 })

    // ── 说得出口 ──────────────────────────────────────────────────────────
    // Settles, then pushes in past mid to the button. Holds close for the
    // interruption beat — the collapse of the waveform is the shot, so the
    // camera must not move during it.
    .at(16.0, [0.0, 0.05, MID - 0.25], [0, 0, 0], { fov: 34 })
    .at(18.2, [0.0, 0.05, 4.5], [0, 0, 0], { fov: 34 })
    .at(23.5, [0.0, 0.08, 4.9], [0, 0, 0], { fov: 34 })
    .at(30.8, [0.0, 0.08, 4.9], [0, 0, 0], { fov: 34 })
    .at(33.0, [0.0, 0.08, 4.9], [0, 0, 0], { fov: 34 })
    .at(36.5, [0.12, 0.08, 4.55], [0, 0, 0], { fov: 34 })
    .at(39.5, [0.0, 0.10, MID], [0, 0, 0], { fov: 34 })

    // ── 看得见页面 ────────────────────────────────────────────────────────
    // Swings around to the phone's side so the tree structure, which is drawn
    // in depth, can be seen rather than read edge-on.
    .at(43.0, [1.55, 0.55, MID - 0.35], [0, 0, 0], { fov: 36 })
    .at(48.0, [2.25, 0.30, MID - 1.5], [0, 0.05, 0], { fov: 35 })
    .at(53.0, [1.30, -0.25, MID - 1.15], [0, -0.02, 0], { fov: 35 })
    .at(58.0, [0.35, 0.35, MID + 0.6], [0, 0, 0], { fov: 34, roll: -0.4 })
    .at(61.5, [0.0, 0.55, WIDE - 0.6], [0, 0, 0], { fov: 34 })

    // ── 办得成事 ──────────────────────────────────────────────────────────
    // Rises to a high three-quarter so the loop's circular geometry reads as a
    // circle instead of a line.
    .at(64.5, [-1.35, 1.75, MID + 0.9], [0, 0.05, 0], { fov: 37 })
    .at(71.0, [-0.35, 2.35, MID + 0.25], [0, 0, 0], { fov: 38 })
    .at(78.0, [1.20, 1.55, MID - 0.15], [0, 0, 0], { fov: 37 })
    .at(84.0, [0.55, 0.75, MID - 0.45], [0, 0.05, 0], { fov: 36, roll: 0.3 })
    .at(86.0, [0.0, 0.30, MID - 0.85], [0, 0, 0], { fov: 35 })

    // ── 办成有证据 ★ ──────────────────────────────────────────────────────
    // The most static chapter in the film, deliberately. The viewer is reading
    // a claim, then watching it fail three checks. Movement here would be noise.
    .at(89.0, [0.0, 0.10, NEAR + 0.45], [0, 0.08, 0], { fov: 33 })
    .at(96.0, [0.0, 0.06, NEAR + 0.30], [0, 0.10, 0], { fov: 32 })
    .at(103.5, [0.0, 0.02, NEAR + 0.18], [0, 0.06, 0], { fov: 31 })
    .at(111.5, [0.0, 0.02, NEAR + 0.10], [0, 0.04, 0], { fov: 31 })
    .at(118.0, [0.0, -0.02, NEAR + 0.34], [0, 0, 0], { fov: 33 })
    .at(123.5, [0.0, 0.16, MID - 0.55], [0, 0.02, 0], { fov: 34 })

    // ── 帮忙有分寸 ★ ──────────────────────────────────────────────────────
    // A long lateral truck across the three tiers. The camera moves; the ladder
    // does not. That is what makes it read as a scale rather than a diagram.
    .at(127.0, [-2.65, 0.35, MID - 0.1], [0, 0, 0], { fov: 36 })
    .at(134.0, [-0.95, 0.20, MID - 0.75], [0, -0.05, 0], { fov: 35 })
    .at(142.0, [0.75, 0.15, MID - 0.80], [0, -0.05, 0], { fov: 35 })
    .at(150.0, [2.15, 0.25, MID - 0.45], [0, -0.02, 0], { fov: 36 })
    .at(156.0, [1.05, 0.55, MID + 0.35], [0, 0, 0], { fov: 35, roll: -0.3 })
    .at(159.5, [0.0, 0.30, MID - 0.3], [0, 0, 0], { fov: 34 })

    // ── 交还本人 ──────────────────────────────────────────────────────────
    // Comes back over the shoulder, close to the screen, for the payment beat.
    // The camera's own stillness across 166–178 is the film's argument.
    .at(163.0, [-0.85, 0.30, MID - 1.0], [0, -0.05, 0], { fov: 34 })
    .at(168.0, [-0.30, 0.02, NEAR + 0.20], [0, -0.16, 0], { fov: 32 })
    .at(175.5, [0.0, -0.05, NEAR + 0.34], [0, -0.18, 0], { fov: 32 })
    .at(179.5, [0.10, 0.35, MID - 0.35], [0, 0, 0], { fov: 34 })

    // ── 可信的人 ──────────────────────────────────────────────────────────
    // Pulls back and up. The guard circle lives in the space around the phone,
    // so the camera has to leave the phone to see it.
    .at(183.0, [0.0, 0.95, WIDE + 0.5], [0, 0.15, 0], { fov: 36 })
    .at(190.0, [0.0, 1.75, FAR - 1.2], [0, 0.25, 0], { fov: 36, roll: 0.4 })
    .at(197.0, [-1.10, 1.35, FAR - 2.0], [0, 0.15, 0], { fov: 35 })
    .at(202.5, [0.0, 1.05, WIDE + 1.1], [0, 0.10, 0], { fov: 35, roll: -0.3 })

    // ── 教一次就会 ────────────────────────────────────────────────────────
    // Comes down onto the desk plane, where the demonstration is being written.
    .at(206.0, [-1.30, 0.75, WIDE - 0.9], [0, -0.35, 0], { fov: 34 })
    .at(212.0, [-0.55, 0.95, MID + 0.55], [0, -0.40, 0], { fov: 35 })
    .at(218.5, [0.60, 0.85, MID + 0.25], [0, -0.30, 0], { fov: 35, roll: 0.35 })

    // ── 越用越稳 ──────────────────────────────────────────────────────────
    .at(222.0, [0.30, 0.65, MID + 0.05], [0, -0.10, 0], { fov: 35 })
    .at(228.0, [-0.55, 0.45, MID - 0.55], [0, -0.02, 0], { fov: 34 })
    .at(234.5, [0.45, 0.35, MID - 0.15], [0, 0, 0], { fov: 35, roll: -0.25 })

    // ── 尾声 ──────────────────────────────────────────────────────────────
    // One long, slow pull back to the establishing distance, ending in a hold.
    // The last 2.5 seconds are perfectly still.
    .at(236.5, [0.15, 0.30, MID + 0.9], [0, 0, 0], { fov: 34 })
    .at(241.0, [0.0, 0.55, WIDE + 1.2], [0, 0, 0], { fov: 33, ease: EASE.drift })
    .at(245.0, [0.0, 0.70, WIDE + 2.6], [0, 0.05, 0], { fov: 32, ease: EASE.exit })
    .at(248.0, [0.0, 0.78, WIDE + 3.1], [0, 0.05, 0], { fov: 32, ease: EASE.entry })
  for (const key of rig.keys) {
    if (key.t >= 40) key.t += VOICE_EXTRA_SECONDS
  }
  const sample = rig.sample.bind(rig)
  rig.sample = (time) => sample(sharedTimelineTime(time))
}
