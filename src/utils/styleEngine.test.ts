import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateEntryStyle,
  getGrowthStage,
  calculateStreak,
  estimateReadingTimeMinutes,
} from './styleEngine';
import {
  isPointInsideBrain,
  clampToBrainSilhouette,
  computeNodePositionForEntry,
} from './brainGeometry';

test('Style Engine never repeats template or close hue in last 8 entries', () => {
  const recent = [];
  for (let i = 0; i < 12; i++) {
    const style = generateEntryStyle(`entry-${i}`, i, recent);
    const recent8 = recent.slice(0, 8);
    for (const prev of recent8) {
      assert.notEqual(style.template, prev.template, `Template repeated at index ${i}`);
      const hueDiff = Math.abs(style.hue - prev.hue);
      const circularDiff = Math.min(hueDiff, 360 - hueDiff);
      assert.ok(circularDiff >= 18, `Hue too close (${circularDiff} deg) at index ${i}`);
    }
    recent.unshift(style);
  }
});

test('Growth Stage milestones progress accurately from Seed to Forest', () => {
  assert.equal(getGrowthStage(0).stageIndex, 0);
  assert.equal(getGrowthStage(9).stageIndex, 0);
  assert.equal(getGrowthStage(10).stageIndex, 1);
  assert.equal(getGrowthStage(50).stageIndex, 2);
  assert.equal(getGrowthStage(100).stageIndex, 3);
  assert.equal(getGrowthStage(500).stageIndex, 4);
});

test('Streak calculator counts consecutive days accurately', () => {
  const dates = ['2026-11-10', '2026-11-09', '2026-11-08', '2026-11-05'];
  assert.equal(calculateStreak(dates, '2026-11-10'), 3);
  assert.equal(calculateStreak(dates, '2026-11-11'), 3); // yesterday still keeps streak alive
  assert.equal(calculateStreak(dates, '2026-11-15'), 0);
});

test('Brain silhouette geometry constrains nodes inside hemispheres', () => {
  assert.equal(isPointInsideBrain(-0.34, 0.0), true);
  assert.equal(isPointInsideBrain(0.34, 0.0), true);
  assert.equal(isPointInsideBrain(2.5, 2.5), false);

  const clamped = clampToBrainSilhouette(2.0, 1.5);
  assert.equal(isPointInsideBrain(clamped.nx, clamped.ny), true);

  const pos = computeNodePositionForEntry('e-1', 'g-1', 5, 0, 4, 12345);
  assert.ok(Number.isFinite(pos.brainX) && Number.isFinite(pos.brainY));
  assert.ok(Number.isFinite(pos.treeX) && Number.isFinite(pos.treeY));
});

import {
  encodePayloadToTransferCode,
  decodeTransferCodeToPayload,
} from './transferCode';

test('Reading time estimator returns at least 1 minute', () => {
  assert.equal(estimateReadingTimeMinutes('بسم الله الرحمن الرحيم'), 1);
});

test('Transfer Code (PC <-> Android) roundtrip preserves Arabic entries and highlights accurately', async () => {
  const samplePayload = JSON.stringify({
    version: 1,
    groups: [{ id: 'g1', name: 'علوم القرآن والبيان' }],
    entries: [
      {
        id: 'e1',
        title: 'إعجاز الإيجاز في البيان القرآني',
        contentHtml: '<p>إن في <mark data-color="#FACC15">القرآن الكريم</mark> دقة عجيبة.</p>',
      },
    ],
  });

  const code = await encodePayloadToTransferCode(samplePayload);
  assert.ok(code.startsWith('KG1-') || code.startsWith('KG0-'));

  const restoredJson = await decodeTransferCodeToPayload(code);
  assert.equal(restoredJson, samplePayload);
});

