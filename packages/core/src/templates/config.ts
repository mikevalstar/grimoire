/**
 * Default config.yaml template for grimoire init.
 */
export function configTemplate(name: string, description: string): string {
  return `project:
  name: "${name}"
  description: "${description}"

embedding:
  provider: local # local | ollama | openai | anthropic
  model: nomic-embed-text-v1.5

search:
  default_limit: 10
  semantic_weight: 0.5
  keyword_weight: 0.5

ui:
  port: 4444
  auto_open: true

sync:
  auto_sync: true
  watch: false

ids:
  auto_generate: true
  prefix_by_type: true
`;
}
