import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { SCENOGRAPHY, SCENERY_TRANSITION, sampleFusionScenery } from '../src/fusion-scenery.js'
import { DURATION } from '../src/fusion-script.js'

assert.equal(SCENOGRAPHY[0].start, 0)
assert.equal(SCENOGRAPHY.at(-1).end, DURATION)
for (const [index, section] of SCENOGRAPHY.entries()) {
  assert.ok(section.end - section.start > SCENERY_TRANSITION)
  if (index) assert.equal(SCENOGRAPHY[index - 1].end, section.start)
  for (const key of ['deep', 'top', 'light', 'tint']) assert.ok(section[key].every(value => Number.isFinite(value) && value > 0))
  const middle = sampleFusionScenery((section.start + section.end) / 2)
  assert.equal(middle.weights[index], 1)
}
let maximumFrameStep = 0
let previous = sampleFusionScenery(0)
for (let frame = 0; frame <= DURATION * 60; frame++) {
  const time = frame / 60
  const pose = sampleFusionScenery(time)
  assert.deepEqual(sampleFusionScenery(time), pose)
  assert.ok(Math.abs(pose.weights.reduce((total, value) => total + value, 0) - 1) < 1e-12)
  assert.ok(pose.weights.every(value => value >= 0 && value <= 1))
  assert.ok(pose.weights.filter(value => value > 0).length <= 2)
  assert.ok([pose.compression, pose.reading, pose.distillation, pose.adoption].every(value => value >= 0 && value <= 1))
  pose.weights.forEach((value, index) => { maximumFrameStep = Math.max(maximumFrameStep, Math.abs(value - previous.weights[index])) })
  previous = pose
}
assert.ok(maximumFrameStep < 0.008)
for (const section of SCENOGRAPHY.slice(1)) {
  const before = sampleFusionScenery(section.start - 0.000001)
  const after = sampleFusionScenery(section.start + 0.000001)
  assert.ok(before.weights.every((value, index) => Math.abs(value - after.weights[index]) < 0.000001))
}
const report = { passed: true, framesChecked: DURATION * 60 + 1, chapterCount: SCENOGRAPHY.length, transitionSeconds: SCENERY_TRANSITION, maximumFrameStep, chapters: SCENOGRAPHY.map(({ name, title, start, end }) => ({ name, title, start, end })) }
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
