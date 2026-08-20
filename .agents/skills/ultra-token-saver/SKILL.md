---
name: ultra-token-saver
description: >-
  Minimum-token execution mode for coding tasks. No narration, no progress
  commentary, inspect less, change minimally, 8-line final report. Use on EVERY
  implementation, edit, debug, fix, search, and Banglish request (thik koro,
  fix koro, problem ki). Trigger: ultra token saver, do not narrate, token
  saver, execution mode, inspect less, silent execution.
---

# ULTRA TOKEN SAVER — EXECUTION MODE

## Primary Rule

Use the minimum possible tokens while completing the task correctly.

**Code/actions > explanations.**

Never spend tokens narrating work that can simply be done.

## Communication Rules

- Do not narrate your thinking.
- Do not explain obvious steps.
- Do not repeat the user's request.
- Do not write progress commentary such as:
  - "Now I will..."
  - "Next, I'll..."
  - "Let me inspect..."
  - "I found..."
  - "Great..."
  - "Perfect..."
  - "Let's..."
- Do not provide tutorials unless explicitly requested.
- Do not provide background information unless necessary.
- Do not repeat information already established.
- Do not paste large unchanged code sections.
- Do not describe every file inspected.
- Do not summarize tool output unless it affects the result.
- Do not generate large tables/reports unless requested.
- Do not suggest unrelated improvements.
- Do not create extra documentation unless requested.

## Execution Rules

When given a coding task:

1. Inspect only what is necessary.
2. Search before opening large files.
3. Read the smallest relevant code range.
4. Reuse existing architecture and utilities.
5. Make the smallest correct change.
6. Do not refactor unrelated code.
7. Do not modify unrelated files.
8. Do not create duplicate abstractions.
9. Run only relevant tests/checks first.
10. Expand investigation only when evidence requires it.

## Tool Efficiency

Prefer targeted operations.

BAD:
- Reading entire repository.
- Opening many files "just in case".
- Re-running the same search.
- Running full test suites after every tiny edit.
- Printing huge logs.
- Re-reading files whose relevant content is already known.

GOOD:
- Search exact symbols/routes/components first.
- Read only relevant ranges.
- Batch independent searches where possible.
- Patch precisely.
- Run focused validation.
- Run full validation only when required or at the final gate.

## Response Format

During execution, remain silent unless:

- user input is required,
- a blocker occurs,
- a dangerous/ambiguous decision requires confirmation.

After successful completion, respond with only:

**Done.**
- Changed: `<very short description>`
- Validation: `<PASS/FAIL + essential checks>`
- Issues: `<None or essential blocker>`

Maximum default final response: **8 lines**.

If nothing important needs explanation:

**Done — task completed and validated.**

## Failure Reporting

If something fails, report only:

**Blocked:** `<exact problem>`

**Need:** `<what is required to continue>`

Do not add speculation or lengthy explanation.

## Large Tasks

For long multi-phase tasks:

- Maintain an internal checklist.
- Do not print the checklist repeatedly.
- Do not announce each phase.
- Continue automatically through safe steps.
- Report only meaningful blockers.
- Give one compact final report.

## Existing Project Rule

Before implementing something new, check whether the project already has:

- an equivalent utility,
- service,
- component,
- hook,
- API,
- schema,
- helper,
- configuration,
- test pattern.

Reuse existing implementation whenever appropriate.

Do not create a second code path unnecessarily.

## Scope Discipline

Implement exactly what was requested.

Do NOT:

- redesign unrelated UI,
- rename unrelated files,
- reorganize folders,
- upgrade unrelated dependencies,
- perform speculative cleanup,
- add "nice to have" features,
- rewrite working code merely for style.

## Exception

Spend additional tokens only when necessary for:

- correctness,
- security,
- preventing data loss,
- resolving ambiguity that could cause a wrong implementation,
- debugging an actual failure,
- validating critical behavior.

Correctness always has priority over token saving.

## Final Principle

**Inspect less. Read precisely. Change minimally. Validate intelligently. Report briefly.**
