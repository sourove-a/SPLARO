# Admin UI/UX — 5.5 → 9 / 10

Measured 2026-07-28 against the live import graph (`_retired/` excluded).
Companion to [REMEDIATION-PLAN.md](./REMEDIATION-PLAN.md) phase 5.

---

## Where it actually stands

The override war is already mostly won — 7 stylesheets moved to `_retired/`, `!important`
down from 2,515 to 200, the import stack from 14 files to 8. What remains is not a
redesign. It is finishing the consolidation, then adding the layer that separates
"clean" from "premium".

| Dimension | Now | Target | What moves it |
|---|---|---|---|
| Design system health | 5/10 | 9/10 | P2, P3, P4 |
| Live correctness | 3/10 | 10/10 | P1 |
| Component foundation | 6/10 | 9/10 | P5, P6 |
| Interaction polish | 4/10 | 9/10 | P5, P7 |
| Accessibility | 5/10 | 9/10 | P1, P5 |
| Regression safety | 1/10 | 9/10 | P8 |

### The measurements this plan is built on

| Metric | Live value | Target |
|---|---|---|
| CSS lines (live) | 16,444 | < 6,000 |
| — of which `globals.css` | 13,707 (83%) | < 400 |
| `!important` | 200 | < 20 |
| Distinct hex colors | 180 | 0 outside tokens |
| Distinct `font-size` | 42 | 9 |
| Distinct spacing values | 71 | 8 |
| Distinct `border-radius` | 30 | 6 |
| Distinct breakpoints | 20 | 5 |
| Distinct `z-index` | 19 (`-1`…`9999`) | 6 named |
| Distinct transition durations | 21 | 4 |
| `box-shadow` declarations | 938 | 5 elevation tokens |
| Inline `style={{` in TSX | 777 | < 100 (data-driven only) |
| Native `alert()`/`confirm()` | 27 | 0 |
| `toast.` calls (dep installed) | 0 | every mutation |
| WCAG AA contrast failures | 3 on `/login` | 0, enforced |

`globals.css` holding 83% of all admin CSS is now the single biggest structural problem.
`box-shadow` appearing 938 times against ~5 real elevation levels is the biggest visual
inconsistency. 777 inline styles is the biggest token-bypass.

---

## What "9" means here

7/10 is consistent and bug-free. 9/10 is consistent, bug-free, **and considered**:

- Every surface sits on one of five elevations, never an ad-hoc shadow.
- Every mutation gives feedback in the same place, in the same style, every time.
- Every panel handles all five states: loading, empty, partial, error, permission-denied.
- Motion is choreographed — enter, exit and state changes share one timing language.
- The whole thing is keyboard-drivable without reaching for a mouse.
- None of the above can silently regress, because CI blocks it.

The last point is what makes 9 stick. The `/login` contrast bug is live *right now* in
brand-new uncommitted work — proof that without enforcement, quality decays faster than it
is built.

---

## P1 — Stop the bleeding (half a day) · blocks everything

### 1.1 Fix the invisible login screen

Three elements render at contrast ratio **1.0** — white text on the white card. The card
was flipped to the white surface in `admin-surfaces.css:300`, but its child text rules in
`globals.css` still carry the old dark-card colors.

| Selector | `globals.css` line | Current | Should be |
|---|---|---|---|
| `.admin-auth-card__eyebrow` | 4296 | `rgba(255,255,255,0.42)` | muted graphite token |
| `.admin-auth-card__title` | 4304 | `rgba(255,255,255,0.96)` | primary ink token |
| `.admin-auth-card__subtitle` | 4312 | `rgba(255,255,255,0.55)` | secondary ink token |

Do not patch these with literal hex — point them at the ink tokens from P2, so the fix
survives the next surface change. This is the whole lesson of the bug.

**Done when:** the contrast probe (1.2) reports 0 failures on `/login`.

### 1.2 Make contrast a CI gate — *the single highest-leverage item in this plan*

Add a Playwright check that walks every admin route, computes the effective contrast of
every leaf text node against its first opaque ancestor, and fails on anything below WCAG
AA (4.5:1 body, 3:1 large text). The probe used to find the login bug is already written —
promote it into `apps/admin/e2e/contrast.spec.ts`.

Gate on authenticated routes too, using a seeded CI admin session.

**Done when:** CI fails on a branch that reintroduces white-on-white anywhere.

### 1.3 Audit the other 179 hardcoded colors for the same class of bug

