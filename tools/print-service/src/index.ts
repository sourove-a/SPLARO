import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { PrintQueue, setPrintJobHandler, type PrintJob } from './print-queue.js'
import { discoverSubnet, probeHost } from './printer-discovery.js'
import { savePdf } from './drivers/pdf.js'
import { printThermalReceipt, printShippingLabel } from './drivers/thermal.js'

interface PrinterConfig {
  id: string
  name: string
  type: 'thermal' | 'network' | 'pdf'
  host?: string
  port?: number
      driver?: 'EPSON' | 'STAR' | 'CUSTOM'
  outputDir?: string
  enabled: boolean
}

interface PrintersFile {
  defaultPrinter: string
  printers: PrinterConfig[]
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = join(root, 'config', 'printers.json')

function loadConfig(): PrintersFile {
  if (!existsSync(configPath)) {
    throw new Error(`Missing printer config: ${configPath}`)
  }
  return JSON.parse(readFileSync(configPath, 'utf8')) as PrintersFile
}

function getPrinter(config: PrintersFile, id?: string): PrinterConfig {
  const printerId = id ?? config.defaultPrinter
  const printer = config.printers.find((p) => p.id === printerId && p.enabled)
  if (!printer) throw new Error(`Printer not found or disabled: ${printerId}`)
  return printer
}

const queue = new PrintQueue()

setPrintJobHandler(async (job: PrintJob) => {
  const config = loadConfig()
  const printer = getPrinter(config, job.printerId)

  if (printer.type === 'pdf') {
    if (!job.html) throw new Error('PDF job requires html payload')
    const dir = printer.outputDir ?? join(root, 'output', 'pdf')
    await savePdf(job.html, dir, `${job.type}-${job.orderId}.html`)
    return
  }

  if (printer.type === 'thermal') {
    throw new Error(
      'Thermal print requires order payload via API database. Use POST /print/thermal with full order body.',
    )
  }
})

async function main() {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'splaro-print-service' })
  })

  app.get('/printers', (_req, res) => {
    res.json(loadConfig())
  })

  app.get('/queue', (_req, res) => {
    res.json({ jobs: queue.list() })
  })

  app.post('/discover', async (req, res) => {
    const baseIp = (req.body?.baseIp as string) ?? '192.168.0.1'
    const found = await discoverSubnet(baseIp)
    res.json({ found })
  })

  app.post('/probe', async (req, res) => {
    const host = req.body?.host as string
    const port = Number(req.body?.port ?? 9100)
    if (!host) return res.status(400).json({ error: 'host required' })
    const result = await probeHost(host, [port])
    res.json({ result })
  })

  app.post('/print/html', (req, res) => {
    const { html, type = 'invoice-pdf', orderId = 'manual', printerId } = req.body ?? {}
    if (!html) return res.status(400).json({ error: 'html required' })
    const job = queue.enqueue({ type, printerId: printerId ?? loadConfig().defaultPrinter, orderId, html })
    res.json({ job })
  })

  app.post('/print/thermal', async (req, res) => {
    const { order, consignmentId, kind = 'receipt', printerId } = req.body ?? {}
    if (!order) return res.status(400).json({ error: 'order required' })

    const config = loadConfig()
    const printer = getPrinter(config, printerId)
    if (printer.type !== 'thermal' || !printer.host || !printer.port) {
      return res.status(400).json({ error: 'Configured printer is not thermal' })
    }

    const thermalConfig = {
      host: printer.host,
      port: printer.port,
      type: printer.driver,
    }

    try {
      if (kind === 'label') {
        await printShippingLabel(order, consignmentId ?? 'N/A', thermalConfig)
      } else {
        await printThermalReceipt(order, thermalConfig)
      }
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  const port = Number(process.env.PRINT_SERVICE_PORT ?? 9101)
  app.listen(port, () => {
    console.log(`SPLARO print service listening on http://localhost:${port}`)
    console.log(`Config: ${configPath}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
