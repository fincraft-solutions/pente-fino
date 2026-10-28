import { arredondar, formatarReais, limiteMeiDoAno } from "../simples.ts";
import type { Achado, Contexto, EmpresaPenteFino } from "../tipos.ts";

// Faturamento do MEI acima do limite: não é dinheiro a recuperar, é imposto que pode estar faltando.
export function regraTetoMei(empresa: EmpresaPenteFino, contexto: Contexto): Achado[] {
  if (empresa.regime !== "MEI" || !empresa.apuracoes?.length) return [];

  const receitaPorAno = new Map<number, number>();
  for (const apuracao of empresa.apuracoes) {
    const ano = Number(apuracao.competencia.slice(0, 4));
    receitaPorAno.set(ano, (receitaPorAno.get(ano) ?? 0) + apuracao.receitaBruta);
  }

  const achados: Achado[] = [];
  for (const [ano, receita] of receitaPorAno) {
    const abertura = empresa.dataAbertura ?? "";
    const proporcional = Number(abertura.slice(0, 4)) === ano;
    const meses = proporcional ? 13 - Number(abertura.slice(5, 7)) : 12;
    const { anual, mensalProporcional } = limiteMeiDoAno(contexto.parametros, ano);
    const limite = proporcional ? arredondar(mensalProporcional * meses) : anual;
    if (receita <= limite) continue;

    const excesso = arredondar(receita - limite);
    const acimaDe20 = receita > limite * 1.2;
    // No ano de abertura, o excesso acima de 20% retroage à data de início da atividade, não a janeiro.
    const inicio = proporcional ? "à data de início da atividade" : "ao início do ano";
    achados.push({
      regra: "teto-mei",
      competencia: `${ano}-12`,
      tipo: "risco",
      valorEstimado: 0,
      explicacao: acimaDe20
        ? `Em ${ano} o faturamento (${formatarReais(receita)}) passou mais de 20% do limite de ${formatarReais(limite)}. O desenquadramento retroage ${inicio} e os tributos são recalculados como microempresa.`
        : `Em ${ano} o faturamento (${formatarReais(receita)}) passou o limite de ${formatarReais(limite)} em ${formatarReais(excesso)}. A empresa deixa de ser MEI em janeiro seguinte e paga DAS complementar sobre o excesso.`,
      proximoPasso: "Comunicar o desenquadramento no Portal do Simples Nacional e calcular o complemento com o contador.",
      evidencias: { ano, receita, limite, excesso, proporcional: proporcional ? `sim (${meses} meses)` : "não" },
    });
  }
  return achados;
}
