**Idioma:** [English](README.md) | **Português (Brasil)**

# Pente-Fino

```text
   ___
  | __|   FINCRAFT / PENTE-FINO
  | _|
  |_|
```

**O Pente-Fino examina cenários de DAS para MEI e Simples Nacional e destaca itens que merecem conferência. Cada apontamento identifica a regra utilizada para que o cálculo possa ser revisado.**

## Primeiros passos

Requer Node.js 22.20 ou superior. Clone o repositório e rode o exemplo:

```bash
npm ci
npm run diagnosticar -- exemplos/simples-comercio.json
```

O relatório em Markdown fica em `saida/simples-comercio.md`. Adicione `--json` para ver o resultado estruturado. O exemplo funciona localmente, sem configurar um provedor de IA.

## O que você encontra

- **Regras abertas.** As verificações ficam em `src/regras/`.
- **Apontamentos legíveis.** Cada item apresenta o motivo da sinalização.
- **Cenários variados.** Explore exemplos de comércio, serviços e MEI.

## Para explorar

[Exemplo de comércio](exemplos/simples-comercio.json) · [Verificações](src/regras/) · [Relatório](src/relatorio.ts) · [Guia técnico](docs/pt-BR/guide.md)

## Integração

O resumo opcional por IA fica isolado em `src/resumo-ia.ts`. As verificações fiscais são feitas por regras explícitas no código.

## Sobre o projeto

O repositório oferece cenários para exploração técnica. Tabelas e classificações precisam ser conferidas conforme a competência antes de uso profissional.

[Como contribuir](CONTRIBUTING.pt-BR.md) · [Notas de versão](CHANGELOG.pt-BR.md) · [Fincraft](https://github.com/fincraft-solutions)
