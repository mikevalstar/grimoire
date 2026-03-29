/**
 * Default overview.md template for grimoire init.
 */
export function overviewTemplate(name: string, description: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `---
id: overview
title: "${name}"
description: "${description}"
type: overview
created: ${today}
updated: ${today}
tags: []
---

# ${name}

${description}

---

## Changelog

### ${today} | grimoire
Initial project overview created via grimoire init.
`;
}
