# eslint-plugin-heuci

**HeuCI: Embedding Nielsen's Usability Heuristics in CI/CD Pipelines**

An ESLint plugin that operationalizes Nielsen's usability heuristics as automated code checks for React and Angular projects. Integrates directly into CI/CD pipelines (GitHub Actions, Jenkins, GitLab CI) for proactive usability assurance.

## Overview

HeuCI implements 12 rules derived from Nielsen's usability heuristics through a rigorous three-phase operationalization process (37 candidate rules → 19 validated → 12 final). The rules combine static analysis (ESLint AST traversal) with dynamic analysis (Puppeteer-based runtime testing).

| Rule | Heuristic | Method | Category |
|------|-----------|--------|----------|
| H01 | Visibility of system status | Static | Consistency |
| H02 | Visibility of system status | Static | Consistency |
| H03 | Consistency and standards | Static | Consistency |
| H04 | Error prevention | Static | Error Prevention |
| H05 | Error prevention | Static | Error Prevention |
| H06 | Recognition rather than recall | Static | Recognition |
| H07 | Recognition rather than recall | Static | Recognition |
| H08 | Aesthetic and minimalist design | Static | Accessibility |
| H09 | Help users with errors | Static | Error Prevention |
| H10 | Accessibility | Static | Accessibility |
| H11 | Navigation consistency | Dynamic | Navigation |
| H12 | Responsiveness | Dynamic | Responsiveness |

## Installation

```bash
npm install eslint-plugin-heuci --save-dev
```

For dynamic analysis rules (H11, H12):
```bash
npm install puppeteer --save-dev
```

## Configuration

### ESLint Config (Static Rules)

```json
{
  "plugins": ["heuci"],
  "extends": ["plugin:heuci/recommended"]
}
```

### Strict Mode (All Rules as Errors)

```json
{
  "plugins": ["heuci"],
  "extends": ["plugin:heuci/strict"]
}
```

### Individual Rule Configuration

```json
{
  "plugins": ["heuci"],
  "rules": {
    "heuci/loading-indicator-required": "warn",
    "heuci/destructive-action-confirmation": "error",
    "heuci/aria-label-presence": "error"
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: HeuCI Usability Checks
on: [push, pull_request]
jobs:
  usability:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Static Analysis
        run: npx eslint --plugin heuci --ext .jsx,.tsx src/
      - name: Dynamic Analysis
        run: |
          npm start &
          sleep 5
          node node_modules/eslint-plugin-heuci/lib/dynamic/H11-navigation-flow-consistency.js --url http://localhost:3000
          node node_modules/eslint-plugin-heuci/lib/dynamic/H12-responsive-breakpoints.js --url http://localhost:3000
```

### Jenkins Pipeline

```groovy
pipeline {
  agent any
  stages {
    stage('Usability Checks') {
      steps {
        sh 'npx eslint --plugin heuci --ext .jsx,.tsx src/'
        sh 'node node_modules/eslint-plugin-heuci/lib/dynamic/H11-navigation-flow-consistency.js --url $APP_URL'
      }
    }
  }
}
```

### GitLab CI

```yaml
usability:
  stage: test
  script:
    - npx eslint --plugin heuci --ext .jsx,.tsx src/
    - node node_modules/eslint-plugin-heuci/lib/dynamic/H11-navigation-flow-consistency.js --url $APP_URL
```

## Exemptions

Configure project-specific exemptions in `.heuci.config.json`:

```json
{
  "exemptions": [
    {
      "rule": "button-styling-consistency",
      "context": "components/DomainSpecific/*.jsx",
      "reason": "Domain-specific terminology for expert users"
    }
  ]
}
```

## Research

This tool accompanies the paper:

> Nwasra, N., Alraddadi, A.S., & Arafah, M. (2026). "Embedding Usability Heuristics in CI/CD Pipelines: A Mixed-Methods Approach for Proactive UX Assurance."

- **Dataset**: [Zenodo](https://doi.org/10.5281/zenodo.18749928)


## License

MIT
