import { ehCompetencia, ehData } from "./simples.ts";
import type { Apuracao, EmpresaPenteFino, GuiaDas, ItemNota } from "./tipos.ts";

const ATIVIDADES = new Set(["comercio", "servico_fator_r", "servico_anexo_iii", "outra"]);
const ANEXOS = new Set(["I", "III", "V"]);

type Bruto = Record<string, unknown>;

/** Número finito ≥ 0. Aceita texto numérico ("81.90"); devolve undefined para o resto. */
function numero(valor: unknown): number | undefined {
  const convertido = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  return typeof convertido === "number" && Number.isFinite(convertido) && convertido >= 0 ? convertido : undefined;
}

function lista(valor: unknown): Bruto[] {
  return Array.isArray(valor) ? valor.filter((item): item is Bruto => typeof item === "object" && item !== null) : [];
}

/**
 * Confere e normaliza a entrada. Erro só quando não dá para identificar a empresa;
 * registros com campo inválido são descartados com aviso, para nunca virarem valor errado no total.
 */
export function validarEmpresa(entrada: unknown): { empresa: EmpresaPenteFino; avisos: string[] } {
  if (typeof entrada !== "object" || entrada === null) throw new Error("Entrada não é um objeto JSON.");
  const bruto = entrada as Bruto;
  const avisos: string[] = [];

  const regime = typeof bruto.regime === "string" ? bruto.regime.trim().toUpperCase() : "";
  if (regime !== "MEI" && regime !== "SIMPLES") throw new Error(`regime deve ser "MEI" ou "SIMPLES" (recebido: ${JSON.stringify(bruto.regime)}).`);
  if (typeof bruto.cnpj !== "string" || !bruto.cnpj.trim()) throw new Error("cnpj ausente.");

  const data = (campo: string): string | null => {
    const valor = bruto[campo];
    if (valor === undefined || valor === null || valor === "") return null;
    if (ehData(valor) || ehCompetencia(valor)) return valor as string;
    avisos.push(`${campo} inválida (${JSON.stringify(valor)}); use AAAA-MM-DD. As regras que dependem dela foram ignoradas.`);
    return null;
  };

  const guias: GuiaDas[] = [];
  lista(bruto.guias).forEach((guia, indice) => {
    const valorPago = numero(guia.valorPago);
    if (!ehCompetencia(guia.competencia) || valorPago === undefined || !ehData(guia.dataPagamento)) {
      avisos.push(`Guia ${indice + 1} ignorada: competência (AAAA-MM), valor pago (≥ 0) ou data de pagamento (AAAA-MM-DD) inválidos.`);
      return;
    }
    guias.push({
      competencia: guia.competencia,
      valorPago,
      dataPagamento: guia.dataPagamento,
      ...(typeof guia.numeroDocumento === "string" && guia.numeroDocumento ? { numeroDocumento: guia.numeroDocumento } : {}),
    });
  });

  const apuracoes: Apuracao[] = [];
  lista(bruto.apuracoes).forEach((apuracao) => {
    const receitaBruta = numero(apuracao.receitaBruta);
    if (!ehCompetencia(apuracao.competencia) || receitaBruta === undefined) {
      avisos.push(`Apuração ${JSON.stringify(apuracao.competencia)} ignorada: competência ou receita bruta inválida.`);
      return;
    }
    const opcional = (campo: string) => {
      const valor = numero(apuracao[campo]);
      if (valor === undefined && apuracao[campo] !== undefined && apuracao[campo] !== null) {
        avisos.push(`Apuração ${apuracao.competencia}: ${campo} inválido, tratado como ausente.`);
      }
      return valor;
    };
    apuracoes.push({
      competencia: apuracao.competencia,
      receitaBruta,
      rbt12: opcional("rbt12"),
      folha12: opcional("folha12"),
      receitaMonofasicaSegregada: opcional("receitaMonofasicaSegregada"),
      atividade: ATIVIDADES.has(apuracao.atividade as string) ? (apuracao.atividade as Apuracao["atividade"]) : undefined,
      anexoDeclarado: ANEXOS.has(apuracao.anexoDeclarado as string) ? (apuracao.anexoDeclarado as Apuracao["anexoDeclarado"]) : undefined,
    });
  });

  const itensNotas: ItemNota[] = [];
  let itensInvalidos = 0;
  for (const item of lista(bruto.itensNotas)) {
    const valor = numero(item.valor);
    if (!ehCompetencia(item.competencia) || typeof item.ncm !== "string" || valor === undefined) {
      itensInvalidos += 1;
      continue;
    }
    itensNotas.push({ competencia: item.competencia, ncm: item.ncm, valor });
  }
  if (itensInvalidos > 0) avisos.push(`${itensInvalidos} item(ns) de nota ignorado(s) por competência, NCM ou valor inválido.`);

  return {
    empresa: {
      cnpj: bruto.cnpj.trim(),
      razaoSocial: typeof bruto.razaoSocial === "string" ? bruto.razaoSocial : "",
      regime,
      dataAbertura: data("dataAbertura"),
      dataBaixa: data("dataBaixa"),
      guias,
      apuracoes,
      itensNotas,
    },
    avisos,
  };
}
