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

## General principles

- **Be terse.** These docs fill AI context windows. No filler, no restating the title in the body.
- **Bullet points over prose.** Easier to scan, less ambiguous.
- **Features explain why; requirements explain what.** Don't repeat the parent feature's motivation in every child requirement.
