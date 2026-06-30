# SPLARO Agent Instructions

This repository uses the **splaro-platform** Cursor skill for full project context.

## For Cursor AI

Before any task, apply skill: `.cursor/skills/splaro-platform/SKILL.md`

Also read `AI_GUIDE.md` for design system and module workflow.

## For in-app AI (SPLARO Command)

Platform knowledge is injected automatically via:
- `apps/api/src/modules/agent/prompts/system.prompt.ts`
- `apps/api/src/modules/agent/prompts/platform-knowledge.prompt.ts` (always appended)

Restart API after prompt changes: `pnpm dev:api`

## Dev stack

```bash
pnpm dev:stack   # web :3000 + admin :3001 + api :4000
```

## Owner preferences

- Communicates in Bangla / Banglish / English — match their language
- Wants honest feedback (red errors, green only for real success)
- **Never fake success** — if API/save fails, show red error toast; never green "saved" without verified server response
- Telegram is primary mobile command center
- Never fake UI success when API/integration is not connected

## Key paths

| Area | Path |
|------|------|
| Storefront | `apps/web/` |
| Admin | `apps/admin/` |
| API | `apps/api/` |
| Database | `packages/database/` |
| Agent | `apps/api/src/modules/agent/` |
