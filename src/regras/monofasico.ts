import { aliquotaEfetiva, arredondar, formatarReais, indiceFaixa } from "../simples.ts";
import type { Achado, Contexto, EmpresaPenteFino, GrupoMonofasico } from "../tipos.ts";

const soDigitos = (texto: string) => texto.replace(/\D/g, "");

export function grupoMonofasico(ncm: string, grupos: GrupoMonofasico[]): string | null {
  const codigo = soDigitos(ncm);
  const casa = (prefixo: string) => codigo.startsWith(soDigitos(prefixo));
  for (const { grupo, prefixos, excecoes = [] } of grupos) {
    if (prefixos.some(casa) && !excecoes.some(casa)) return grupo;
  }
  return null;
}

// Etapa (c): revenda de produto monofásico sem segregação no PGDAS-D (PIS/Cofins pagos em dobro).
export function regraMonofasico(empresa: EmpresaPenteFino, contexto: Contexto): Achado[] {
  if (empresa.regime !== "SIMPLES" || !empresa.itensNotas?.length) return [];
  const { parametros, monofasicos } = contexto;

  const achados: Achado[] = [];
  for (const apuracao of empresa.apuracoes ?? []) {
    if (apuracao.atividade !== "comercio") continue;

    const porGrupo = new Map<string, number>();
    for (const item of empresa.itensNotas) {
      if (item.competencia !== apuracao.competencia) continue;
      const grupo = grupoMonofasico(item.ncm, monofasicos);
      if (grupo) porGrupo.set(grupo, (porGrupo.get(grupo) ?? 0) + item.valor);
    }
    if (porGrupo.size === 0) continue;

    // Depois da reforma tributária a partilha do DAS muda: sem tabela nova, não estima valor.
    if (apuracao.competencia > parametros.partilhaPisCofinsVigenteAte) {
      achados.push({
        regra: "monofasico",
        competencia: apuracao.competencia,
        tipo: "risco",
        valorEstimado: 0,
        explicacao: "Há vendas de produtos monofásicos, mas a partilha de PIS/Cofins no DAS desta competência ainda não está cadastrada (reforma tributária).",
        proximoPasso: "Conferir com o contador a segregação da receita monofásica no PGDAS-D.",
        evidencias: { partilhaVigenteAte: parametros.partilhaPisCofinsVigenteAte },
      });
      continue;
    }

    const vendasNasNotas = [...porGrupo.values()].reduce((soma, valor) => soma + valor, 0);
    // As notas podem somar mais que a receita declarada (devoluções, notas canceladas): limita à receita.
    const vendasMonofasicas = Math.min(vendasNasNotas, apuracao.receitaBruta);
    const segregado = apuracao.receitaMonofasicaSegregada ?? 0;
    const naoSegregado = vendasMonofasicas - segregado;
    const evidencias = {
      grupos: [...porGrupo.entries()].map(([grupo, total]) => `${grupo}: ${formatarReais(total)}`).join(" | "),
      segregadoNoPgdas: segregado,
      receitaBruta: apuracao.receitaBruta,
      rbt12: apuracao.rbt12 ?? 0,
    };

    if (naoSegregado < 0) {
      achados.push({
        regra: "monofasico",
        competencia: apuracao.competencia,
        tipo: "risco",
        valorEstimado: 0,
        explicacao: `O PGDAS-D marca ${formatarReais(segregado)} como monofásico, mas as notas só mostram ${formatarReais(vendasMonofasicas)} desses produtos. Segregar a mais reduz PIS/Cofins indevidamente.`,
        proximoPasso: "Conferir se faltam notas no Wavern; se não faltarem, retificar o PGDAS-D e pagar a diferença.",
        evidencias,
      });
      continue;
    }

    const rbt12 = apuracao.rbt12 ?? 0;
    const participacao = parametros.participacaoPisCofinsAnexoI[indiceFaixa(parametros.anexos.I, rbt12)];
    const valor = arredondar(naoSegregado * aliquotaEfetiva(parametros, "I", rbt12) * participacao);
    if (valor <= 0) continue;

    achados.push({
      regra: "monofasico",
      competencia: apuracao.competencia,
      tipo: "pago_a_mais",
      valorEstimado: valor,
      explicacao: `${formatarReais(naoSegregado)} em vendas de produtos monofásicos não foram segregados no PGDAS-D. A parcela de PIS/Cofins paga sobre elas soma cerca de ${formatarReais(valor)}.`,
      proximoPasso: "Validar os NCMs com o contador, retificar o PGDAS-D marcando a receita como monofásica e pedir restituição.",
      evidencias,
    });
  }
  return achados;
}
