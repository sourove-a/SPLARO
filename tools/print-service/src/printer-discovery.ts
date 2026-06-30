import { createConnection } from 'net'

export interface DiscoveredPrinter {
  host: string
  port: number
  open: boolean
}

const COMMON_PORTS = [9100, 515, 631]

export async function probeHost(host: string, ports = COMMON_PORTS, timeoutMs = 800): Promise<DiscoveredPrinter[]> {
  const results: DiscoveredPrinter[] = []

  await Promise.all(
    ports.map(
      (port) =>
        new Promise<void>((resolve) => {
          const socket = createConnection({ host, port, timeout: timeoutMs })
          const done = (open: boolean) => {
            results.push({ host, port, open })
            socket.destroy()
            resolve()
          }
          socket.on('connect', () => done(true))
          socket.on('timeout', () => done(false))
          socket.on('error', () => done(false))
        }),
    ),
  )

  return results.filter((r) => r.open)
}

export async function discoverSubnet(baseIp: string): Promise<DiscoveredPrinter[]> {
  const prefix = baseIp.split('.').slice(0, 3).join('.')
  const hosts = Array.from({ length: 20 }, (_, i) => `${prefix}.${i + 1}`)
  const batches = await Promise.all(hosts.map((host) => probeHost(host, [9100])))
  return batches.flat()
}
