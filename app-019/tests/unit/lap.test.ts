// 企口/搭接（半搭）：配合让刀、搭接长度、薄料警告 + 三视图与计算结果同源
import { describe, it, expect, beforeEach } from 'vitest'
import { computeLap } from '../../src/lib/joints'
import { computeJoint } from '../../src/lib/calc'
import { buildViews } from '../../src/geometry/views'
import type { Fit, Joint } from '../../src/types'

beforeEach(() => {
  localStorage.clear()
})

function makeLapJoint(fit: Fit, thickness = 18, widthA = 200, widthB = 60): Joint {
  return {
    kind: 'lap',
    params: {
      boardA: { thickness, width: widthA },
      boardB: { thickness, width: widthB },
      wood: 'hardwood',
      fit,
      kerfMm: 1.1,
    },
    notes: [],
  }
}

describe('半搭计算：配合让刀与搭接长度', () => {
  it('标准配合：每块切深 = 料厚/2；搭接长 = 配合板（件 B）板宽，不跟板厚走', () => {
    const r = computeJoint(makeLapJoint('standard')).lap!
    expect(r.depthEach).toBeCloseTo(9, 6)
    expect(r.lapLength).toBe(60)
  })

  it('紧配少切、松配多切；两块切深之和 = 料厚 − 2×让刀', () => {
    const tight = computeJoint(makeLapJoint('tight')).lap!
    const standard = computeJoint(makeLapJoint('standard')).lap!
    const loose = computeJoint(makeLapJoint('loose')).lap!
    // 硬木默认表：紧 +0.2 / 标准 0 / 松 −0.3
    expect(tight.depthEach).toBeCloseTo(9 - 0.2, 6)
    expect(standard.depthEach).toBeCloseTo(9, 6)
    expect(loose.depthEach).toBeCloseTo(9 + 0.3, 6)
    expect(tight.depthEach).toBeLessThan(standard.depthEach)
    expect(loose.depthEach).toBeGreaterThan(standard.depthEach)
    // 两块切深之和与料厚、让刀相合
    expect(2 * tight.depthEach).toBeCloseTo(18 - 2 * 0.2, 6)
    expect(2 * standard.depthEach).toBeCloseTo(18, 6)
    expect(2 * loose.depthEach).toBeCloseTo(18 + 2 * 0.3, 6)
  })

  it('computeLap 直接调用：fitDeltaMm 生效，搭接长取入参板宽', () => {
    const r = computeLap({ thickness: 20, width: 80, kerf: 1.1 }, 'tight', 0.2)
    expect(r.depthEach).toBeCloseTo(10 - 0.2, 6)
    expect(r.lapLength).toBe(80)
  })

  it('薄料警告：半搭后余料不足 3mm 时提醒；正常料不警告', () => {
    const thin = computeJoint(makeLapJoint('standard', 5)).lap!
    expect(thin.warnings.some((w) => w.includes('余料'))).toBe(true)
    const ok = computeJoint(makeLapJoint('standard', 18)).lap!
    expect(ok.warnings).toHaveLength(0)
  })
})

describe('半搭三视图：与计算结果同源', () => {
  it('正视图台阶：横线在切深处，台阶右端竖线在搭接长处', () => {
    const joint = makeLapJoint('standard')
    const views = buildViews(joint, computeJoint(joint))
    const front = views.find((v) => v.id === 'front')!
    // 横线：y = 切深，自左端至搭接长
    expect(front.lines).toContainEqual({ x1: 0, y1: 9, x2: 60, y2: 9, cls: 'cut' })
    // 竖线：x = 搭接长，自切深至料厚底边
    expect(front.lines).toContainEqual({ x1: 60, y1: 9, x2: 60, y2: 18, cls: 'cut' })
  })

  it('紧/松配合下台阶横线跟着切深走（不再钉死在料厚一半）', () => {
    const tight = buildViews(makeLapJoint('tight'), computeJoint(makeLapJoint('tight')))
    const loose = buildViews(makeLapJoint('loose'), computeJoint(makeLapJoint('loose')))
    const stepY = (views: typeof tight) =>
      views.find((v) => v.id === 'front')!.lines.find((l) => l.y1 === l.y2 && l.x1 === 0 && l.x2 === 60)!.y1
    expect(stepY(tight)).toBeCloseTo(8.8, 6)
    expect(stepY(loose)).toBeCloseTo(9.3, 6)
  })

  it('侧视图：画出切深线，并标注切深与剩余料厚', () => {
    const joint = makeLapJoint('standard')
    const views = buildViews(joint, computeJoint(joint))
    const side = views.find((v) => v.id === 'side')!
    expect(side.lines.some((l) => l.x1 === 9 && l.x2 === 9 && l.y1 === 0 && l.y2 === 36)).toBe(true)
    const labels = side.dims.map((d) => d.label).join(' ')
    expect(labels).toContain('切深')
    expect(labels).toContain('剩余')
  })
})
