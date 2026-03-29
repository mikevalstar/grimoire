# Writing good features and requirements

Use this guide as a default when creating or updating grimoire features and requirements. If the project has its own writing conventions or the user has specified a preferred format, defer to those instead.

These documents are consumed by AI agents with limited context windows. Every word must earn its place — use bullet points, not paragraphs.

## Features

Features describe broad capabilities. Every feature body should include:

- **Why** (required) — 1-2 sentences. What problem does this solve? Why does it matter? Without this, agents can't make good scope or tradeoff decisions.
- **What** — brief description of the capability. Keep it high-level.
- **Acceptance criteria** — short bullet list of "done when..." conditions. Helps agents know when to stop.
- **Non-goals** (encouraged) — what this deliberately does _not_ cover. Prevents scope creep and gold-plating.

Example body:

```markdown
Hybrid search combining full-text and semantic vector search over all grimoire documents.

**Why:** AI agents need to quickly find relevant context without reading every file. Keyword search alone misses semantic matches; vector search alone misses exact terms.

**Acceptance criteria:**

- FTS via DuckDB fts extension with BM25 scoring
- Vector search via HNSW index on embeddings
- Results merged and deduplicated with combined ranking
- <500ms for typical queries

**Non-goals:**

- No cross-repository search
- No external search provider integration
```

## Requirements

Requirements are specific breakdowns of a feature. They inherit the "why" from their parent, so focus on the "what" and "how":

- **Why** (if not obvious from parent) — only if the requirement's motivation isn't clear from the parent feature.
- **What** — specific behavior or implementation detail.
- **Acceptance criteria** (required) — concrete, testable conditions.

Non-goals are optional for requirements since they're already narrow in scope.

## Tasks

Tasks are actionable work items — the thing an agent or developer picks up and does. They inherit motivation from their parent requirement/feature, so don't repeat the "why."

- **What to do** — clear, actionable description. An agent should be able to start immediately without guessing.
- **Done criteria** — concrete, verifiable conditions. "Update the function" is vague; "function returns X given Y" is testable.
- **Scope / relevant files** — what files or areas are affected.
- **Golden master references** (encouraged) — point to existing files or patterns to follow. e.g., "See `search.ts` for the query pattern." Saves agents from exploring blindly.
- **Testing criteria** (when possible) — how to verify the work. Expected test cases, commands to run, behavior to assert.

Tasks should be scoped to what a mid-range developer could complete in ~2.5 days or less. If it's bigger, break it into subtasks.

Tasks do _not_ need a separate "why", "non-goals", or "acceptance criteria" section — the done criteria and testing criteria in the body serve that purpose.

## General principles

- **Be terse.** These docs fill AI context windows. No filler, no restating the title in the body.
- **Bullet points over prose.** Easier to scan, less ambiguous.
- **Features explain why; requirements explain what.** Don't repeat the parent feature's motivation in every child requirement.
