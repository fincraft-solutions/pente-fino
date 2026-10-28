**Idioma:** [English](../en/guide.md) | **Português (Brasil)**

# Trabalhando com Pente-Fino

[Voltar para Pente-Fino](../../README.pt-BR.md)

## Para começar

O Pente-Fino examina cenários de DAS para MEI e Simples Nacional e destaca itens que merecem conferência. Cada apontamento identifica a regra utilizada para que o cálculo possa ser revisado.

O exemplo mais simples está no README:

```bash
npm ci
npm run diagnosticar -- exemplos/simples-comercio.json
```

## Componentes

- `exemplos/`: cenários de comércio, serviços e MEI.
- `src/diagnostico.ts`: coordenação das verificações e apontamentos.
- `src/regras/`: regras de detecção.
- `src/relatorio.ts`: elaboração do relatório legível.
- `src/resumo-ia.ts`: camada opcional de explicação.
- `dados/`: parâmetros e classificações de exemplo.

## Integração

Adicione `--json` ao comando para obter o resultado estruturado. As regras ficam em TypeScript e podem ser inspecionadas. Em casos atuais, confira competência, tabelas e critérios de classificação.

## Desenvolvimento

```bash
npm ci
npm run typecheck
npm test
```

O projeto utiliza Node.js 22.20 ou superior.