The login bug is one instance of "surface changed, ink didn't". Grep every rule that sets a
near-white `color` and check what it now sits on. Fix by tokenizing, not by recoloring.

---

## P2 — One token system (2 days)

Tokens exist (`admin-tokens.css`, 101 definitions, 149 referenced) but 180 raw hex values
still bypass them, and **9 files define `--admin-*` tokens**, four of them retired.

### 2.1 Collapse token definitions to one file

Only `admin-tokens.css` may define `--admin-*`. Today `globals.css`,
`admin-design-system.css` and `admin-primitives.css` also do. 22 `:root` blocks across the
tree is 21 too many.

### 2.2 Complete the ink/surface pairs

The login bug happened because surfaces are tokenized and ink is not. Define them as pairs
so they cannot drift:

```
--admin-surface-base / --admin-ink-base
--admin-surface-raised / --admin-ink-raised
--admin-surface-sunken / --admin-ink-sunken
--admin-surface-inverse / --admin-ink-inverse   ← the dark login/earth context
```

Every `color` declaration references an ink token whose surface pair it actually sits on.

### 2.3 Resolve the 180 hex values against the monochrome rule

Sort each into: maps to a graphite token · maps to a semantic token (success / warning /
danger / info) · documented exception. The known legitimate exceptions are the Telegram
login button and the Google SERP preview. Everything else that is currently blue or purple
is a violation of the stated direction.

**Done when:** `grep -oE "#[0-9a-fA-F]{3,8}" ` over live CSS returns only matches inside
`admin-tokens.css`.

---

## P3 — Break up `globals.css` (3–4 days)

13,707 lines is 83% of all admin CSS in one file. Nobody can hold it in their head, which
is exactly how the login rules drifted out of sync with the card they style.

Split by ownership, one PR per extraction, screenshotting before and after:

| New file | Contains | Rough size |
|---|---|---|
| `admin-tokens.css` | tokens only (already exists) | ~650 |
| `admin-base.css` | reset, typography, document-level | ~300 |
| `admin-layout.css` | shell, sidebar, header, grid | ~600 |
| `admin-components.css` | button, input, card, badge, table, modal | ~1,200 |
| `admin-auth.css` | login/OTP surfaces (the dark inverse context) | ~400 |
| `admin-<feature>.css` | one per module panel | ~200 each |
| `globals.css` | imports + genuinely global rules only | **< 400** |

Rule going forward: a selector lives in the file that owns the component. No file over
1,200 lines.

**Done when:** `globals.css` is under 400 lines and no live sheet exceeds 1,200.

---

## P4 — Real scales (2–3 days)

Replace sprawl with fixed scales, defined once in `admin-tokens.css`.

| Scale | From | To |
|---|---|---|
| Spacing | 71 values | 8 steps (`4 8 12 16 24 32 48 64`) |
| Type | 42 sizes | 9 steps |
| Radius | 30 values | 6 steps |
| Elevation | 938 `box-shadow` declarations | 5 tokens |
| Motion | 21 durations | 4 (`instant 80 / quick 140 / base 220 / slow 360`) + 2 easings |
| Breakpoints | 20 | 5 (`640 768 1024 1280 1536`) |
| z-index | 19 raw (`-1`…`9999`) | 6 named (`base dropdown sticky overlay modal toast`), none above 100 |

The `9999` and the current 20-breakpoint spread (including near-duplicate pairs) are the
two that actively cause bugs — stacking surprises and 1px dead zones between rules.

### 4.1 Kill the 777 inline styles

777 `style={{` in admin TSX bypass every token above. Triage: keep only genuinely
data-driven values (chart bar widths, progress percentages, dynamic transforms). Everything
static becomes a class or a token. Expect roughly 85% to be removable.

**Done when:** each scale has one definition and a stylelint rule rejects off-scale values.

---

## P5 — Interaction layer (3 days)

This is where "functional" becomes "premium".

### 5.1 Replace 27 native `alert()` / `confirm()`

Blocking browser dialogs in a Radix-based UI read as unfinished. Build one
`useConfirm()` hook over Radix `AlertDialog`, then sweep. Destructive actions get a
distinct danger treatment and require the action name to be re-read, not just clicked.

### 5.2 Turn on the toast system

`react-hot-toast` is installed with **zero** call sites. Every mutation should confirm
itself in the same place, same style, same duration. Define four variants (success, error,
loading→resolved, undo) and route every `useMutation` through them.

Prefer optimistic updates with an undo toast over spinner-then-refetch — react-query is
already there, and it is the single biggest perceived-speed win available.

