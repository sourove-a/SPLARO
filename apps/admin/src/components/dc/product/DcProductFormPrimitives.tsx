'use client'

import type { CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { useEffect, useRef, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO } from '@/components/dc/tokens'
import '@/styles/dc-product-form.css'

/**
 * Visual state — focus, hover, depth, motion — lives in `dc-product-form.css`.
 * It cannot live here: inline styles have no pseudo-classes, which is why this
 * form shipped with `outline: none` and nothing to replace it.
 *
 * Layout stays inline. Anything the stylesheet owns is removed from the inline
 * object, because an inline value would beat the class and silently win.
 */

export function DcReadyRing({
  pct,
  size = 26,
  showNum = false,
  fg = 'var(--violet)',
}: {
  pct: number
  size?: number
  showNum?: boolean
  fg?: string
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  const deg = `${(clamped / 100) * 360}deg`
  const inner = Math.round(size * 0.73)
  return (
    <span
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 99,
        background: `conic-gradient(${fg} ${deg}, var(--surface-2) 0)`,
        flex: 'none',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: inner,
          height: inner,
          borderRadius: 99,
          background: 'var(--surface)',
          font: showNum ? `700 9px/1 ${MONO}` : undefined,
          color: fg,
        }}
      >
        {showNum ? Math.round(clamped) : null}
      </span>
    </span>
  )
}

const SECTION_OPEN_PREFIX = 'splaro:pform-open'

function readSectionOpen(id?: string): boolean {
  if (!id || typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(`${SECTION_OPEN_PREFIX}:${id}`) !== '0'
  } catch {
    return true
  }
}

function writeSectionOpen(id: string, open: boolean): void {
  try {
    window.localStorage.setItem(`${SECTION_OPEN_PREFIX}:${id}`, open ? '1' : '0')
  } catch {
    // Private mode — the section simply reopens next visit.
  }
}

/**
 * A form section.
 *
 * Sections stay open by default and only collapse when the operator collapses
 * them — auto-collapsing a "done" section hides fields that a later edit makes
 * incomplete again, and the publish button would then be blocked by something
 * invisible. A collapsed section still force-opens whenever the rail or a
 * readiness blocker jumps to it, so nothing can be required and hidden at once.
 */
export function DcSectionCard({
  id,
  num,
  title,
  hint,
  badge,
  children,
}: {
  id?: string
  num: string
  title: string
  hint?: string
  badge?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(readSectionOpen(id))
  }, [id])

  useEffect(() => {
    if (!id) return
    const openOnHash = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    openOnHash()
    window.addEventListener('hashchange', openOnHash)
    return () => window.removeEventListener('hashchange', openOnHash)
  }, [id])

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (id) writeSectionOpen(id, next)
      return next
    })
  }

  return (
    <div id={id} className="dc-pform-card" data-open={open ? 'true' : 'false'}>
      <div className="dc-pform-card__head">
        <span className="dc-pform-card__num" style={{ font: `700 11px/1 ${MONO}` }}>
          {num}
        </span>
        <span style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {title}
          </span>
          {hint ? (
            <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{hint}</span>
          ) : null}
        </span>
        {badge}
        <button
          type="button"
          className="dc-pform-card__toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
        >
          <DcIcon name={open ? 'icon-chevron-up' : 'icon-chevron-down'} size={13} />
        </button>
      </div>
      <div className="dc-pform-card__body" hidden={!open}>
        {children}
      </div>
    </div>
  )
}

const BENGALI_LABEL = /[ঀ-৿]/

