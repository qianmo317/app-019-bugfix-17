// 其余榫卯类型：搭接（lap）、圆木榫/饼干榫定位孔（dowel）、拼板（panel-glue）
import { round01 } from './format'

// —— 搭接 / 企口 ——
export interface LapInput {
  thickness: number  // 板厚（两板同厚）
  width: number      // 配合板宽（决定搭接长度）
  kerf: number
  fitDeltaMm: number // 配合让刀（查配合余量表：紧=正，松=负）
}
export interface LapResult {
  depthEach: number // 每块切深 = (料厚 − 让刀)/2
  lapLength: number // 搭接长度 = 配合板宽
  remaining: number // 半搭后每块剩余料厚 = 料厚 − 切深
  warnings: string[]
}

/** 半搭后每块至少保留的料厚 mm（再薄槽底易劈裂） */
export const LAP_MIN_REMAIN = 6

export function computeLap(input: LapInput): LapResult {
  const { thickness, fitDeltaMm } = input
  const warnings: string[] = []
  // 两块切深之和 = 料厚 − 让刀：紧配（让刀>0）少切留过盈，松配（让刀<0）多切留胶层
  const depthEach = round01((thickness - fitDeltaMm) / 2)
  const remaining = round01(thickness - depthEach)
  if (remaining < LAP_MIN_REMAIN) {
    warnings.push(
      `半搭后每块仅剩 ${remaining}mm，低于 ${LAP_MIN_REMAIN}mm 安全余量，槽底易劈裂；建议加厚木料或改用其他榫卯`,
    )
  }
  if (fitDeltaMm > 0) {
    warnings.push('紧配合：两块切深之和已留过盈量，装配需轻敲就位，必要时刮修槽底')
  }
  if (fitDeltaMm < 0) {
    warnings.push('松配合：切深已加深，为胶层留出余量')
  }
  void input.kerf
  return { depthEach, lapLength: round01(input.width), remaining, warnings }
}

// —— 圆木榫 / 饼干榫定位孔 ——
export interface DowelInput {
  width: number       // 板宽（沿拼缝方向）
  thickness: number   // 板厚
  kerf: number
}
export interface DowelResult {
  dowelDia: number    // 木榫直径
  dowelLength: number // 木榫长度
  holeDepth: number   // 单板孔深
  count: number       // 孔数
  positions: number[] // 孔位（距左端）
  edgeMargin: number  // 端部边距
  warnings: string[]
}
export function computeDowel(input: DowelInput): DowelResult {
  const { width, thickness } = input
  const warnings: string[] = []
  const dowelDia = thickness >= 24 ? 10 : 8
  const dowelLength = dowelDia * 5
  const holeDepth = round01(dowelLength / 2 + 1) // +1mm 排胶排气
  const count = Math.max(2, Math.min(8, Math.ceil(width / 100) + 1))
  const edgeMargin = round01(width / (2 * count))
  const positions: number[] = []
  for (let k = 0; k < count; k++) {
    positions.push(round01((width * (k + 0.5)) / count))
  }
  if (thickness < 12) {
    warnings.push('板厚不足 12mm，圆木榫易穿透板面，建议改用饼干榫或拼板槽')
  }
  void input.kerf
  return { dowelDia, dowelLength, holeDepth, count, positions, edgeMargin, warnings }
}

// —— 拼板（饼干榫/槽） ——
export interface PanelInput {
  width: number     // 单块板宽（拼缝方向长度）
  thickness: number // 板厚
  kerf: number
}
export interface PanelResult {
  biscuitSize: number   // 饼干榫号（0/10/20）
  slotDepth: number     // 槽深
  count: number
  positions: number[]   // 饼干榫位置（距左端）
  edgeMargin: number
  grooveWidth: number   // 备选槽榫方案
  grooveDepth: number
  warnings: string[]
}
export function computePanel(input: PanelInput): PanelResult {
  const { width, thickness } = input
  const warnings: string[] = []
  const biscuitSize = thickness >= 20 ? 20 : thickness >= 14 ? 10 : 0
  const slotDepth = round01(biscuitSize === 20 ? 12 : biscuitSize === 10 ? 9 : 6.5)
  const count = Math.max(2, Math.min(8, Math.ceil(width / 150) + 1))
  const edgeMargin = round01(width / (2 * count))
  const positions: number[] = []
  for (let k = 0; k < count; k++) {
    positions.push(round01((width * (k + 0.5)) / count))
  }
  if (width > 600) {
    warnings.push('板宽超过 600mm，建议增加饼干榫数量（每 150mm 一颗）')
  }
  void input.kerf
  return {
    biscuitSize,
    slotDepth,
    count,
    positions,
    edgeMargin,
    grooveWidth: 6,
    grooveDepth: round01(thickness / 3),
    warnings,
  }
}
