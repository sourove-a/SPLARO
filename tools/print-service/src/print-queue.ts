export type PrintJobType = 'receipt' | 'label' | 'invoice-pdf'

export interface PrintJob {
  id: string
  type: PrintJobType
  printerId: string
  orderId: string
  consignmentId?: string
  html?: string
  createdAt: string
  status: 'queued' | 'printing' | 'done' | 'failed'
  error?: string
}

export class PrintQueue {
  private jobs: PrintJob[] = []
  private processing = false

  enqueue(job: Omit<PrintJob, 'id' | 'createdAt' | 'status'>): PrintJob {
    const entry: PrintJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      status: 'queued',
    }
    this.jobs.unshift(entry)
    void this.pump()
    return entry
  }

  list(limit = 50): PrintJob[] {
    return this.jobs.slice(0, limit)
  }

  get(id: string): PrintJob | undefined {
    return this.jobs.find((j) => j.id === id)
  }

  private async pump() {
    if (this.processing) return
    this.processing = true
    try {
      while (true) {
        const next = [...this.jobs].reverse().find((j) => j.status === 'queued')
        if (!next) break
        next.status = 'printing'
        try {
          await onProcessJob(next)
          next.status = 'done'
        } catch (err) {
          next.status = 'failed'
          next.error = err instanceof Error ? err.message : String(err)
        }
      }
    } finally {
      this.processing = false
    }
  }
}

let onProcessJob: (job: PrintJob) => Promise<void> = async () => undefined

export function setPrintJobHandler(handler: (job: PrintJob) => Promise<void>) {
  onProcessJob = handler
}
