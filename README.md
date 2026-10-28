**Language:** **English** | [Português (Brasil)](README.pt-BR.md)

# Pente-Fino

```text
   ___
  | __|   FINCRAFT / PENTE-FINO
  | _|
  |_|
```

**Turn a tax calculation into a reviewable case.**

Pente-Fino inspects sample DAS scenarios from MEI and Simples Nacional and highlights items worth a closer look. Every finding points to the rule that raised it, so a specialist can retrace the calculation.

## Try it

Requires Node.js 22.20 or newer. Clone the repository and run:

```bash
npm ci
npm run diagnosticar -- exemplos/simples-comercio.json
```

The Markdown report appears in `saida/simples-comercio.md`. Add `--json` to inspect the structured result. The example runs locally without an AI provider.

## What's inside

- **Rules you can inspect.** The checks live in `src/regras/`.
- **Readable findings.** Each item includes a rationale for review.
- **Several scenarios.** Explore the commerce, services and MEI examples side by side.

## Explore the code

[Commerce example](exemplos/simples-comercio.json) · [Checks](src/regras/) · [Report builder](src/relatorio.ts) · [Technical guide](docs/en/guide.md)

## Extend it

Optional AI summarization is isolated in `src/resumo-ia.ts`. Tax checks themselves run through explicit application rules.

## Project notes

This repository offers scenarios for technical exploration. Tax tables and classifications must be confirmed for the applicable period before professional use.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Fincraft](https://github.com/fincraft-solutions)
