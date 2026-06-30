import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

export async function savePdf(html: string, outputDir: string, filename: string): Promise<string> {
  mkdirSync(outputDir, { recursive: true })
  const path = join(outputDir, filename.endsWith('.html') ? filename : `${filename}.html`)
  writeFileSync(path, html, 'utf8')
  return path
}
