# Grimoire AI

Local-first, AI-native requirements management for software projects.

Grimoire stores project knowledge — features, requirements, tasks, and architecture decisions — as structured markdown files in your git repository. A CLI designed for AI coding agents provides fast, structured access to project context.

**Grimoire answers the question: "How does a new AI agent session get oriented in a project — fast?"**

## Quick start

```bash
# Install the CLI
npm install -g @grimoire-ai/cli

# Initialize grimoire in your project
grimoire init --name "My Project"

# Install AI agent skills (agentskills.io)
npx skills add mikevalstar/grimoire
```

## Usage

### Read project context

```bash
grimoire overview                          # Project overview
grimoire feature list                      # List all features
grimoire task list --status todo           # Find open work
```

### Create documents

```bash
grimoire feature create --title "User Authentication" --priority high --tag security
grimoire requirement create --title "OAuth 2.0 Login" --feature feat-xxxxx-user-authentication
grimoire task create --title "Setup Google OAuth" --requirement req-xxxxx-oauth-20-login
grimoire decision create --title "Use JWT Over Sessions" --status accepted
```

### Update and track progress

```bash
grimoire task update <id> --status in-progress
grimoire log <id> "Implemented OAuth callback handler" --author claude-code
grimoire comment <id> "Should we support SAML as well?"
```

### Web UI

```bash
grimoire ui                                # Launch web dashboard on port 4444
grimoire ui --port 8080                    # Custom port
```

The web UI provides a visual dashboard with document browsing, filtering, sorting, and rendered markdown.

### Validate

```bash
grimoire validate                          # Check for broken links, missing fields
```

## Document types

| Type            | Directory       | Purpose                              |
| --------------- | --------------- | ------------------------------------ |
| **overview**    | `overview.md`   | Single project overview              |
| **feature**     | `features/`     | High-level capabilities              |
| **requirement** | `requirements/` | Detailed specs, linked to features   |
| **task**        | `tasks/`        | Implementation work items            |
| **decision**    | `decisions/`    | Architecture Decision Records (ADRs) |

All documents are markdown files with YAML frontmatter, stored in `.grimoire/` and committed to git.

## How it works

```
.grimoire/
  overview.md          # Project overview
  config.yaml          # Configuration
  features/            # Feature documents
  requirements/        # Requirement documents
  tasks/               # Task documents
  decisions/           # Architecture decisions
  .cache/              # Gitignored — derived database
```

Markdown files are the source of truth. The database (DuckDB) is a derived cache that enables full-text search, semantic search, and relational queries — it's always rebuildable from files via `grimoire sync`.

## AI agent workflow

Grimoire is designed for AI coding agents (Claude Code, Cursor, Copilot, etc.) to consume. All commands output structured JSON by default.

```bash
# Agent starting work
grimoire overview                                    # Understand the project
grimoire task list --status todo                     # Find available work
grimoire task get <id>                               # Read task details
grimoire task update <id> --status in-progress       # Claim a task

# Agent recording progress
grimoire log <id> "Completed implementation"         # Log what was done
grimoire decision create --title "..." --body "..."  # Record decisions
grimoire task update <id> --status done              # Mark complete
```

Install the [agentskills.io](https://agentskills.io/home) skill to give your AI agent full knowledge of Grimoire commands:

```bash
npx skills add mikevalstar/grimoire
```

## Output format

All commands output JSON by default (AI mode). Use `--format cli` for human-readable output:

```bash
grimoire feature list --format cli
```

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, building, testing, and contributing.

## License

[MIT](LICENSE)
