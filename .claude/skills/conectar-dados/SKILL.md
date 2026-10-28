---
name: conectar-dados
description: Ligar o Pente-Fino aos dados reais de uma empresa (tabelas do Wavern no Supabase, extrato do PGDAS-D, XML de notas) convertendo-os para o contrato EmpresaPenteFino. Use ao integrar o agente com a plataforma, ao importar dados de um cliente ou quando um diagnóstico sair vazio por falta de dados.
---

# Conectar dados ao Pente-Fino

O Pente-Fino recebe **um JSON por empresa** no formato `EmpresaPenteFino` (`src/tipos.ts`). Ele não lê banco nem portal: quem integra converte os dados para esse contrato. Assim o agente roda igual com dado real, planilha ou exemplo.

## Contrato, campo a campo

| Campo | Obrigatório | De onde vem | Usado por |
|---|---|---|---|
| `cnpj`, `razaoSocial`, `regime` | sim | cadastro da empresa no Wavern | todas |
| `dataAbertura` | não | cadastro (data de início da atividade) | `teto-mei` (limite proporcional) |
| `dataBaixa` | não | cadastro / histórico de situação | `pagamento-apos-baixa` |
| `guias[]` | sim | DAS pagos: competência, valor pago, data de pagamento | `duplicidade` |
| `apuracoes[].receitaBruta` | por regra | PGDAS-D / PGMEI ou soma das notas do mês | `teto-mei`, `fator-r`, `monofasico` |
| `apuracoes[].rbt12`, `folha12` | Simples | motor de DAS do Wavern (já calcula RBT12 e Fator R) | `fator-r`, `monofasico` |
| `apuracoes[].atividade`, `anexoDeclarado` | Simples | CNAE da empresa e anexo informado no PGDAS-D | `fator-r`, `monofasico` |
| `apuracoes[].receitaMonofasicaSegregada` | não | PGDAS-D (receita marcada como monofásica) | `monofasico` |
| `itensNotas[]` | não | itens das NF-e de venda: competência, NCM, valor | `monofasico` |

Valores em reais com ponto decimal. Datas em `AAAA-MM-DD`, competências em `AAAA-MM`.

## Passo a passo

1. Escreva um conversor (ex. `src/importar-wavern.ts`) que consulta o banco e devolve `EmpresaPenteFino`. Use a chave de serviço do Supabase só no servidor, nunca no navegador.
2. Respeite a permissão de acesso: o contador só pode diagnosticar empresas da carteira dele (mesma regra do portfólio do contador no Wavern).
3. Gere o JSON e rode `npm run diagnosticar -- caminho/empresa.json --json` para conferir.
4. Compare com um caso que o contador já conhece antes de mostrar valores a clientes.

## Diagnóstico vazio?

- Sem `apuracoes`, só a regra de duplicidade roda.
- `fator-r` exige `atividade: "servico_fator_r"`, `rbt12`, `folha12` e `anexoDeclarado`.
- `monofasico` exige `atividade: "comercio"` e `itensNotas` com NCM.

## Dados sensíveis

O JSON tem faturamento e folha. Não comite arquivos de clientes reais: use a pasta `saida/` (já no `.gitignore`) ou um diretório fora do repositório. Os arquivos de `exemplos/` são fictícios.
