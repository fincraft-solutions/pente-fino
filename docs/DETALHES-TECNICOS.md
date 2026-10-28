# Pente-Fino

Revisão do DAS de MEI e Simples Nacional. Procura imposto **pago a mais** (a recuperar) e **pago a menos** (risco de autuação) nos últimos 5 anos e entrega um relatório com o valor estimado, a explicação e o próximo passo de cada achado.


## Como funciona

Todo cálculo é feito por **regras determinísticas** em TypeScript, com as tabelas do Simples em `dados/`. A IA é opcional e só escreve um resumo em linguagem simples a partir do diagnóstico pronto (`--com-ia`). Assim, o número que aparece para o cliente é sempre auditável.

Regras atuais, na ordem do roadmap:

| Etapa | Regra | Público | O que encontra |
|---|---|---|---|
| a | `duplicidade` | MEI e Simples | DAS pago duas vezes na mesma competência; guia paga depois da baixa |
| a | `teto-mei` | MEI | faturamento acima do limite (DAS complementar ou desenquadramento retroativo) |
| a | `limite-simples` | Simples | RBT12 acima de R$ 4,8 milhões (exclusão do Simples; os demais valores da competência deixam de ser confiáveis) |
| b | `fator-r` | Simples | serviço declarado no Anexo V com Fator R ≥ 28% (ou o contrário) |
| c | `monofasico` | Simples | revenda de produto monofásico sem segregação no PGDAS-D |

Pagamentos a mais feitos há mais de 5 anos saem do total. O prazo conta da **data do pagamento** (CTN, art. 168, I), dia a dia; quando ela não é conhecida, usa o vencimento do DAS.

A entrada é validada antes das regras (`src/validacao.ts`): registros com competência, data ou valor inválidos são descartados com aviso em vez de virarem valor errado no total, `regime` aceita maiúsculas ou minúsculas e a mesma guia importada duas vezes (mesmo `numeroDocumento`) não conta como duplicidade.

## Começar

```bash
npm install
npm test
npm run diagnosticar -- exemplos/mei.json
npm run diagnosticar -- exemplos/simples-servicos.json --referencia 2026-10-24
npm run diagnosticar -- exemplos/simples-comercio.json --json
npm run diagnosticar -- exemplos/simples-comercio.json --com-ia   # precisa de ANTHROPIC_API_KEY no .env
```

O relatório em Markdown é salvo em `saida/`. Os exemplos são empresas fictícias.

## Parametrização

| O quê | Onde | Skill |
|---|---|---|
| Formato de entrada e integração com o Wavern | `src/tipos.ts` (`EmpresaPenteFino`) | `conectar-dados` |
| Tabelas dos anexos, Fator R, limite do MEI por ano (R$ 81 mil até 2026, R$ 110 mil em 2027 e R$ 140 mil a partir de 2028, LC 238/2026), prazo | `dados/parametros.json` | `adicionar-regra` |
| Lista de NCM monofásicos | `dados/ncm-monofasicos.json` | `adicionar-regra` |
| Novas regras | `src/regras/` + registro em `src/regras/index.ts` | `adicionar-regra` |
| Texto do resumo com IA | `prompts/resumo.md`; modelo em `PENTE_FINO_MODELO` | — |

## Estrutura

```
src/
  diagnostico.ts   valida a entrada, roda as regras, aplica o prazo de 5 anos e soma os totais
  validacao.ts     confere e normaliza a entrada
  regras/          uma regra por arquivo
  simples.ts       alíquota efetiva, faixas, datas
  relatorio.ts     relatório em Markdown (sem IA)
  resumo-ia.ts     resumo em linguagem simples (opcional; não envia CNPJ, razão social nem evidências)
  cli.ts           npm run diagnosticar
  tipos.ts         contrato de entrada e saída
dados/             tabelas e listas parametrizáveis
exemplos/          empresas fictícias
```

## Antes de usar em produção

- `dados/parametros.json` e `dados/ncm-monofasicos.json` estão **não verificados** (`verificado_em: null`). A lista de NCM é um exemplo incompleto. Enquanto isso, o relatório avisa que os valores são de demonstração.
- Valide os resultados com um contador em casos reais conhecidos antes de mostrar valores a clientes.
- Os valores são estimativas; o texto do relatório já deixa isso claro.
