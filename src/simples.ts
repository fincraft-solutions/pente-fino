import type { Anexo, Faixa, Parametros } from "./tipos.ts";

export function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function centavos(valor: number): number {
  return Math.round(valor * 100);
}

const FORMATO_COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function ehCompetencia(texto: unknown): texto is string {
  return typeof texto === "string" && FORMATO_COMPETENCIA.test(texto);
}

/** Data AAAA-MM-DD que existe no calendário (recusa 2026-02-30). */
export function ehData(texto: unknown): texto is string {
  if (typeof texto !== "string" || !FORMATO_DATA.test(texto)) return false;
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/** Data de hoje no fuso de Brasília, para não virar o dia depois das 21h. */
export function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Limite do MEI vigente no ano: a maior chave de `limitesMei` que não passa do ano. */
export function limiteMeiDoAno(parametros: Parametros, ano: number): { anual: number; mensalProporcional: number } {
  const anos = Object.keys(parametros.limitesMei).map(Number).sort((a, b) => a - b);
  const vigente = anos.filter((inicio) => inicio <= ano).at(-1) ?? anos[0];
  return parametros.limitesMei[String(vigente)];
}

export function indiceFaixa(faixas: Faixa[], rbt12: number): number {
  const indice = faixas.findIndex((faixa) => rbt12 <= faixa.ate);
  return indice === -1 ? faixas.length - 1 : indice;
}

/**
 * Alíquota efetiva do Simples: (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12.
 * Sem RBT12 (primeiro mês de atividade), usa a alíquota nominal da primeira faixa.
 */
export function aliquotaEfetiva(parametros: Parametros, anexo: Anexo, rbt12: number): number {
  const faixas = parametros.anexos[anexo];
  if (rbt12 <= 0) return faixas[0].aliquota;
  const faixa = faixas[indiceFaixa(faixas, rbt12)];
  return (rbt12 * faixa.aliquota - faixa.deducao) / rbt12;
}

/** Diferença em meses entre duas datas AAAA-MM(-DD) já validadas. Positivo quando `ate` é depois de `de`. */
export function mesesEntre(de: string, ate: string): number {
  const [anoDe, mesDe] = de.split("-").map(Number);
  const [anoAte, mesAte] = ate.split("-").map(Number);
  return (anoAte - anoDe) * 12 + (mesAte - mesDe);
}

/** Vencimento do DAS (dia 20 do mês seguinte), usado como data de pagamento quando ela não é conhecida. */
export function vencimentoDas(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes, 20));
  return data.toISOString().slice(0, 10);
}

/**
 * Prazo de restituição contado da data do pagamento (CTN, art. 168, I), dia a dia:
 * dentro se o pagamento não é anterior a `dataReferencia` menos `prazoMeses` meses.
 */
export function dentroDoPrazo(dataPagamento: string, dataReferencia: string, prazoMeses: number): boolean {
  const [ano, mes, dia] = dataReferencia.split("-").map(Number);
  const limite = new Date(Date.UTC(ano, mes - 1 - prazoMeses, dia)).toISOString().slice(0, 10);
  return dataPagamento >= limite;
}

export function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Percentual truncado em duas casas, para 27,999% nunca aparecer como 28%. */
export function formatarPercentual(fracao: number): string {
  return `${(Math.floor(fracao * 10000) / 100).toFixed(2).replace(".", ",")}%`;
}