### 5.3 Focus and keyboard

45 outline-removal declarations exist against 35 `:focus-visible` rules. Every interactive
element needs a visible focus ring — one token, applied once at the base layer. Then:
`CommandPalette.tsx` already exists, so wire global shortcuts (`⌘K` palette, `/` search,
`esc` close, `⌘↵` submit) and make every modal focus-trap and restore focus on close.

### 5.4 Form feedback

Inline validation on blur, error text tied to the input via `aria-describedby`, submit
buttons that show pending state and cannot double-fire.

---

## P6 — State completeness (3–4 days)

Every panel must handle all five states. There are ~21 module panels and 24 files with some
empty-state handling — so coverage is partial and inconsistent.

| State | Requirement |
|---|---|
| Loading | Skeleton matching final layout — never a bare spinner, never layout shift |
| Empty | Illustration + one-line explanation + primary action |
| Partial | Stale-data banner while refetching, never a blank flash |
| Error | What failed, whether it is retryable, a retry button — never a raw message |
| Denied | Clear "you do not have access", not an empty table |

468 loading/skeleton references already exist — this is about consistency, not building from
scratch. Extract one `<PanelState>` component and route every panel through it.

**Done when:** a checklist pass over all module panels shows all five states present.

---

## P7 — The premium layer (1 week)

Everything above gets to 7. This is what gets to 9.

### 7.1 Density and rhythm
Pick one vertical rhythm and hold it across every panel. Tables get a density toggle
(comfortable / compact) since this is an operations tool people live in all day.

### 7.2 Data tables
`AdminDataTable.tsx` exists — make it the only table. Sticky header, column resize, sort
indicators, row selection with a bulk action bar, keyboard row navigation, sensible
truncation with tooltip on overflow. Numeric columns right-aligned and tabular-figure
aligned.

### 7.3 Motion choreography
Modals scale-and-fade from origin, panels slide with a shared easing, list items stagger
under 30ms. All of it inside `prefers-reduced-motion` guards. Motion should explain
relationships, not decorate.

### 7.4 Typography
One scale, tabular figures for all numeric data, consistent truncation. Bengali text needs
its own line-height — `--font-noto-bengali` is already wired but rhythm against Inter has
not been checked.

### 7.5 Charts
`recharts` is present. One chart theme derived from the tokens, consistent axis/grid/tooltip
treatment, and colorblind-safe series colors.

---

## P8 — Regression armor (2 days) · do not skip

Without this, everything above decays. The `/login` bug is in brand-new uncommitted work —
the decay rate is currently faster than the build rate.

| Gate | Blocks |
|---|---|
| Contrast probe (P1.2) | Any WCAG AA failure on any route |
| Stylelint: no raw hex outside tokens | Token bypass |
| Stylelint: no `!important` outside an `overrides` layer | Return of the specificity war |
| Stylelint: off-scale spacing / radius / duration | Scale drift |
| Playwright visual snapshots, desktop + mobile | Unintended visual change |
| `eslint-plugin-jsx-a11y` | Missing labels, roles, keyboard handlers |
| Bundle size budget | Silent weight creep |

Adopt CSS cascade layers (`@layer tokens, base, layout, components, overrides`) at the same
time — layer order beats specificity, which removes the *reason* to reach for `!important`
rather than just banning it.

---

## Sequence

| Phase | Effort | Depends on |
|---|---|---|
| P1 Stop the bleeding | 0.5 d | — |
| P2 Token system | 2 d | P1 |
| P3 Break up globals.css | 3–4 d | P2 |
| P4 Real scales | 2–3 d | P2 |
| P5 Interaction layer | 3 d | P2 (parallel with P3/P4) |
| P6 State completeness | 3–4 d | P5 |
| P7 Premium layer | 5 d | P3, P4, P6 |
| P8 Regression armor | 2 d | rolls in from P1 onward |

**~3.5 weeks.** P1 ships today. P1+P2+P5 alone (about a week) takes it to roughly 7.5.

---

## Blocker: I have not seen the authenticated UI

Everything above the login screen is verified from code and measurement only. The dashboard,
catalog, orders and finance panels are behind Telegram OTP, and I will not enter credentials.

P6 and P7 in particular need real inspection — state coverage and density judgements cannot
be made from CSS alone. To unblock: sign in yourself in the browser pane and leave the
session open. I can then screenshot, probe contrast, and test keyboard flows on every panel
without ever handling the credentials.

Until then, treat P6 and P7 scope as estimated rather than measured.
