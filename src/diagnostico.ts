import { readFileSync } from "node:fs";
import { REGRAS } from "./regras/index.ts";
import { arredondar, dentroDoPrazo, ehData, hojeEmBrasilia, vencimentoDas } from "./simples.ts";
import type { Achado, Contexto, Diagnostico, EmpresaPenteFino, GrupoMonofasico, Parametros, TipoAchado } from "./tipos.ts";
import { validarEmpresa } from "./validacao.ts";

function lerJson<T>(caminhoRelativo: string): T {
  return JSON.parse(readFileSync(new URL(caminhoRelativo, import.meta.url), "utf8")) as T;
}

export function carregarContexto(dataReferencia: string = hojeEmBrasilia()): Contexto {
  if (!ehData(dataReferencia)) throw new Error(`Data de referência inválida: ${JSON.stringify(dataReferencia)}. Use AAAA-MM-DD.`);
  const parametros = lerJson<Parametros>("../dados/parametros.json");
  const ncm = lerJson<{ grupos: GrupoMonofasico[]; verificado_em: string | null }>("../dados/ncm-monofasicos.json");
  return { parametros, monofasicos: ncm.grupos, monofasicosVerificadosEm: ncm.verificado_em, dataReferencia };
}

/** Data em que o imposto foi pago: a do achado, a da primeira guia da competência ou, sem guia, o vencimento. */
function dataDoPagamento(achado: Achado, empresa: EmpresaPenteFino): string {
  if (achado.dataPagamento) return achado.dataPagamento;
  const guias = empresa.guias.filter((guia) => guia.competencia === achado.competencia).map((guia) => guia.dataPagamento);
  return guias.sort()[0] ?? vencimentoDas(achado.competencia);
}

const ORDEM_TIPO: Record<TipoAchado, number> = { pago_a_mais: 0, pago_a_menos: 1, risco: 2 };

export function diagnosticar(entrada: EmpresaPenteFino, contexto: Contexto): Diagnostico {
  const { empresa, avisos } = validarEmpresa(entrada);
  if (!contexto.parametros.verificado_em) {
    avisos.push("Tabelas do Simples (dados/parametros.json) ainda não verificadas: valores são estimativas de demonstração.");
  }

  if (!contexto.monofasicosVerificadosEm && empresa.itensNotas?.length) {
    avisos.push("Lista de NCM monofásicos (dados/ncm-monofasicos.json) é um exemplo incompleto e não verificado.");
  }

  const todos = Object.values(REGRAS).flatMap((regra) => regra(empresa, contexto));

  // Só entra no total o que ainda pode ser restituído: 5 anos contados do pagamento (CTN, art. 168, I).
  const { prazoRestituicaoMeses } = contexto.parametros;
  const foraDoPrazo = todos.filter(
    (achado) =>
      achado.tipo === "pago_a_mais" && !dentroDoPrazo(dataDoPagamento(achado, empresa), contexto.dataReferencia, prazoRestituicaoMeses),
  );
  const achados = todos
    .filter((achado) => !foraDoPrazo.includes(achado))
    .sort(
      (a, b) =>
        ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || b.valorEstimado - a.valorEstimado || a.competencia.localeCompare(b.competencia),
    );

  if (foraDoPrazo.length > 0) {
    avisos.push(`${foraDoPrazo.length} indício(s) de pagamento a mais ficaram fora do prazo de restituição e não entram no total.`);
  }

  const somar = (tipo: TipoAchado) =>
    arredondar(achados.filter((achado) => achado.tipo === tipo).reduce((soma, achado) => soma + achado.valorEstimado, 0));

  return {
    cnpj: empresa.cnpj,
    razaoSocial: empresa.razaoSocial,
    regime: empresa.regime,
    dataReferencia: contexto.dataReferencia,
    achados,
    totalPagoAMais: somar("pago_a_mais"),
    totalPagoAMenos: somar("pago_a_menos"),
    foraDoPrazo: foraDoPrazo.length,
    avisos,
  };
}
