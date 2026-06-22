---
ovd-plan: true
version: 3
project: "Smoke Test App"
description: "A small realistic plan tree for the cross-pipeline smoke test."
created: 2026-06-22
updated: 2026-06-22
deliberation_status: executing
active_node: "I.1"
current_milestone: "I. Foundation"
session_count: 0
---

# Smoke Test App

## I. Foundation []

```yaml ovd-plan
skills: [planning-first]
confidence: high
```

### I.1 Project scaffolding []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [src/index.ts]
  out: []
success:
  - App boots
deps: []
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

### I.2 Database schema []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [src/db/schema.ts]
  out: []
success:
  - Tables created
deps: [I.1]
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

### I.3 Config loader []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [src/config.ts]
  out: []
success:
  - Config parses
deps: [I.1]
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

## II. Features []

```yaml ovd-plan
skills: [design-taste-frontend]
```

### II.1 Widgets []

#### II.1.a Widget layout []

```yaml ovd-plan
skills: [design-taste-frontend]
scope:
  in: [src/widgets/layout.tsx]
  out: []
success:
  - Layout renders
deps: [I.1]
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

#### II.1.b Widget data []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [src/widgets/data.ts]
  out: []
success:
  - Data fetches
deps: [II.1.a]
verify:
  method: api_response_check
  review_required: true
```

### II.2 Polish []

#### II.2.a Styling []

```yaml ovd-plan
skills: [design-taste-frontend]
scope:
  in: [src/styles/app.css]
  out: []
success:
  - Styles applied
deps: [II.1.a]
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

#### II.2.b Accessibility []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [src/a11y.ts]
  out: []
success:
  - Keyboard nav works
deps: [II.2.a]
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```

### II.3 Docs []

```yaml ovd-plan
skills: [modern-web-guidance]
scope:
  in: [README.md]
  out: []
success:
  - Docs updated
deps: [II.1.a]
verify:
  method: agent_self_check_against_success_criteria
  review_required: true
```
