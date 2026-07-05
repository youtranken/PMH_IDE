## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Coding Guidelines (Karpathy)

> Source: https://github.com/multica-ai/andrej-karpathy-skills (CLAUDE.md, verbatim)
> Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.
> **Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

### 5. Verify For Real (green tests are not enough)

A passing test suite is necessary, not sufficient. Before declaring done,
verify with the tool that matches the medium — and actually use it:
- Frontend/UI → open it in a browser (playwright / agent-browser) and look.
- Workflow/flow → click through it end-to-end.
- Deploy → check which environment you're on.
- PR → review the actual diff.

Never trust a self-reported "completed successfully." If a verification tool
is needed, the goal must name it and require its use before stopping.

### A good goal is an operating contract, not a clever prompt

State all five: **Outcome + Scope + Constraints + Verification + Stop rules.**
- Scope/Constraints are hard boundaries (e.g. "dev/staging only, never deploy
  to production"). Enforce hard boundaries with permissions, not trust — context
  drifts after compaction; the agent does not reliably remember earlier limits.
- Vague outcomes ("make it better/nicer") are a license to wander. Define what
  "better" means measurably (spacing, contrast, mobile, fewer steps…). The human
  decides this; if you don't know what you want, brainstorm/plan/write acceptance
  criteria first — don't hand it to a goal-driven loop.

## BMad coordination

- Plan phases (PRD / Architecture / Epics): apply "Think Before Coding" fully — surface assumptions and ask before deciding.
- Dev phase (Story): a story's acceptance criteria ARE the success criteria for "Goal-Driven Execution" — loop on them. Only stop to ask when the story is genuinely missing information, not for every small assumption.
- Use the full BMad chain (PRD → Architecture → Epics → Stories) for large/greenfield work; use `bmad-quick-dev` or a single story for small fixes.

## Tool routing (avoid BMad / superpowers overlap)

BMad and superpowers sit at different layers — BMad is the planning/spec spine, superpowers is execution discipline. Pick one tool per job:

- Planning spine (PRD, Architecture, Epics, Stories): **BMad**.
- Brainstorm / write plan: **BMad** (`bmad-brainstorming`, BMad planning) — it feeds the PRD/Story chain. Do not also run `superpowers:brainstorming` for the same work.
- Implementation discipline: **superpowers** — `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `using-git-worktrees`. (BMad has no equivalent; use these inside `bmad-dev-story` / `bmad-quick-dev`.)
- UI verification: **playwright** MCP tools (`browser_navigate`, `browser_snapshot`, `browser_take_screenshot`) — this is how "Verify For Real" gets enforced.
- Code review: pick ONE — `/code-review` (built-in) for the working diff; `bmad-code-review` only when you want BMad's adversarial multi-layer pass. Don't run both.
- UI/visual design: **frontend-design**.