export function DcField({
  label,
  hint,
  tone,
  children,
}: {
  label: string
  hint?: string | undefined
  /** 'warn' tints the hint — used for advisory checks, never for hard errors. */
  tone?: 'warn' | undefined
  children: ReactNode
}) {
  // Uppercasing and wide tracking are Latin typographic devices: Bengali has no
  // case, and the extra letter-spacing pulls conjuncts apart. Bangla labels keep
  // their natural form.
  const bengali = BENGALI_LABEL.test(label)
  return (
    <label
      className={`dc-pform-field${tone === 'warn' ? ' dc-pform-field--warn' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
    >
      <span
        className="dc-pform-label"
        style={{
          font: `600 ${bengali ? '11.5px' : '10.5px'}/1.35 ${FONT}`,
          letterSpacing: bengali ? 'normal' : '.09em',
          textTransform: bengali ? 'none' : 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span
          style={{
            font: `${tone === 'warn' ? 500 : 400} 11px/1.4 ${FONT}`,
            color: tone === 'warn' ? 'var(--warn)' : 'var(--ink-3)',
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  )
}

/** Layout only. Border, background and every state belong to `.dc-pform-input`. */
const inputBase: CSSProperties = {
  height: 38,
  padding: '0 11px',
  borderRadius: 9,
  width: '100%',
  boxSizing: 'border-box',
}

export function DcInput({
  mono,
  style,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input
      {...rest}
      className={`dc-pform-input${className ? ` ${className}` : ''}`}
      style={{
        ...inputBase,
        font: mono ? `600 12.5px/1 ${MONO}` : `500 13px/1 ${FONT}`,
        // Digits in SKU / price / code fields stop reflowing as they are typed.
        ...(mono ? { fontVariantNumeric: 'tabular-nums' } : {}),
        ...style,
      }}
    />
  )
}

export function DcTextarea({
  style,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`dc-pform-textarea${className ? ` ${className}` : ''}`}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        font: `400 12.5px/1.55 ${FONT}`,
        resize: 'vertical',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}

export function DcJumpRail({
  items,
  readyPct,
  readyFg = 'var(--violet)',
  onPreview,
  savedLabel,
}: {
  items: Array<{ id: string; label: string; done?: boolean; active?: boolean }>
  readyPct: number
  readyFg?: string
  /** Optional preview click — scrolls to storefront card or opens preview. */
  onPreview?: () => void
  /** Autosave receipt, e.g. "Draft saved 2 min ago". */
  savedLabel?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeId = items.find((j) => j.active)?.id

  // The rail scrolls horizontally on narrow screens; without this the section
  // you are editing can sit off-screen inside its own nav.
  useEffect(() => {
    if (!activeId) return
    const track = scrollRef.current
    const tab = track?.querySelector<HTMLElement>(`[data-jump-tab="${activeId}"]`)
    if (!track || !tab) return
    const left = tab.offsetLeft - track.clientWidth / 2 + tab.offsetWidth / 2
    track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [activeId])

  const doneCount = items.filter((j) => j.done).length

  return (
    <nav className="dc-pform-rail" aria-label="Product form sections">
      <div ref={scrollRef} className="dc-jump-scroll dc-pform-rail__track">
        {items.map((j) => (
          <a
            key={j.id}
            href={`#${j.id}`}
            data-jump-tab={j.id}
            className={`dc-pform-tab${j.active ? ' dc-pform-tab--on' : ''}${j.done ? ' dc-pform-tab--done' : ''}`}
            aria-current={j.active ? 'true' : undefined}
          >
            <span className="dc-pform-tab__dot" aria-hidden />
            <span>{j.label}</span>
          </a>
        ))}
      </div>

      <div className="dc-pform-rail__meta">
        {savedLabel ? (
          <span className="dc-pform-rail__saved" title={savedLabel}>
            <DcIcon name="icon-check" size={12} />
            <span className="dc-pform-rail__saved-label">Saved</span>
          </span>
        ) : null}
        {onPreview ? (
          <button type="button" onClick={onPreview} className="dc-pform-rail__preview dc-hover-ink">
            <DcIcon name="icon-eye" size={13} />
            <span className="dc-pform-rail__preview-label">Preview</span>
          </button>
        ) : null}
        <span className="dc-pform-rail__ready" title={`${doneCount} of ${items.length} sections filled`}>
          <DcReadyRing pct={readyPct} size={26} fg={readyFg} />
          <span style={{ font: `700 11.5px/1 ${MONO}`, color: readyFg }}>{Math.round(readyPct)}%</span>
        </span>
      </div>
    </nav>
  )
}

