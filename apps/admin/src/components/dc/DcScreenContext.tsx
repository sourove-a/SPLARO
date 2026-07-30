'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { DcIcon } from './DcIcon'
import { FONT, toneStyle, type DcTone } from './tokens'

export interface DcToast {
  id: number
  tone: DcTone
  title: string
  body?: string | undefined
}

export interface DcScreenApi {
  /** Screen-local tab state, keyed by the tab strip's group name. */
  tab: Record<string, string>
  setTab: (group: string, id: string) => void
  /** Screen id currently rendered — the `nav` tab strip highlights against it. */
  screen: string
  navigate: (screen: string) => void
  /** Text-edit dirtiness per save scope. */
  dirty: Record<string, boolean>
  setDirty: (scope: string, value: boolean) => void
  toast: (tone: DcTone, title: string, body?: string) => void
}

const noop = () => {}

const DcScreenContext = createContext<DcScreenApi>({
  tab: {},
  setTab: noop,
  screen: '',
  navigate: noop,
  dirty: {},
  setDirty: noop,
  toast: noop,
})

export function useDcScreen() {
  return useContext(DcScreenContext)
}

export interface DcScreenProviderProps {
  screen: string
  onNavigate: (screen: string) => void
  children: ReactNode
}

/** Default tab per group, matching the prototype's initial `ctab` state. */
const DEFAULT_TABS: Record<string, string> = {
  home: 'ourStory',
  menu: 'menu',
  media: 'all',
  blog: 'all',
}

export function DcScreenProvider({ screen, onNavigate, children }: DcScreenProviderProps) {
  const [tab, setTabState] = useState<Record<string, string>>(DEFAULT_TABS)
  const [dirty, setDirtyState] = useState<Record<string, boolean>>({})
  const [toasts, setToasts] = useState<DcToast[]>([])
  const nextId = useRef(1)

  const setTab = useCallback((group: string, id: string) => {
    setTabState((t) => ({ ...t, [group]: id }))
  }, [])

  const setDirty = useCallback((scope: string, value: boolean) => {
    setDirtyState((d) => ({ ...d, [scope]: value }))
  }, [])

  const toast = useCallback((tone: DcTone, title: string, body?: string) => {
    const id = nextId.current++
    setToasts((list) => [...list, { id, tone, title, body }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200)
  }, [])

  const api = useMemo<DcScreenApi>(
    () => ({ tab, setTab, screen, navigate: onNavigate, dirty, setDirty, toast }),
    [tab, setTab, screen, onNavigate, dirty, setDirty, toast],
  )

  return (
    <DcScreenContext.Provider value={api}>
      {children}
      <DcToaster toasts={toasts} onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
    </DcScreenContext.Provider>
  )
}

const TOAST_ICON: Record<DcTone, string> = {
  ok: 'icon-circle-check',
  warn: 'icon-triangle-alert',
  bad: 'icon-circle-x',
  info: 'icon-info',
  vio: 'icon-sparkles',
  mute: 'icon-info',
}

function DcToaster({
  toasts,
  onDismiss,
}: {
  toasts: DcToast[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        right: 22,
        bottom: 78,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 340,
      }}
    >
      {toasts.map((t) => {
        const tone = toneStyle(t.tone)
        return (
          <div
            key={t.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '11px 13px',
              borderRadius: 11,
              border: `1px solid ${tone.bd}`,
              background: 'var(--surface)',
              backgroundImage: 'var(--card-sheen)',
              animation: 'dc-toastin .22s ease-out',
            }}
          >
            <DcIcon name={TOAST_ICON[t.tone]} size={15} color={tone.fg} />
            <span
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{t.title}</span>
              {t.body ? (
                <span
                  style={{
                    font: `400 11.5px/1.45 ${FONT}`,
                    color: 'var(--ink-3)',
                    textWrap: 'pretty',
                  }}
                >
                  {t.body}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 20,
                height: 20,
                flex: 'none',
                border: 0,
                borderRadius: 5,
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              <DcIcon name="icon-x" size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
