/**
 * Block vocabulary for admin module screens.
 *
 * A screen is data: an array of blocks. Ported from the design prototype's
 * `const B = {…}` factory so screen definitions read the same in both places.
 *
 * Optional properties are written `?: T | undefined` throughout because the
 * app compiles with `exactOptionalPropertyTypes`, and the factory below always
 * passes every field.
 */

import type { DcTone, DcWidth } from '../tokens'

/* ── table cells ─────────────────────────────────────────────────── */

export type DcCell =
  | string
  | number
  | null
  | undefined
  /** plain value */
  | { v: string }
  /** two-line: [title, sub, 'mono'?] */
  | { s: [string, string, 'mono'?] }
  /** status chip; tone falls back to the STATUS_TONE table */
  | { c: string; tone?: DcTone | undefined }
  /** progress bar: [percent, colour, label?] */
  | { b: [number, string, string?] }
  /** monospace */
  | { m: string }
  /** right-aligned number (mono) */
  | { n: string }
  /** bold */
  | { strong: string }
  /** dimmed */
  | { mute: string }

/** A column label ending in `>` is right-aligned. */
export type DcColumn = string

/* ── block payloads ──────────────────────────────────────────────── */

export interface DcMetric {
  label: string
  value: string
  sub?: string | undefined
  color?: string | undefined
}

export interface DcListItem {
  icon: string
  color?: string | undefined
  title: string
  sub?: string | undefined
  value: string
  valueColor?: string | undefined
}

export interface DcToggleItem {
  label: string
  sub?: string | undefined
  on?: boolean | undefined
}

export interface DcFormField {
  label: string
  value: string
  mono?: boolean | undefined
  area?: boolean | undefined
  secret?: boolean | undefined
  hint?: string | undefined
}

/**
 * `[label, variant, toastTitle, toastBody]` — the trailing two are the toast the
 * prototype raises when the action is taken. Screens carry them as data; the
 * renderer turns them into a real toast.
 */
export type DcCardAction = [
  label: string,
  variant?: 'primary' | 'ghost',
  toastTitle?: string,
  toastBody?: string,
]

export interface DcCardItem {
  title: string
  sub?: string | undefined
  icon?: string | undefined
  iconColor?: string | undefined
  chip?: string | undefined
  tone?: DcTone | undefined
  thumb?: boolean | undefined
  rows?: Array<[label: string, value: string]> | undefined
  stars?: number | undefined
  starLabel?: string | undefined
  body?: string | undefined
  actions?: DcCardAction[] | undefined
  onAction?: ((label: string, index: number) => void) | undefined
}

export interface DcDecideItem {
  sev: DcTone
  title: string
  sku?: string | undefined
  badge: string
  decision: string
  deadline?: string | undefined
  stats?: Array<[key: string, value: string]> | undefined
  note?: string | undefined
  actions?: DcCardAction[] | undefined
  onAction?: ((label: string, index: number) => void) | undefined
}

export interface DcVisRow {
  id?: string | undefined
  label: string
  sub?: string | undefined
  note?: string | undefined
  icon?: string | undefined
  on: boolean
  badgeOn?: string | undefined
  badgeOff?: string | undefined
  btnOn?: string | undefined
  btnOff?: string | undefined
  onToggle?: ((next: boolean) => void) | undefined
  onMove?: ((direction: -1 | 1) => void) | undefined
}

export interface DcPubRow {
  id?: string | undefined
  title: string
  sub?: string | undefined
  url?: string | undefined
  thumb?: boolean | undefined
  on: boolean
  locked?: boolean | undefined
  lockNote?: string | undefined
  badgeOn?: string | undefined
  badgeOff?: string | undefined
  btnOn?: string | undefined
  btnOff?: string | undefined
  editLabel?: string | undefined
  editToast?: string | undefined
  onEdit?: (() => void) | undefined
  onToggle?: ((next: boolean) => void) | undefined
}

export interface DcTimelineItem {
  icon: string
  color?: string | undefined
  text: string
  time: string
}

export interface DcSegItem {
  label: string
  n: string | number
  dot?: string | undefined
}

/** `[id, label, count?]` — the prototype's tab tuple. */
export type DcTabItem = [id: string, label: string, count?: string | number]

/* ── the union ───────────────────────────────────────────────────── */

interface Base {
  w?: DcWidth | null | undefined
}

