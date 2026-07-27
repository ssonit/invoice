@AGENTS.md

## Development workflow & conventions

- Code conventions and standing rules: [`.claude/rules/`](.claude/rules/) — topic-scoped
  files, loaded automatically as relevant files are touched (see each file's `paths:`
  frontmatter). Update the relevant file there when a new convention is decided; don't
  dump everything into one file.
- Plan → code → test → security review → deploy workflow:
  [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

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
