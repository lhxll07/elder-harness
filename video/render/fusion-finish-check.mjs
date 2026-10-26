import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { sampleFusionFinish } from '../src/fusion-finish.js'
import { DURATION } from '../src/fusion-script.js'

const keys = ['horizontal', 'vertical', 'depth', 'roll', 'strength', 'collaboration', 'verification', 'memory']
const maxima = Object.fromEntries(keys.map(key => [key, 0]))
const steps = Object.fromEntries(keys.map(key => [key, 0]))
let previous = sampleFusionFinish(0)
for (let frame = 0; frame <= DURATION * 60; frame++) {
  const time = frame / 60
  const pose = sampleFusionFinish(time)
  for (const key of keys) {
    assert.ok(Number.isFinite(pose[key]), `${key} non-finite at ${time}`)
    maxima[key] = Math.max(maxima[key], Math.abs(pose[key]))
    steps[key] = Math.max(steps[key], Math.abs(pose[key] - previous[key]))
  }
  assert.deepEqual(sampleFusionFinish(time), pose)
  previous = pose
}
assert.ok(maxima.horizontal < 0.002)
assert.ok(maxima.vertical < 0.0012)
assert.ok(maxima.roll * 180 / Math.PI < 0.04)
assert.ok(steps.horizontal * 1080 < 0.035)
assert.ok(steps.vertical * 1080 < 0.025)
assert.ok(steps.roll * 180 / Math.PI < 0.0007)
for (const time of [78, 105, 120, 130, 154, 164, 184]) assert.ok(sampleFusionFinish(time).strength <= 0.46)
for (const time of [0, 194.2, 195, 196]) {
  for (const key of ['horizontal', 'vertical', 'depth', 'roll']) assert.equal(Math.abs(sampleFusionFinish(time)[key]), 0)
}
const report = { passed: true, framesChecked: DURATION * 60 + 1, maxima, maximumFrameSteps: steps, finalHoldStillFrom: 194.2 }
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