export type DcBlock =
  | (Base & { t: 'kpis'; items: DcMetric[] })
  | (Base & {
      t: 'hero'
      label: string
      value: string
      delta: string
      tone: DcTone
      sub: string
      items: DcMetric[]
    })
  | (Base & { t: 'banner'; tone: DcTone; icon: string; text: string })
  | (Base & { t: 'seg'; items: DcSegItem[] })
  | (Base & { t: 'chart'; title: string; total: string; bars: number[]; labels: string[] })
  | (Base & {
      t: 'table'
      title: string
      meta?: string | undefined
      cols: DcColumn[]
      rows: DcCell[][]
    })
  | (Base & {
      t: 'cards'
      title?: string | undefined
      cardMin?: string | undefined
      items: DcCardItem[]
    })
  | (Base & { t: 'list'; title: string; meta?: string | undefined; items: DcListItem[] })
  | (Base & { t: 'toggles'; title: string; items: DcToggleItem[] })
  | (Base & {
      t: 'form'
      title: string
      fields: DcFormField[]
      scope?: string | undefined
    })
  | (Base & {
      t: 'tabs'
      group: string
      items: DcTabItem[]
    })
  | (Base & {
      t: 'vis'
      title: string
      meta?: string | undefined
      rows: DcVisRow[]
      /** Enables the reorder arrows and namespaces the persisted order. */
      listId?: string | null | undefined
      addLabel?: string | undefined
    })
  | (Base & {
      t: 'pub'
      title: string
      rows: DcPubRow[]
      addLabel?: string | undefined
      /** `[tone, title, body]` toast raised when the add button is used. */
      addToast?: [string, string, string] | undefined
    })
  | (Base & {
      t: 'save'
      scope?: string | undefined
      hint?: string | undefined
      dirty?: boolean | undefined
      onSave?: (() => void) | undefined
      onReset?: (() => void) | undefined
    })
  | (Base & {
      t: 'beta'
      route: string
      text: string
      cta?: string | undefined
      /** Screen id the CTA navigates to. */
      ctaGo?: string | undefined
    })
  | (Base & {
      t: 'media'
      title: string
      meta?: string | undefined
      slots: string[]
      slotMin?: string | undefined
    })
  | (Base & { t: 'timeline'; title: string; items: DcTimelineItem[] })
  | (Base & { t: 'decide'; title: string; meta?: string | undefined; items: DcDecideItem[] })

/* ── factory ─────────────────────────────────────────────────────── */

/** Metric helper — mirrors the prototype's `K(label, value, sub, color)`. */
export const K = (label: string, value: string, sub?: string, color?: string): DcMetric => ({
  label,
  value,
  sub,
  color: color || 'var(--ink)',
})

export const B = {
  kpis: (items: DcMetric[], w?: DcWidth | null): DcBlock => ({ t: 'kpis', items, w }),
  hero: (
    label: string,
    value: string,
    delta: string,
    tone: DcTone,
    sub: string,
    items: DcMetric[],
    w?: DcWidth | null,
  ): DcBlock => ({ t: 'hero', label, value, delta, tone, sub, items, w }),
  banner: (tone: DcTone, icon: string, text: string, w?: DcWidth | null): DcBlock => ({
    t: 'banner',
    tone,
    icon,
    text,
    w,
  }),
  seg: (items: DcSegItem[], w?: DcWidth | null): DcBlock => ({ t: 'seg', items, w }),
  chart: (
    title: string,
    total: string,
    bars: number[],
    labels: string[],
    w?: DcWidth | null,
  ): DcBlock => ({ t: 'chart', title, total, bars, labels, w }),
  table: (
    title: string,
    meta: string,
    cols: DcColumn[],
    rows: DcCell[][],
    w?: DcWidth | null,
  ): DcBlock => ({ t: 'table', title, meta, cols, rows, w }),
  cards: (title: string, cardMin: string, items: DcCardItem[], w?: DcWidth | null): DcBlock => ({
    t: 'cards',
    title,
    cardMin,
    items,
    w,
  }),
  list: (title: string, meta: string, items: DcListItem[], w?: DcWidth | null): DcBlock => ({
    t: 'list',
    title,
    meta,
    items,
    w,
  }),
  toggles: (title: string, items: DcToggleItem[], w?: DcWidth | null): DcBlock => ({
    t: 'toggles',
    title,
    items,
    w,
  }),
  form: (title: string, fields: DcFormField[], w?: DcWidth | null, scope?: string): DcBlock => ({
    t: 'form',
    title,
    fields,
    w,
    scope,
  }),
  tabs: (group: string, items: DcTabItem[]): DcBlock => ({ t: 'tabs', group, items }),
  vis: (
    title: string,
    meta: string,
    rows: DcVisRow[],
    w?: DcWidth | null,
    listId?: string | null,
    addLabel?: string,
  ): DcBlock => ({ t: 'vis', title, meta, rows, w, listId, addLabel }),
  pub: (
    title: string,
    rows: DcPubRow[],
    w?: DcWidth | null,
    addLabel?: string,
    addToast?: [string, string, string],
  ): DcBlock => ({ t: 'pub', title, rows, w, addLabel, addToast }),
  save: (scope: string, hint?: string, dirty?: boolean): DcBlock => ({
    t: 'save',
    scope,
    hint,
    dirty,
  }),
  beta: (route: string, text: string, cta?: string, ctaGo?: string): DcBlock => ({
    t: 'beta',
    route,
    text,
    cta,
    ctaGo,
  }),
  media: (
    title: string,
    meta: string,
    slots: string[],
    slotMin?: string,
    w?: DcWidth | null,
  ): DcBlock => ({ t: 'media', title, meta, slots, slotMin, w }),
  time: (title: string, items: DcTimelineItem[], w?: DcWidth | null): DcBlock => ({
    t: 'timeline',
    title,
    items,
    w,
  }),
  decide: (title: string, meta: string, items: DcDecideItem[], w?: DcWidth | null): DcBlock => ({
    t: 'decide',
    title,
    meta,
    items,
    w,
  }),
}
