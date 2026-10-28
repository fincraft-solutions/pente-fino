import { aliquotaEfetiva, arredondar, centavos, formatarPercentual, formatarReais } from "../simples.ts";
import type { Achado, Anexo, Contexto, EmpresaPenteFino } from "../tipos.ts";

// Etapa (b): serviço sujeito ao Fator R declarado no anexo errado.
export function regraFatorR(empresa: EmpresaPenteFino, contexto: Contexto): Achado[] {
  if (empresa.regime !== "SIMPLES") return [];
  const { parametros } = contexto;

  const achados: Achado[] = [];
  for (const apuracao of empresa.apuracoes ?? []) {
    const { rbt12, folha12, anexoDeclarado } = apuracao;
    // folha12 == null: dado faltando (inclusive null vindo do banco), não folha zero.
    if (apuracao.atividade !== "servico_fator_r" || !rbt12 || folha12 == null || !anexoDeclarado) continue;

    // Compara em centavos: 7.000,07 ÷ 25.000,25 é exatamente 28%, mas em ponto flutuante dá 0,27999…
    const atingeFatorR = centavos(folha12) * 1_000_000 >= Math.round(parametros.limiteFatorR * 1_000_000) * centavos(rbt12);
    const anexoCorreto: Anexo = atingeFatorR ? "III" : "V";
    if (anexoCorreto === anexoDeclarado) continue;

    const dasDeclarado = apuracao.receitaBruta * aliquotaEfetiva(parametros, anexoDeclarado, rbt12);
    const dasCorreto = apuracao.receitaBruta * aliquotaEfetiva(parametros, anexoCorreto, rbt12);
    const diferenca = arredondar(dasDeclarado - dasCorreto);
    if (diferenca === 0) continue;
    const percentual = formatarPercentual(folha12 / rbt12);

    achados.push({
      regra: "fator-r",
      competencia: apuracao.competencia,
      tipo: diferenca > 0 ? "pago_a_mais" : "pago_a_menos",
      valorEstimado: Math.abs(diferenca),
      explicacao:
        diferenca > 0
          ? `Fator R de ${percentual} (≥ 28%) dá direito ao Anexo III, mas a competência foi declarada no Anexo ${anexoDeclarado}. Diferença estimada: ${formatarReais(diferenca)} pagos a mais.`
          : `Fator R de ${percentual} (< 28%) leva ao Anexo V, mas a competência foi declarada no Anexo ${anexoDeclarado}. Diferença estimada: ${formatarReais(-diferenca)} pagos a menos.`,
      proximoPasso:
        diferenca > 0
          ? "Conferir folha e pró-labore do período, retificar o PGDAS-D e pedir restituição ou compensação."
          : "Retificar o PGDAS-D e pagar a diferença com acréscimos antes de uma fiscalização.",
      evidencias: { rbt12, folha12, fatorR: percentual, anexoDeclarado, anexoCorreto, receitaBruta: apuracao.receitaBruta },
    });
  }
  return achados;
}
