#!/usr/bin/env node
/**
 * Regenerate apps/web/src/lib/checkout/bd-thanas.ts
 * Primary source: bangladesh-address upazilas (495) + metro city thanas.
 * Merges spelling variants (Raiganj/Raigonj, Ullahpara/Ullapara) via normalizeKey.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const DISTRICTS_FILE = path.join(root, 'apps/web/src/lib/checkout/bd-districts.ts')
const OUTPUT_FILE = path.join(root, 'apps/web/src/lib/checkout/bd-thanas.ts')
const UPAZILA_URL =
  'https://raw.githubusercontent.com/rajuAhmed1705/bangladesh-address/master/src/json/bd-upazila.json'
const THANA_URL =
  'https://raw.githubusercontent.com/rajuAhmed1705/bangladesh-address/master/src/json/bd-thana.json'

const DISTRICT_ALIASES = {
  Comilla: 'Cumilla',
  Barisal: 'Barishal',
  Bogra: 'Bogura',
  Jessore: 'Jashore',
  Chittagong: 'Chattogram',
  Coxsbazar: "Cox's Bazar",
  Chapainawabganj: 'Chapai Nawabganj',
  Jhalakathi: 'Jhalokathi',
  Jhalokati: 'Jhalokathi',
  Khagrachari: 'Khagrachhari',
}

const CITY_EXTRAS = {
  Dhaka: [
    'Adabor', 'Ashulia', 'Badda', 'Banani', 'Bangshal', 'Bhasan Tek', 'Bhatara', 'Biman Bandar',
    'Cantonment', 'Chak Bazar', 'Dakshinkhan', 'Darus Salam', 'Demra', 'Dhanmondi', 'Gendaria',
    'Gulshan', 'Hatirjheel', 'Hazaribagh', 'Jatrabari', 'Kadamtali', 'Kafrul', 'Kalabagan',
    'Kamrangir Char', 'Khilgaon', 'Khilkhet', 'Kotwali', 'Lalbagh', 'Mirpur', 'Mohammadpur',
    'Motijheel', 'Mugda Para', 'New Market', 'Pallabi', 'Paltan', 'Ramna', 'Rampura', 'Rupnagar',
    'Sabujbagh', 'Shah Ali', 'Shahbagh', 'Shahjahanpur', 'Sher-E-Bangla Nagar', 'Shyampur',
    'Sutrapur', 'Tejgaon', 'Tejgaon Ind. Area', 'Turag', 'Uttar Khan', 'Uttara', 'Uttara Paschim',
    'Uttara Purba', 'Vatara', 'Wari', 'Keraniganj (South)',
  ],
  Chattogram: [
    'Akbar Shah', 'Bakalia', 'Bandar', 'Bayezid Bostami', 'Chandgaon', 'Chawk Bazar',
    'Chittagong Kotwali', 'Double Mooring', 'EPZ', 'Halishahar', 'Khulshi', 'Karnafuli',
    'Pahartali', 'Panchlaish', 'Patenga', 'Sadarghat',
  ],
  Gazipur: ['Bason', 'Gacha', 'Gazipur (Sadar)', 'Kashimpur', 'Konabari', 'Pubail', 'Tongi (North)', 'Tongi (West)'],
  Narayanganj: ['Fatullah', 'Fotullah'],
  Rajshahi: ['Boalia', 'Rajpara', 'Motihar', 'Shaheb Bazar'],
  Khulna: ['Daulatpur', 'Khalishpur', 'Sonadanga', 'Khan Jahan Ali'],
}

function normalizeKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/gonj/g, 'ganj')
    .replace(/gaonj/g, 'ganj')
    .replace(/khanda/g, 'khand')
    .replace(/ullapara/g, 'ullahpara')
    .replace(/shadar/g, 'sadar')
    .replace(/chittagong/g, 'chattogram')
    .replace(/barisal/g, 'barishal')
    .replace(/bogra/g, 'bogura')
    .replace(/jessore/g, 'jashore')
    .replace(/comilla/g, 'cumilla')
    .replace(/naryanganj/g, 'narayanganj')
    .replace(/siddirgonj/g, 'siddhirganj')
}

function toOur(name) {
  return DISTRICT_ALIASES[name] || name
}

function parseDistrictOrder(fileText) {
  return fileText
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s+(['"])(.+)\1,/)
      return match ? match[2] : null
    })
    .filter(Boolean)
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return response.json()
}

function addThana(map, district, name, prefer = false) {
  if (!map[district]) return
  const key = normalizeKey(name)
  if (!map[district].has(key) || prefer) {
    map[district].set(key, name)
  }
}

async function main() {
  const districtsText = fs.readFileSync(DISTRICTS_FILE, 'utf8')
  const order = parseDistrictOrder(districtsText)
  const [upazilas, metroThanas] = await Promise.all([fetchJson(UPAZILA_URL), fetchJson(THANA_URL)])

  const maps = Object.fromEntries(order.map((district) => [district, new Map()]))

  for (const entry of upazilas) {
    addThana(maps, toOur(entry.district), entry.upazila, true)
  }
  for (const entry of metroThanas) {
    addThana(maps, toOur(entry.district), entry.thana)
  }
  for (const [district, names] of Object.entries(CITY_EXTRAS)) {
    for (const name of names) addThana(maps, district, name)
  }

  const output = {}
  for (const district of order) {
    output[district] = [...maps[district].values()].sort((a, b) => a.localeCompare(b))
  }

  const total = Object.values(output).reduce((sum, list) => sum + list.length, 0)
  const body = `/** Thanas & upazilas per district — deduplicated, incl. DMP/CMP city thanas. */
import type { BdDistrict } from '@/lib/checkout/bd-districts'

export const BD_THANAS_BY_DISTRICT: Record<BdDistrict, readonly string[]> = ${JSON.stringify(output, null, 2)} as const

export function getThanasForDistrict(district: string): readonly string[] {
  return (BD_THANAS_BY_DISTRICT as Record<string, readonly string[]>)[district] ?? []
}

export function isBdThana(district: string, thana: string): boolean {
  return getThanasForDistrict(district).includes(thana)
}
`

  fs.writeFileSync(OUTPUT_FILE, body)
  console.log(`Wrote ${OUTPUT_FILE} — ${order.length} districts, ${total} unique thanas`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
