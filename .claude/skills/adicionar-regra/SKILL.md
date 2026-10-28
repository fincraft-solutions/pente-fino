---
name: adicionar-regra
description: Criar ou ajustar uma regra de revisão do Pente-Fino (src/regras/), ou atualizar as tabelas do Simples e a lista de NCM monofásicos (dados/). Use quando surgir um novo tipo de imposto pago a mais ou a menos para detectar, quando a lei mudar as alíquotas ou quando um contador apontar um falso positivo.
---

# Adicionar ou ajustar uma regra do Pente-Fino

O Pente-Fino é **determinístico**: todo número sai de regras em TypeScript. A IA só redige o resumo (`src/resumo-ia.ts`) e nunca calcula. Mantenha assim, porque é o que torna o diagnóstico auditável.

## Anatomia de uma regra

Uma regra é uma função `(empresa, contexto) => Achado[]` (tipos em `src/tipos.ts`):

- `regra`: nome curto, igual à chave no registro.
- `competencia`: `AAAA-MM`. É a base do prazo de 5 anos.
- `tipo`: `pago_a_mais` (entra no total a recuperar), `pago_a_menos` (imposto faltando) ou `risco` (atenção, sem valor).
- `valorEstimado`: em reais, arredondado com `arredondar()`. Use zero quando não dá para calcular.
- `explicacao` e `proximoPasso`: frases para o empresário, sem jargão.
- `evidencias`: os números usados no cálculo, para o contador conferir.

## Passo a passo

1. Crie `src/regras/<nome>.ts` seguindo o modelo de `fator-r.ts` (a regra mais completa).
2. Registre em `src/regras/index.ts`, na ordem das etapas.
3. Se a regra precisar de um dado novo da empresa, acrescente o campo **opcional** em `src/tipos.ts` e documente em `conectar-dados`. A regra deve simplesmente não disparar quando o dado faltar.
4. Números da lei (alíquotas, limites, percentuais) vão em `dados/parametros.json`, nunca no código.
5. Escreva testes em `test/pente-fino.test.ts`: um caso que dispara, um que não dispara e um no limite (ex. Fator R exatamente 28%). Se fizer sentido para demonstração, crie também um arquivo em `exemplos/`.
6. Rode `npm run typecheck && npm test` e um exemplo: `npm run diagnosticar -- exemplos/<arquivo>.json`.

## O que já é feito centralmente

- **Validação:** `src/validacao.ts` roda antes das regras. A regra recebe competências `AAAA-MM`, datas `AAAA-MM-DD` e números finitos ≥ 0; campos opcionais inválidos chegam como `undefined` (nunca `null`). Campo novo da entrada precisa ser validado lá.
- **Prazo:** `src/diagnostico.ts` tira do total todo `pago_a_mais` pago há mais de `prazoRestituicaoMeses` (60) meses, contando da data do pagamento. Se a regra sabe a data exata, preencha `dataPagamento` no achado; senão vale a primeira guia da competência ou o vencimento do DAS.
- **Ordem e escape:** os achados são ordenados por tipo e valor, e o relatório escapa `|`, quebras de linha e HTML.

Cuidados que os testes já cobram: comparar valores monetários em centavos (`centavos()`), nunca com `===` em ponto flutuante; não gerar achado com diferença zero; não contar a mesma guia em duas regras.

## Ideias de próximas regras

- ICMS-ST: revenda de mercadoria com substituição tributária não segregada (mesma lógica do monofásico, com a parcela de ICMS do Anexo I).
- ISS retido na fonte pelo tomador e pago de novo no DAS.
- Exportação de serviços não segregada (receita imune de PIS/Cofins/ISS).
- DAS do MEI pago depois do desenquadramento.

## Atualizar tabelas e NCMs

- `dados/parametros.json`: anexos (faixas, alíquotas nominais, parcelas a deduzir), Fator R, limites do MEI por ano (`limitesMei`: vale a maior chave ≤ ano) e participação de PIS/Cofins no Anexo I, com a última competência em que ela vale (`partilhaPisCofinsVigenteAte`; depois disso a regra de monofásico só aponta risco até a tabela da reforma tributária ser cadastrada). Ao mudar, preencha `verificado_em` só depois de conferir na LC 123/2006 e na Resolução CGSN 140/2018.
- `dados/ncm-monofasicos.json`: a lista inicial é **exemplo incompleto**. Monte a definitiva com o contador. Para um código que casa com um prefixo mas não é monofásico, use o campo `excecoes` do grupo (ex. prefixo `8409` com exceção `8409.10`).
- Enquanto `verificado_em` estiver vazio, o relatório avisa que os valores são de demonstração.
