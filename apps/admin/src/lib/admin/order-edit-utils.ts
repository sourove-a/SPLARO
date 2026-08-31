export interface OrderEditPreviewLine {
  price: number
  quantity: number
}

export function orderEditSubtotal(lines: readonly OrderEditPreviewLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}

export function orderEditTotal(subtotal: number, delivery: number, discount: number): number {
  return Math.max(0, subtotal + delivery - Math.min(Math.max(0, discount), subtotal))
}
