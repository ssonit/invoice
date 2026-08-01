@AGENTS.md

## Development workflow & conventions

- Code conventions and standing rules: [`.claude/rules/`](.claude/rules/) — topic-scoped
  files, loaded automatically as relevant files are touched (see each file's `paths:`
  frontmatter). Update the relevant file there when a new convention is decided; don't
  dump everything into one file.
- Plan → code → test → security review → deploy workflow:
  [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

### Multi-terminal worktree workflow

When working across multiple terminals in parallel, isolate each task in a git worktree
so branches never collide:

```
# Terminal 1 — start a new task
git worktree add -b feature/xyz .claude/worktrees/xyz
cd .claude/worktrees/xyz

# ... code the feature ...

# Before merging: quality gate (all 3 must pass)
npm run test && npm run lint && npx tsc --noEmit

# Merge back
git checkout main
git merge feature/xyz
git branch -d feature/xyz
git worktree remove .claude/worktrees/xyz

# Keep the graph in sync with the merged result
graphify update .
```

| Step | Command | What it catches |
|------|---------|-----------------|
| 1. Test | `npm run test` | Unit test regressions (Vitest, 358 tests) |
| 2. Lint | `npm run lint` | React/TS code quality, unused vars, hook rules |
| 3. Type-check | `npx tsc --noEmit` | Type errors across the whole project |
| 4. Graphify | `graphify update .` | Refresh knowledge graph after merge |

**Rules of thumb:**
- Never skip the quality gate — a failing step = don't merge yet.
- Run `graphify update .` on the merged branch (main), not inside the worktree.
- Each worktree is disposable — if a task goes sideways, just delete the worktree and
  branch, main stays untouched.
- See `.claude/rules/testing.md` for test conventions.

## Knowledge graphs — priority order

**Graphify is the default.** Use it before Grep/Glob/Read and before code-review-graph MCP for ordinary codebase exploration.

| Priority | Tool | Use for |
| -------- | ---- | ------- |
| 1 | **graphify** CLI | Architecture, “how does X work?”, paths between symbols, concept explain |
| 2 | **code-review-graph** MCP | PR/diff review, blast radius, execution flows, test coverage |
| 3 | Grep / Glob / Read | After graphify oriented you, or if `graphify-out/graph.json` is missing |

### 1. graphify (default)

When `graphify-out/graph.json` exists:

- `graphify query "<question>"` — scoped subgraph (prefer over raw grep)
- `graphify path "<A>" "<B>"` — relationship between two symbols
- `graphify explain "<concept>"` — focused neighborhood

Also:

- If `graphify-out/wiki/index.md` exists, navigate it instead of raw source browsing
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review when query/path/explain are not enough
- After modifying code, run `graphify update .` (AST-only, no API cost)
- Skill trigger: `/graphify` → `.claude/skills/graphify/SKILL.md`

### 2. code-review-graph MCP (secondary)

Use **after** graphify, or when the task is explicitly review/impact:

- Exploring still stuck after graphify → `semantic_search_nodes_tool` / `query_graph_tool`
- Understanding impact of a change → `get_impact_radius_tool`
- Code review / PR → `detect_changes_tool` + `get_review_context_tool`
- Execution paths → `get_affected_flows_tool` / `list_flows_tool`
- Architecture overview communities → `get_architecture_overview_tool` + `list_communities_tool`
- Coverage → `query_graph_tool` pattern=`tests_for`

Fall back to Grep/Glob/Read **only** when neither graph covers what you need.
