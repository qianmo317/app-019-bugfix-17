// 企口/搭接（lap）：配合让刀、搭接长度、薄料警告、图纸与计算同源
import { describe, it, expect } from 'vitest'
import { computeLap, LAP_MIN_REMAIN } from '../../src/lib/joints'
import { computeJoint } from '../../src/lib/calc'
import { buildViews } from '../../src/geometry/views'
import { buildCutList } from '../../src/lib/cutlist'
import { DEFAULT_FIT_TABLE } from '../../src/lib/fit'
import { fmt01, fmtDrawing } from '../../src/lib/format'
import type { Fit, Joint } from '../../src/types'

function makeJoint(fit: Fit, tA = 18, wA = 200, wB = 150): Joint {
  return {
    kind: 'lap',
    params: {
      boardA: { thickness: tA, width: wA },
      boardB: { thickness: tA, width: wB },
      wood: 'hardwood',
      fit,
      kerfMm: 1.1,
    },
    notes: [],
  }
}

describe('企口/搭接：切深随配合松紧变化', () => {
  it('标准配合：每块切深 = 料厚/2，无警告', () => {
    const r = computeLap({ thickness: 18, width: 150, kerf: 1.1, fitDeltaMm: 0 })
    expect(r.depthEach).toBe(9)
    expect(r.remaining).toBe(9)
    expect(r.warnings).toEqual([])
  })

  it('紧配少切、松配多切（让刀查配合余量表）', () => {
    const d = DEFAULT_FIT_TABLE.hardwood
    const tight = computeLap({ thickness: 18, width: 150, kerf: 1.1, fitDeltaMm: d.tight })
    const standard = computeLap({ thickness: 18, width: 150, kerf: 1.1, fitDeltaMm: d.standard })
    const loose = computeLap({ thickness: 18, width: 150, kerf: 1.1, fitDeltaMm: d.loose })
    expect(tight.depthEach).toBeLessThan(standard.depthEach)
    expect(loose.depthEach).toBeGreaterThan(standard.depthEach)
  })

  it('两块切深之和 = 料厚 − 让刀（0.1mm 网格内闭合）', () => {
    const t = 18
    for (const fitDeltaMm of [0.3, 0.2, 0, -0.3, -0.4]) {
      const r = computeLap({ thickness: t, width: 150, kerf: 1.1, fitDeltaMm })
      // 闭合差 ≤ 1 格（0.1mm），与燕尾闭合同一判据
      const closureUnits = Math.round(Math.abs(2 * r.depthEach - (t - fitDeltaMm)) * 10)
      expect(closureUnits).toBeLessThanOrEqual(1)
      expect(r.remaining).toBe(round(t - r.depthEach))
    }
    function round(x: number) {
      return Math.round(x * 10) / 10
    }
  })

  it('computeJoint 走配合余量表：紧/松算出不同切深', () => {
    const tight = computeJoint(makeJoint('tight')).lap!
    const standard = computeJoint(makeJoint('standard')).lap!
    const loose = computeJoint(makeJoint('loose')).lap!
    expect(tight.depthEach).toBeLessThan(standard.depthEach)
    expect(loose.depthEach).toBeGreaterThan(standard.depthEach)
  })
})

describe('企口/搭接：搭接长度跟随配合板宽而非板厚', () => {
  it('lapLength = 件 B 板宽；改板厚不变，改配合板宽跟随', () => {
    expect(computeJoint(makeJoint('standard', 18, 200, 150)).lap!.lapLength).toBe(150)
    expect(computeJoint(makeJoint('standard', 30, 200, 150)).lap!.lapLength).toBe(150)
    expect(computeJoint(makeJoint('standard', 18, 200, 250)).lap!.lapLength).toBe(250)
  })
})

describe('企口/搭接：薄料警告', () => {
  it(`半搭后余料不足 ${LAP_MIN_REMAIN}mm 时警告`, () => {
    const r = computeLap({ thickness: 10, width: 150, kerf: 1.1, fitDeltaMm: 0 })
    expect(r.remaining).toBe(5)
    expect(r.warnings.some((w) => w.includes('仅剩'))).toBe(true)
  })

  it('余料充足不警告', () => {
    const r = computeLap({ thickness: 20, width: 150, kerf: 1.1, fitDeltaMm: 0 })
    expect(r.remaining).toBeGreaterThanOrEqual(LAP_MIN_REMAIN)
    expect(r.warnings).toEqual([])
  })
})

describe('企口/搭接：图纸与计算同源', () => {
  it('正视图台阶按计算切深绘制（不再钉死料厚一半），含台阶右端竖线', () => {
    const joint = makeJoint('loose', 18, 200, 150)
    const r = computeJoint(joint).lap!
    expect(r.depthEach).not.toBe(9) // 松配确实偏离料厚一半
    const front = buildViews(joint, { lap: r }).find((v) => v.id === 'front')!
    // 台阶底线：距顶面 = 余料，横跨 0..搭接长
    expect(
      front.lines.some((l) => l.y1 === r.remaining && l.y2 === r.remaining && l.x1 === 0 && l.x2 === r.lapLength),
    ).toBe(true)
    // 台阶右端竖线：x = 搭接长，从槽底到板底
    expect(
      front.lines.some((l) => l.x1 === r.lapLength && l.x2 === r.lapLength && l.y1 === r.remaining && l.y2 === 18),
    ).toBe(true)
    // 切深标注与计算一致（0.1mm 精度，让刀可见）
    expect(front.dims.some((d) => d.label === `切深 ${fmt01(r.depthEach)}`)).toBe(true)
    expect(front.dims.some((d) => d.label === `搭接长 ${fmtDrawing(r.lapLength)}`)).toBe(true)
  })

  it('侧视图画出槽底线并标注余料与切深', () => {
    const joint = makeJoint('tight', 18, 200, 150)
    const r = computeJoint(joint).lap!
    const side = buildViews(joint, { lap: r }).find((v) => v.id === 'side')!
    expect(side.lines.some((l) => l.x1 === r.remaining && l.x2 === r.remaining)).toBe(true)
    expect(side.dims.some((d) => d.label === `余料 ${fmt01(r.remaining)}`)).toBe(true)
    expect(side.dims.some((d) => d.label === `切深 ${fmt01(r.depthEach)}`)).toBe(true)
  })

  it('切割清单使用同一份计算结果', () => {
    const joint = makeJoint('tight', 18, 200, 150)
    const r = computeJoint(joint)
    const cut = buildCutList(joint, r.dovetail, r.tenon, r.lap)
    expect(cut.boardA[0].detail).toContain(fmtDrawing(r.lap!.lapLength))
    expect(cut.boardA[0].detail).toContain(fmt01(r.lap!.depthEach))
    expect(cut.boardA[2].detail).toContain(fmt01(r.lap!.remaining))
    expect(cut.boardB[0].detail).toContain(fmt01(r.lap!.depthEach))
  })
})
