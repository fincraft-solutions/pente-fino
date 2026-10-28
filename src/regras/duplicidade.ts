import { arredondar, centavos, formatarReais, mesesEntre } from "../simples.ts";
import type { Achado, EmpresaPenteFino, GuiaDas } from "../tipos.ts";

const PASSO_RESTITUICAO =
  "Pedir a restituição da parte federal no Portal do Simples Nacional; o ICMS e o ISS incluídos no DAS são pedidos ao estado e ao município.";

const descreverGuias = (guias: GuiaDas[]) => guias.map((guia) => `${guia.dataPagamento}: ${formatarReais(guia.valorPago)}`).join(" | ");
const porData = (a: GuiaDas, b: GuiaDas) => a.dataPagamento.localeCompare(b.dataPagamento);

/** Remove a mesma guia importada duas vezes (mesmo número de documento): não é pagamento em dobro. */
function semReimportacao(guias: GuiaDas[]): GuiaDas[] {
  const vistos = new Set<string>();
  return guias.filter((guia) => {
    if (!guia.numeroDocumento) return true;
    if (vistos.has(guia.numeroDocumento)) return false;
    vistos.add(guia.numeroDocumento);
    return true;
  });
}

// Etapa (a): guias pagas depois da baixa e guias pagas em duplicidade. Vale para MEI e Simples.
export function regraDuplicidade(empresa: EmpresaPenteFino): Achado[] {
  const achados: Achado[] = [];
  const baixa = empresa.dataBaixa;
  const guias = semReimportacao(empresa.guias);

  // Toda guia de competência posterior à baixa é indevida; ela não entra de novo na conta de duplicidade.
  const aposBaixa = baixa ? guias.filter((guia) => mesesEntre(baixa, guia.competencia) > 0) : [];
  for (const guia of aposBaixa) {
    achados.push({
      regra: "pagamento-apos-baixa",
      competencia: guia.competencia,
      tipo: "pago_a_mais",
      valorEstimado: guia.valorPago,
      explicacao: `Guia da competência ${guia.competencia} paga, mas o CNPJ foi baixado/desenquadrado em ${baixa}.`,
      proximoPasso: `Confirmar a data da baixa. ${PASSO_RESTITUICAO}`,
      evidencias: { dataBaixa: baixa ?? "", dataPagamento: guia.dataPagamento, valor: guia.valorPago },
      dataPagamento: guia.dataPagamento,
    });
  }

  const porCompetencia = new Map<string, GuiaDas[]>();
  for (const guia of guias) {
    if (aposBaixa.includes(guia)) continue;
    porCompetencia.set(guia.competencia, [...(porCompetencia.get(guia.competencia) ?? []), guia]);
  }

  for (const [competencia, doMes] of porCompetencia) {
    if (doMes.length < 2) continue;
    const ordenadas = [...doMes].sort(porData);

    // No MEI o DAS é fixo: toda guia além da primeira é duplicidade.
    // No Simples pode haver complemento de retificação; duplicidade certa é o mesmo valor (em centavos) pago mais de uma vez.
    let duplicadas: GuiaDas[];
    if (empresa.regime === "MEI") {
      duplicadas = ordenadas.slice(1);
    } else {
      const porValor = new Map<number, GuiaDas[]>();
      for (const guia of ordenadas) porValor.set(centavos(guia.valorPago), [...(porValor.get(centavos(guia.valorPago)) ?? []), guia]);
      duplicadas = [...porValor.values()].flatMap((grupo) => grupo.slice(1));
    }

    if (duplicadas.length > 0) {
      const valor = arredondar(duplicadas.reduce((soma, guia) => soma + guia.valorPago, 0));
      achados.push({
        regra: "duplicidade",
        competencia,
        tipo: "pago_a_mais",
        valorEstimado: valor,
        explicacao: `A competência ${competencia} tem ${doMes.length} guias pagas para o mesmo período: ${formatarReais(valor)} foram pagos em duplicidade.`,
        proximoPasso: PASSO_RESTITUICAO,
        evidencias: { guias: descreverGuias(ordenadas) },
        dataPagamento: duplicadas.map((guia) => guia.dataPagamento).sort()[0],
      });
    }

    // Sobraram valores diferentes no mesmo mês: pode ser complemento legítimo, então é só ponto de atenção.
    const valoresDistintos = new Set(ordenadas.map((guia) => centavos(guia.valorPago))).size;
    if (empresa.regime === "SIMPLES" && valoresDistintos > 1) {
      achados.push({
        regra: "duplicidade",
        competencia,
        tipo: "risco",
        valorEstimado: 0,
        explicacao: `A competência ${competencia} tem guias com valores diferentes. Pode ser complemento de retificação ou pagamento duplicado.`,
        proximoPasso: "Conferir no PGDAS-D se houve retificação que justifique a segunda guia.",
        evidencias: { guias: descreverGuias(ordenadas) },
      });
    }
  }

  return achados;
}
