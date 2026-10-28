# Pente-Fino

```text
   ___  __________
  |   ||   _____ /   FINCRAFT
  |___||  |____/    OPEN LAB
       |  |
       |__|
```

**Antes de chamar algo de erro, mostre a regra que encontrou o indício.**


Um diagnóstico local de possíveis inconsistências no DAS, com foco em regras auditáveis. O Pente-Fino tenta organizar **hipóteses para conferência**: dados de entrada, regra acionada e motivo da sinalização. Um modelo de linguagem pode resumir o relatório, mas **não calcula nem define tributo**.

> **Estado:** demonstração técnica. Tabelas fiscais e classificações NCM são parciais e precisam de validação de vigência; nenhum resultado é laudo, crédito ou restituição confirmada.

## Veja um diagnóstico acontecer

```bash
# Node.js 22.20+, sem API externa no fluxo abaixo
npm ci
npm run typecheck
npm test
npm run diagnosticar -- exemplos/simples-comercio.json
```

O relatório Markdown é salvo em `saida/simples-comercio.md`. Quer examinar a estrutura do resultado, sem saída narrativa? Execute:

```bash
npm run diagnosticar -- exemplos/simples-comercio.json --json
```

Compare também [`exemplos/simples-servicos.json`](exemplos/simples-servicos.json) e [`exemplos/mei.json`](exemplos/mei.json). São empresas fictícias, não simulações fiscais homologadas.

## Como é dividido

- [`src/diagnostico.ts`](src/diagnostico.ts): hipóteses e regras de detecção.
- [`src/relatorio.ts`](src/relatorio.ts): justificativas legíveis e encaminhamentos.
- [`src/resumo-ia.ts`](src/resumo-ia.ts): resumo **opcional**; não altera as contas.
- [`dados/`](dados/): parâmetros exemplificativos, sujeitos a revisão periódica.

## Os limites importam

Uma divergência sinalizada não é cobrança irregular demonstrada; uma conta baseada em tabela parcial não calcula o valor recuperável. A validação final depende de documentos, competência, legislação e profissional responsável.

**Continue por:** [detalhes técnicos](docs/DETALHES-TECNICOS.md) · [limites](STATUS.md) · [testes](test/) · [como contribuir](CONTRIBUTING.md) · [licença](LICENCIAMENTO.md).

Projeto da [Fincraft](https://github.com/fincraft-solutions). Contribuições com contraexemplos sintéticos são especialmente bem-vindas.
