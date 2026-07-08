import type { DeliveryStage } from '@/lib/orders'
import { getStageIndex } from '@/lib/orders'

export type DeliveryMilestoneState = 'pending' | 'active' | 'complete'

export interface DeliveryMilestone {
  label: string
  state: DeliveryMilestoneState
}

const MILESTONE_LABELS = ['Confirmed', 'Packed', 'On the way'] as const

const MILESTONE_STAGE_THRESHOLDS: DeliveryStage[] = ['Confirmed', 'Packed', 'Shipped']

export function resolveConfirmationStage(
  stage: DeliveryStage,
  orderStatus?: string,
): DeliveryStage {
  const normalized = orderStatus?.trim().toUpperCase() ?? ''
  if (stage === 'Pending' && (normalized === 'PENDING' || normalized === 'CONFIRMED' || !normalized)) {
    return 'Confirmed'
  }
  return stage
}

export function resolveDeliveryMilestones(stage: DeliveryStage): DeliveryMilestone[] {
  const stageIndex = getStageIndex(stage)

  return MILESTONE_LABELS.map((label, index) => {
    const threshold = getStageIndex(MILESTONE_STAGE_THRESHOLDS[index] ?? 'Confirmed')
    let state: DeliveryMilestoneState = 'pending'
    if (stageIndex > threshold) state = 'complete'
    else if (stageIndex >= threshold) state = 'active'
    return { label, state }
  })
}

export function deliveryProgressPercent(stage: DeliveryStage): number {
  const idx = getStageIndex(stage)
  const confirmed = getStageIndex('Confirmed')
  const packed = getStageIndex('Packed')

  if (idx <= confirmed) return 33
  if (idx <= packed) return 66
  if (idx < getStageIndex('Delivered')) return 100
  return 100
}

export function deliveryStatusCaption(stage: DeliveryStage): string {
  if (stage === 'Delivered') return 'Delivered'
  if (stage === 'In Transit' || stage === 'Shipped') return 'On the way'
  if (stage === 'Packed') return 'Being packed'
  if (stage === 'Confirmed') return 'Order confirmed'
  return 'Processing'
}
