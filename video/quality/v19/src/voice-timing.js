const BEATS = [
  { story: 0, playback: 0 },
  { story: 0.9, playback: 3.2 },
  { story: 3.4, playback: 5.7 },
  { story: 17.25, playback: 18.3 },
  { story: 21.1, playback: 21.65 },
  { story: 22.6, playback: 22.6 },
  { story: 28, playback: 28 },
]

function remap(time, from, to) {
  const first = BEATS[0]
  if (time <= first[from]) return first[to] + time - first[from]
  for (let index = 1; index < BEATS.length; index++) {
    const previous = BEATS[index - 1]
    const next = BEATS[index]
    if (time <= next[from]) {
      const progress = (time - previous[from]) / (next[from] - previous[from])
      return previous[to] + progress * (next[to] - previous[to])
    }
  }
  const last = BEATS[BEATS.length - 1]
  return last[to] + time - last[from]
}

export function voicePlaybackTime(story) {
  return remap(story, 'story', 'playback')
}

export function voiceStoryTime(playback) {
  return remap(playback, 'playback', 'story')
}

export function pauseClock(time, stop, duration = 1.2) {
  const start = stop - duration / 2
  if (time <= start) return time
  if (time >= start + duration) return stop
  const progress = (time - start) / duration
  return start + duration * (progress - progress ** 3 + progress ** 4 / 2)
}
