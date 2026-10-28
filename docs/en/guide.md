**Language:** **English** | [Português (Brasil)](../pt-BR/guide.md)

# Working with Pente-Fino

[Back to Pente-Fino](../../README.md)

## Starting point

Pente-Fino inspects sample DAS scenarios from MEI and Simples Nacional and highlights items worth a closer look. Every finding points to the rule that raised it, so a specialist can retrace the calculation.

The first example in the README is the easiest route through the project:

```bash
npm ci
npm run diagnosticar -- exemplos/simples-comercio.json
```

## Components

- `exemplos/`: commerce, services and MEI scenarios.
- `src/diagnostico.ts`: organizing checks and findings.
- `src/regras/`: individual detection rules.
- `src/relatorio.ts`: human-readable report generation.
- `src/resumo-ia.ts`: optional explanation layer.
- `dados/`: sample parameters and classifications.

## Integration notes

For a structured result, add `--json` to the command. The rules are inspectable TypeScript. For a current case, verify the reference period, tables and classification assumptions before relying on the output.

## Development

```bash
npm ci
npm run typecheck
npm test
```

The repository is built around Node.js 22.20 or newer.
