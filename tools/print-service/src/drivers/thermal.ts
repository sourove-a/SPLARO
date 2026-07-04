import ThermalPrinter from 'node-thermal-printer'
import { PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer'

export interface ThermalOrderItem {
  productName: string
  quantity: number
  price: number | string
  variantName?: string | null
}

export interface ThermalOrder {
  invoiceNumber: string
  createdAt: Date | string
  subtotal: number | string
  deliveryCharge: number | string
  discount: number | string
  total: number | string
  paymentMethod: string
  isInsideDhaka: boolean
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  shippingCity: string
  shippingDistrict: string
  shippingDivision?: string
  items: ThermalOrderItem[]
}

interface ThermalConfig {
  host: string
  port: number
  type?: 'EPSON' | 'STAR' | 'CUSTOM'
  characterSet?: string
}

function printerType(type?: ThermalConfig['type']) {
  if (type === 'STAR') return PrinterTypes.STAR
  if (type === 'CUSTOM') return PrinterTypes.EPSON
  return PrinterTypes.EPSON
}

export async function printThermalReceipt(
  order: ThermalOrder,
  config: ThermalConfig,
): Promise<void> {
  const printer = new ThermalPrinter.printer({
    type: printerType(config.type),
    interface: `tcp://${config.host}:${config.port}`,
    characterSet: CharacterSet.PC437_USA,
    breakLine: BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter: '─',
  })

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) throw new Error(`Thermal printer not reachable at ${config.host}:${config.port}`)

  printer.alignCenter()
  printer.setTextSize(1, 1)
  printer.bold(true)
  printer.println('SPLARO')
  printer.bold(false)
  printer.setTextNormal()
  printer.println("Luxury Women's Fashion")
  printer.drawLine()

  printer.alignLeft()
  printer.println(`Invoice: ${order.invoiceNumber}`)
  printer.println(`Date: ${new Date(order.createdAt).toLocaleDateString('en-BD')}`)
  printer.drawLine()

  printer.println('ITEMS:')
  printer.newLine()

  for (const item of order.items) {
    printer.leftRight(
      item.productName.slice(0, 22),
      `${item.quantity}x ${Number(item.price).toLocaleString()}`,
    )
    if (item.variantName) {
      printer.println(`  ${item.variantName}`)
    }
  }

  printer.drawLine()
  printer.leftRight('Subtotal:', `BDT ${Number(order.subtotal).toLocaleString()}`)
  printer.leftRight('Delivery:', `BDT ${Number(order.deliveryCharge).toLocaleString()}`)

  if (Number(order.discount) > 0) {
    printer.leftRight('Discount:', `-${Number(order.discount).toLocaleString()}`)
  }

  printer.bold(true)
  printer.leftRight('TOTAL:', `BDT ${Number(order.total).toLocaleString()}`)
  printer.bold(false)

  printer.drawLine()
  printer.println(`Payment: ${order.paymentMethod.replace(/_/g, ' ')}`)
  printer.println(`Zone: ${order.isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka'}`)
  printer.drawLine()

  printer.println('Ship To:')
  printer.println(order.shippingName)
  printer.println(order.shippingPhone)
  printer.println(order.shippingAddress.slice(0, 32))
  printer.println(`${order.shippingCity}, ${order.shippingDistrict}`)

  printer.drawLine()
  printer.alignCenter()
  printer.println('Thank you for choosing SPLARO')
  printer.println('splaro.co')
  printer.newLine()

  printer.cut()
  await printer.execute()
  printer.clear()
}

export async function printShippingLabel(
  order: ThermalOrder,
  consignmentId: string,
  config: ThermalConfig,
): Promise<void> {
  const printer = new ThermalPrinter.printer({
    type: printerType(config.type),
    interface: `tcp://${config.host}:${config.port}`,
    characterSet: CharacterSet.PC437_USA,
    breakLine: BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter: '─',
  })

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) throw new Error(`Thermal printer not reachable at ${config.host}:${config.port}`)

  printer.alignCenter()
  printer.setTextSize(1, 1)
  printer.bold(true)
  printer.println('SHIPPING LABEL')
  printer.bold(false)
  printer.setTextNormal()
  printer.drawLine()

  printer.alignLeft()
  printer.bold(true)
  printer.println('TO:')
  printer.bold(false)
  printer.setTextSize(1, 1)
  printer.println(order.shippingName)
  printer.setTextNormal()
  printer.println(order.shippingPhone)
  printer.println(order.shippingAddress)
  printer.println(`${order.shippingCity}, ${order.shippingDistrict}`)
  if (order.shippingDivision) printer.println(order.shippingDivision)

  printer.drawLine()
  printer.println(`Order: ${order.invoiceNumber}`)
  printer.println(`Consignment: ${consignmentId}`)
  printer.println(`COD: BDT ${Number(order.total).toLocaleString()}`)
  printer.drawLine()

  printer.alignCenter()
  printer.println('FROM: SPLARO')
  printer.println('Uttara Sector 13, Dhaka')
  printer.println('01905010205')
  printer.newLine()

  printer.cut()
  await printer.execute()
  printer.clear()
}