export function DcStickyPublishBar({
  readyPct,
  readyDone,
  readyTotal,
  saveNote,
  saveLabel,
  onSave,
  onDraft,
  onDiscard,
  saving,
  saveDisabled,
  blockerHint,
}: {
  readyPct: number
  readyDone: number
  readyTotal: number
  saveNote: string
  saveLabel: string
  onSave: () => void
  onDraft: () => void
  onDiscard: () => void
  saving?: boolean
  saveDisabled?: boolean
  /** Top blocker labels shown under the count when not ready. */
  blockerHint?: string
}) {
  const blockers = Math.max(0, readyTotal - readyDone)
  const ready = blockers === 0
  const fg = ready ? 'var(--ok)' : 'var(--violet)'
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 12,
        zIndex: 7,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '12px 14px',
        border: '1px solid var(--line-2)',
        borderRadius: 14,
        background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <span
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingRight: 14,
          borderRight: '1px solid var(--line)',
        }}
      >
        <DcReadyRing pct={readyPct} size={34} showNum fg={fg} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>
            {ready
              ? 'Ready to go live'
              : `${blockers} blocker${blockers === 1 ? '' : 's'} before this can go live`}
          </span>
          <span style={{ font: `400 10.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
            {ready
              ? `${readyDone}/${readyTotal} · ${saveNote}`
              : blockerHint
                ? `Still need: ${blockerHint}`
                : `${readyDone}/${readyTotal} · ${saveNote}`}
          </span>
        </span>
      </span>
      {/* Blocked publish is a neutral button, not washed-out violet — a faded
          brand colour reads as a rendering fault rather than a deliberate state. */}
      <button
        type="button"
        data-dc-publish-primary="1"
        onClick={onSave}
        disabled={saveDisabled || saving}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 38,
          padding: '0 16px',
          borderRadius: 10,
          border: saveDisabled && !saving ? '1px solid var(--line-2)' : 0,
          background: saveDisabled && !saving ? 'var(--surface-2)' : 'var(--violet-solid)',
          color: saveDisabled && !saving ? 'var(--ink-3)' : 'var(--on-violet)',
          cursor: saveDisabled || saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          font: `600 12.5px/1 ${FONT}`,
          boxShadow: ready && !saving ? '0 2px 8px -2px rgba(124, 58, 237, 0.4)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <DcIcon name={saveDisabled && !saving ? 'icon-lock' : 'icon-check'} size={14} />
        <span>
          {saving
            ? 'Publishing…'
            : ready
              ? saveLabel || 'Publish Product'
              : `Publish Product · ${blockers} missing`}
        </span>
      </button>
      <button
        type="button"
        onClick={onDraft}
        disabled={saving}
        className="dc-hover-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 38,
          padding: '0 16px',
          borderRadius: 10,
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          cursor: 'pointer',
          font: `600 12.5px/1 ${FONT}`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'all 0.15s ease',
        }}
      >
        <DcIcon name="icon-file-pen" size={13} />
        <span>Save as Draft</span>
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="dc-hover-ink"
        style={{
          marginLeft: 'auto',
          height: 38,
          padding: '0 12px',
          borderRadius: 10,
          border: 0,
          background: 'transparent',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          font: `600 12.5px/1 ${FONT}`,
        }}
      >
        Discard
      </button>
    </div>
  )
}

export function DcReadinessList({
  items,
  readyPct,
  onJump,
}: {
  items: Array<{ ok: boolean; label: string; sub: string; jumpTo?: string; fieldId?: string }>
  readyPct: number
  /** Called with the blocker's field id so the form can focus and flash it. */
  onJump?: (item: { jumpTo?: string | undefined; fieldId?: string | undefined }) => void
}) {
  const fg = readyPct >= 100 ? 'var(--ok)' : 'var(--violet)'
  const remaining = items.filter((r) => !r.ok).length
  return (
    <div className="dc-pform-card">
      <div
        style={{
          padding: '11px 14px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>Readiness</span>
          <span style={{ font: `400 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            {remaining === 0
              ? 'Everything needed to publish is in place'
              : `${remaining} left — tap one to jump there`}
          </span>
        </span>
        <span style={{ font: `700 12px/1 ${MONO}`, color: fg }}>{Math.round(readyPct)}%</span>
      </div>
      <div style={{ height: 3, background: 'var(--surface-2)' }}>
        <div
          style={{
            height: '100%',
            width: `${readyPct}%`,
            background: fg,
            transition: 'width 320ms cubic-bezier(.16,1,.3,1)',
          }}
        />
      </div>
      {items.map((r) => (
        // An unfinished check is the fastest route to the field that is
        // missing, so it acts as a link; a finished one is just a receipt.
        <Row
          key={r.label}
          jumpTo={r.ok ? undefined : r.jumpTo}
          {...(!r.ok && onJump
            ? { onJump: () => onJump({ jumpTo: r.jumpTo, fieldId: r.fieldId }) }
            : {})}
        >
          <DcIcon
            name={r.ok ? 'icon-check' : 'icon-circle'}
            size={12}
            color={r.ok ? 'var(--ok)' : 'var(--ink-3)'}
            style={{ marginTop: 2 }}
          />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                font: `500 12px/1.35 ${FONT}`,
                color: r.ok ? 'var(--ink)' : 'var(--ink-2)',
              }}
            >
              {r.label}
            </span>
            <span style={{ font: `400 10.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{r.sub}</span>
          </span>
          {!r.ok && r.jumpTo ? (
            <DcIcon name="icon-chevron-right" size={12} color="var(--ink-3)" />
          ) : null}
        </Row>
      ))}
    </div>
  )
}

/** Readiness row: a link when there is somewhere to go, otherwise a plain row. */
function Row({
  jumpTo,
  onJump,
  children,
}: {
  jumpTo?: string | undefined
  onJump?: (() => void) | undefined
  children: ReactNode
}) {
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    padding: '9px 14px',
    borderBottom: '1px solid var(--line)',
    textDecoration: 'none',
    color: 'inherit',
  }
  if (!jumpTo) return <div style={style}>{children}</div>
  return (
    <a
      href={`#${jumpTo}`}
      style={{ ...style, cursor: 'pointer' }}
      className="dc-hover-ink"
      onClick={onJump}
    >
      {children}
    </a>
  )
}

export function DcStorefrontPreview({
  title,
  priceLabel,
  compareLabel,
  dept,
  imageUrl,
  colors = [],
  meta,
}: {
  title: string
  priceLabel: string
  compareLabel?: string
  dept?: string
  imageUrl?: string
  colors?: Array<{ hex: string; name: string; on?: boolean }>
  meta?: string
}) {
  return (
    <div className="dc-pform-card">
      <div
        style={{
          padding: '11px 14px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ flex: 1, font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          Storefront preview
        </span>
        <span style={{ font: `500 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>card</span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* 4/5 mirrors `.shop-product-card__media` — the crop the shop really renders. */}
        <div
          style={{
            width: '100%',
            aspectRatio: '4 / 5',
            borderRadius: 10,
            border: imageUrl ? '1px solid var(--line)' : '1px dashed var(--line-2)',
            background: imageUrl
              ? `center / cover no-repeat url(${JSON.stringify(imageUrl)})`
              : 'var(--surface-2)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-3)',
          }}
        >
          {!imageUrl ? (
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 7,
                color: 'var(--ink-3)',
              }}
            >
              <DcIcon name="icon-image" size={20} />
              <span style={{ font: `500 11px/1 ${FONT}` }}>Main photo</span>
              <span style={{ font: `400 10px/1 ${FONT}`, color: 'var(--ink-3)', opacity: 0.75 }}>
                First media slot fills this
              </span>
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {dept ? (
            <span
              style={{
                font: `600 9.5px/1 ${FONT}`,
                letterSpacing: '.11em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              {dept}
            </span>
          ) : null}
          <span style={{ font: `500 13px/1.35 ${FONT}`, color: 'var(--ink)' }}>
            {title || 'Untitled product'}
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: `700 15px/1 ${MONO}`, color: 'var(--ink)' }}>{priceLabel}</span>
            {compareLabel ? (
              <span
                style={{
                  font: `400 12px/1 ${MONO}`,
                  color: 'var(--ink-3)',
                  textDecoration: 'line-through',
                }}
              >
                {compareLabel}
              </span>
            ) : null}
          </span>
          {colors.length > 0 ? (
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 3 }}>
              {colors.map((c) => (
                <span
                  key={c.name + c.hex}
                  title={c.name}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    border: `1px solid ${c.on ? 'var(--violet)' : 'var(--line-2)'}`,
                    outline: c.on ? '2px solid var(--violet-soft)' : undefined,
                    background: c.hex.startsWith('#') || c.hex.startsWith('var(') ? c.hex : 'var(--surface-2)',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </span>
          ) : null}
          {meta ? (
            <span style={{ font: `400 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>{meta}</span>
          ) : null}
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              height: 34,
              marginTop: 3,
              borderRadius: 9,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              font: `600 11.5px/1 ${FONT}`,
              color: 'var(--ink-2)',
            }}
          >
            Add to bag
          </span>
        </div>
      </div>
    </div>
  )
}

export function DcChip({
  on,
  onClick,
  children,
}: {
  on?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="dc-pform-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 34,
        padding: '0 13px',
        borderRadius: 9,
        cursor: 'pointer',
        font: `600 12px/1 ${FONT}`,
      }}
    >
      {on ? <DcIcon name="icon-check" size={12} /> : null}
      {children}
    </button>
  )
}

export function DcPill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 7,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        font: `600 11.5px/1 ${FONT}`,
        color: 'var(--ink-2)',
      }}
    >
      {children}
    </span>
  )
}
