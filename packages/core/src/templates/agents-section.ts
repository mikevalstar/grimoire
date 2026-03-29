/**
 * Section injected into CLAUDE.md between grimoire marker tags.
 *
 * This is the template that `grimoire init` inserts when it doesn't
 * find <!--GRIMOIRE START--> / <!--GRIMOIRE END--> in the agents file.
 */
export const agentsSectionTemplate = `<!--GRIMOIRE START-->
<!-- This section is managed by Grimoire AI. Do not edit manually. -->

## Grimoire AI — Project Knowledge

This project uses [Grimoire AI](https://grimoireai.quest) for requirements management.
Project knowledge (features, requirements, tasks, and architecture decisions) is stored
as structured markdown files in the \`.grimoire/\` directory.

### Quick Reference

- **Read the overview:** \`grimoire overview\`
- **Get context for a task:** \`grimoire context "<description of what you're working on>"\`
- **Search documents:** \`grimoire search "<query>"\`
- **List documents:** \`grimoire <type> list\` (types: feature, requirement, task, decision)
- **View a document:** \`grimoire <type> get <id>\`
- **Create a document:** \`grimoire <type> create --title "<title>" --body "<content>"\`
- **Update status:** \`grimoire <type> update <id> --status <status>\`
- **Log progress:** \`grimoire log <id> "<message>"\`
- **Add a comment:** \`grimoire comment <id> "<message>"\`

For AI agent skills, run: \`npx skills add mikevalstar/grimoire\`

<!--GRIMOIRE END-->`;
