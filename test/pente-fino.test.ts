import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { carregarContexto, diagnosticar } from "../src/diagnostico.ts";
import { grupoMonofasico } from "../src/regras/monofasico.ts";
import { montarRequisicaoResumo, resumirComIa } from "../src/resumo-ia.ts";
import { aliquotaEfetiva, dentroDoPrazo } from "../src/simples.ts";
import type { EmpresaPenteFino } from "../src/tipos.ts";

const contexto = carregarContexto("2026-10-24");
const exemplo = (nome: string) =>
  JSON.parse(readFileSync(new URL(`../exemplos/${nome}.json`, import.meta.url), "utf8")) as EmpresaPenteFino;

describe("tabelas do Simples", () => {
  it("calcula a alíquota efetiva pela fórmula da LC 123", () => {
    // Anexo III, 3ª faixa: (380.000 × 13,5% − 17.640) ÷ 380.000
    assert.ok(Math.abs(aliquotaEfetiva(contexto.parametros, "III", 380000) - 0.088579) < 1e-6);
    assert.equal(aliquotaEfetiva(contexto.parametros, "V", 0), 0.155);
  });

  it("respeita o prazo de 5 anos", () => {
    assert.equal(dentroDoPrazo("2021-10-24", "2026-10-24", 60), true);
    assert.equal(dentroDoPrazo("2021-10-23", "2026-10-24", 60), false);
  });
});

describe("regras", () => {
  it("MEI: acha DAS em duplicidade e faturamento acima do limite", () => {
    const diagnostico = diagnosticar(exemplo("mei"), contexto);
    assert.equal(diagnostico.totalPagoAMais, 81.9);
    assert.ok(diagnostico.achados.some((achado) => achado.regra === "teto-mei" && achado.tipo === "risco"));
  });

  it("MEI: limite proporcional no ano de abertura", () => {
    const empresa: EmpresaPenteFino = {
      cnpj: "x",
      razaoSocial: "x",
      regime: "MEI",
      dataAbertura: "2026-09-02",
      guias: [],
      apuracoes: [{ competencia: "2026-09", receitaBruta: 30000 }],
    };
    // Setembro a dezembro: 4 × 6.750 = 27.000
    const [achado] = diagnosticar(empresa, contexto).achados;
    assert.equal(achado.evidencias.limite, 27000);
  });

  it("Simples: guias com valores diferentes viram ponto de atenção, não duplicidade", () => {
    const empresa: EmpresaPenteFino = {
      cnpj: "x",
      razaoSocial: "x",
      regime: "SIMPLES",
      guias: [
        { competencia: "2026-05", valorPago: 1000, dataPagamento: "2026-06-20" },
        { competencia: "2026-05", valorPago: 120, dataPagamento: "2026-07-02" },
      ],
    };
    const diagnostico = diagnosticar(empresa, contexto);
    assert.equal(diagnostico.totalPagoAMais, 0);
    assert.equal(diagnostico.achados[0].tipo, "risco");
  });

  it("guia paga depois da baixa é pagamento a mais", () => {
    const empresa: EmpresaPenteFino = {
      cnpj: "x",
      razaoSocial: "x",
      regime: "MEI",
      dataBaixa: "2026-03-15",
      guias: [
        { competencia: "2026-03", valorPago: 80, dataPagamento: "2026-04-20" },
        { competencia: "2026-04", valorPago: 80, dataPagamento: "2026-05-20" },
      ],
    };
    const diagnostico = diagnosticar(empresa, contexto);
    assert.deepEqual(diagnostico.achados.map((achado) => achado.competencia), ["2026-04"]);
  });

  it("Fator R: aponta anexo errado nos dois sentidos", () => {
    const diagnostico = diagnosticar(exemplo("simples-servicos"), contexto);
    const tipos = diagnostico.achados.map((achado) => `${achado.competencia}:${achado.tipo}`).sort();
    assert.deepEqual(tipos, ["2026-07:pago_a_mais", "2026-08:pago_a_mais", "2026-09:pago_a_menos"]);
    assert.equal(diagnostico.totalPagoAMenos, 2400);
  });

  it("monofásico: identifica NCM por prefixo e estima PIS/Cofins não segregado", () => {
    assert.equal(grupoMonofasico("8708.30.90", contexto.monofasicos), "Autopeças e pneus");
    assert.equal(grupoMonofasico("8302.30.00", contexto.monofasicos), null);
    const diagnostico = diagnosticar(exemplo("simples-comercio"), contexto);
    const monofasico = diagnostico.achados.find((achado) => achado.regra === "monofasico");
    assert.equal(monofasico?.valorEstimado, 316.33);
  });

  it("deixa fora do total o que já prescreveu", () => {
    const antigo = diagnosticar(exemplo("mei"), carregarContexto("2031-01-01"));
    assert.equal(antigo.totalPagoAMais, 0);
    assert.equal(antigo.foraDoPrazo, 1);
  });
});

describe("resumo com IA", () => {
  it("só redige: manda o diagnóstico pronto e devolve o texto", async () => {
    const diagnostico = diagnosticar(exemplo("mei"), contexto);
    const enviadas: MessageCreateParamsNonStreaming[] = [];
    const cliente = {
      beta: {
        messages: {
          async create(params: MessageCreateParamsNonStreaming) {
            enviadas.push(params);
            return { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "Resumo." }] } as unknown as BetaMessage;
          },
        },
      },
    };
    assert.equal(await resumirComIa(diagnostico, cliente, "claude-opus-5-5"), "Resumo.");
    assert.equal(JSON.parse(enviadas[0].messages[0].content as string).totalPagoAMais, 81.9);
    assert.equal(montarRequisicaoResumo(diagnostico, "claude-haiku-5-5").fallbacks, undefined);
  });
});
