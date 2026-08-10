# Workflows

End-to-end flows this project supports — pointing Grimoire at a library, adding
a UI component, cutting a desktop build — written from the operator's point of
view. List them:

    okq find --type workflow

There is no `okq new` template for workflows yet; copy an existing workflow doc
(or start from this frontmatter shape):

```yaml
---
type: workflow
title: Short imperative title
description: One-line summary of the flow.
tags: []
status: draft
---
```

Body convention: **When to use** / **Steps** / **Verify** — keep each step
runnable.
