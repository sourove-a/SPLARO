import { request } from 'http'

export async function sendToNetworkPrinter(host: string, port: number, data: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = request(
      {
        host,
        port,
        method: 'POST',
        path: '/',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length,
        },
        timeout: 5000,
      },
      (res) => {
        res.on('data', () => undefined)
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Printer HTTP ${res.statusCode}`))
            return
          }
          resolve()
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Network printer timeout ${host}:${port}`))
    })
    req.write(data)
    req.end()
  })
}
