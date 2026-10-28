// Casos da rodada de QA do Pente-Fino: bordas, contas conferidas à mão e um teste por bug corrigido (B1–B19).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { carregarContexto, diagnosticar } from "../src/diagnostico.ts";
import { grupoMonofasico } from "../src/regras/monofasico.ts";
import { relatorioMarkdown } from "../src/relatorio.ts";
import { resumirComIa } from "../src/resumo-ia.ts";
import { aliquotaEfetiva, dentroDoPrazo, indiceFaixa, mesesEntre } from "../src/simples.ts";
import type { Apuracao, EmpresaPenteFino, GuiaDas } from "../src/tipos.ts";

const ctx = carregarContexto("2026-10-24");
const P = ctx.parametros;
const simples = (extra: Partial<EmpresaPenteFino> = {}): EmpresaPenteFino => ({ cnpj: "x", razaoSocial: "x", regime: "SIMPLES", guias: [], ...extra });
const mei = (extra: Partial<EmpresaPenteFino> = {}): EmpresaPenteFino => simples({ regime: "MEI", ...extra });
const guia = (competencia: string, valorPago: number, dataPagamento: string, numeroDocumento?: string): GuiaDas => ({ competencia, valorPago, dataPagamento, numeroDocumento });
const servico = (folha12: number | null, rbt12: number, anexoDeclarado: "III" | "V", receitaBruta = 10000): Apuracao =>
  ({ competencia: "2026-09", receitaBruta, rbt12, folha12, atividade: "servico_fator_r", anexoDeclarado }) as Apuracao;
const perto = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

describe("regressão: tabelas e datas", () => {
  it("tabelas dos Anexos I, III e V batem com a LC 123 (redação LC 155/2016)", () => {
    const esperado = {
      I: [[180000, 0.04, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300], [4800000, 0.19, 378000]],
      III: [[180000, 0.06, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.16, 35640], [3600000, 0.21, 125640], [4800000, 0.33, 648000]],
      V: [[180000, 0.155, 0], [360000, 0.18, 4500], [720000, 0.195, 9900], [1800000, 0.205, 17100], [3600000, 0.23, 62100], [4800000, 0.305, 540000]],
    } as const;
    for (const anexo of ["I", "III", "V"] as const) {
      assert.deepEqual(P.anexos[anexo].map((f) => [f.ate, f.aliquota, f.deducao]), esperado[anexo]);
    }
    // Anexo I: Cofins 12,74% + PIS 2,76% nas faixas 1 a 5; 28,27% + 6,13% na 6ª.
    assert.deepEqual(P.participacaoPisCofinsAnexoI, [0.155, 0.155, 0.155, 0.155, 0.155, 0.344]);
  });

  it("limite de faixa é inclusivo e a alíquota efetiva é contínua na virada", () => {
    for (const anexo of ["I", "III", "V"] as const) {
      const faixas = P.anexos[anexo];
      faixas.forEach((faixa, i) => {
        assert.equal(indiceFaixa(faixas, faixa.ate), i);
        // Faixa 6 é descontínua por lei (ICMS/ISS saem do DAS), então só 1→5.
        if (i < 4) perto(aliquotaEfetiva(P, anexo, faixa.ate), aliquotaEfetiva(P, anexo, faixa.ate + 0.01), 1e-6);
      });
    }
    perto(aliquotaEfetiva(P, "I", 650000), 47890 / 650000); // (650.000 × 9,5% − 13.860) ÷ 650.000
    assert.equal(aliquotaEfetiva(P, "I", 0), 0.04);
  });

  it("mesesEntre aceita AAAA-MM-DD contra AAAA-MM e vira o ano", () => {
    assert.equal(mesesEntre("2025-12", "2026-01"), 1);
    assert.equal(mesesEntre("2026-03-15", "2026-04"), 1);
    assert.equal(mesesEntre("2026-03-31", "2026-03"), 0);
    // Prazo conta da data do pagamento, dia a dia.
    assert.equal(dentroDoPrazo("2021-10-24", "2026-10-24", 60), true);
    assert.equal(dentroDoPrazo("2021-10-23", "2026-10-24", 60), false);
  });
});

describe("regressão: regras com valor (conferidas à mão)", () => {
  it("Fator R exatamente 28% vai para o Anexo III", () => {
    // V: (100.000 × 15,5%) ÷ 100.000 = 15,5%; III: 6%; diferença 9,5% × 10.000 = 950,00
    const d = diagnosticar(simples({ apuracoes: [servico(28000, 100000, "V")] }), ctx);
    assert.equal(d.achados[0].tipo, "pago_a_mais");
    assert.equal(d.achados[0].valorEstimado, 950);
    assert.equal(diagnosticar(simples({ apuracoes: [servico(28000, 100000, "III")] }), ctx).achados.length, 0);
  });

  it("Fator R: exemplo simples-servicos 2026-07 = R$ 2.571,79", () => {
    // V: (380.000×19,5% − 9.900)/380.000 = 16,8947%; III: (380.000×13,5% − 17.640)/380.000 = 8,8579%
    // 32.000 × (64.200 − 33.660)/380.000 = 32.000 × 30.540/380.000 = 2.571,79
    const d = diagnosticar(simples({ apuracoes: [{ competencia: "2026-07", receitaBruta: 32000, rbt12: 380000, folha12: 112000, atividade: "servico_fator_r", anexoDeclarado: "V" }] }), ctx);
    assert.equal(d.totalPagoAMais, 2571.79);
  });

  it("monofásico: 27.700 × 7,36769% × 15,5% = R$ 316,33", () => {
    const d = diagnosticar(simples({
      apuracoes: [{ competencia: "2026-08", receitaBruta: 60000, rbt12: 650000, atividade: "comercio", anexoDeclarado: "I", receitaMonofasicaSegregada: 0 }],
      itensNotas: [{ competencia: "2026-08", ncm: "8708.30.90", valor: 18500 }, { competencia: "2026-08", ncm: "40111000", valor: 9200 }, { competencia: "2026-08", ncm: "8302.30.00", valor: 4100 }],
    }), ctx);
    assert.equal(d.totalPagoAMais, 316.33);
  });

  it("monofásico: faixa 6 usa 34,4% (rbt12 4.000.000 → 9,55% × 34,4% × 10.000 = 328,52)", () => {
    const d = diagnosticar(simples({
      apuracoes: [{ competencia: "2026-08", receitaBruta: 60000, rbt12: 4_000_000, atividade: "comercio" }],
      itensNotas: [{ competencia: "2026-08", ncm: "8708.30.90", valor: 10000 }],
    }), ctx);
    assert.equal(d.totalPagoAMais, 328.52);
  });

  it("duplicidade MEI: 3 guias fora de ordem → 2 excedentes; centavos somados sem erro de ponto flutuante", () => {
    const tres = diagnosticar(mei({ guias: [guia("2026-05", 81.9, "2026-06-30"), guia("2026-05", 81.9, "2026-06-10"), guia("2026-05", 81.9, "2026-06-20")] }), ctx);
    assert.equal(tres.totalPagoAMais, 163.8);
    const centavos = diagnosticar(mei({ guias: [guia("2026-05", 0.1, "2026-06-10"), guia("2026-05", 0.2, "2026-06-11"), guia("2026-05", 0.1, "2026-06-12")] }), ctx);
    assert.equal(centavos.totalPagoAMais, 0.3);
  });

  it("duplicidade Simples: duplicata exata + complemento = pago a mais + ponto de atenção", () => {
    const d = diagnosticar(simples({ guias: [guia("2026-05", 1000, "2026-06-20"), guia("2026-05", 120, "2026-07-02"), guia("2026-05", 1000, "2026-06-21")] }), ctx);
    assert.deepEqual(d.achados.map((a) => `${a.tipo}:${a.valorEstimado}`), ["pago_a_mais:1000", "risco:0"]);
  });

  it("teto MEI: limite exato não dispara; 120% exato ainda é 'até 20%'; abertura em dezembro = 6.750", () => {
    assert.equal(diagnosticar(mei({ apuracoes: [{ competencia: "2025-06", receitaBruta: 81000 }] }), ctx).achados.length, 0);
    const em120 = diagnosticar(mei({ apuracoes: [{ competencia: "2025-06", receitaBruta: 97200 }] }), ctx).achados[0];
    assert.match(em120.explicacao, /janeiro seguinte/);
    const dez = diagnosticar(mei({ dataAbertura: "2025-12-05", apuracoes: [{ competencia: "2025-12", receitaBruta: 6750.01 }] }), ctx).achados[0];
    assert.equal(dez.evidencias.limite, 6750);
    const jan = diagnosticar(mei({ dataAbertura: "2025-01-02", apuracoes: [{ competencia: "2025-06", receitaBruta: 81000 }] }), ctx);
    assert.equal(jan.achados.length, 0);
  });

  it("pagamento após baixa: competência da baixa não conta, a seguinte conta (data ou AAAA-MM)", () => {
    for (const dataBaixa of ["2026-03-15", "2026-03"]) {
      const d = diagnosticar(mei({ dataBaixa, guias: [guia("2026-03", 80, "2026-04-20"), guia("2026-04", 80, "2026-05-20")] }), ctx);
      assert.deepEqual(d.achados.map((a) => a.competencia), ["2026-04"]);
    }
  });
});

describe("regressão: resumo com IA (cliente falso)", () => {
  const diag = diagnosticar(mei({ guias: [guia("2026-05", 81.9, "2026-06-10"), guia("2026-05", 81.9, "2026-06-11")] }), ctx);
  const falso = (resposta: Partial<BetaMessage> | Error) => ({
    beta: { messages: { async create(_: MessageCreateParamsNonStreaming) { if (resposta instanceof Error) throw resposta; return resposta as BetaMessage; } } },
  });
  it("recusa e conteúdo vazio viram undefined", async () => {
    assert.equal(await resumirComIa(diag, falso({ stop_reason: "refusal", content: [] }), "claude-opus-5-5"), undefined);
    assert.equal(await resumirComIa(diag, falso({ stop_reason: "end_turn", content: [] }), "claude-opus-5-5"), undefined);
  });
  it("erro do cliente propaga (o CLI trata e gera o relatório sem resumo)", async () => {
    await assert.rejects(resumirComIa(diag, falso(new Error("401")), "claude-opus-5-5"), /401/);
  });
});

describe("bugs corrigidos", () => {
  it("B1 sem 'guias' não deve derrubar o diagnóstico", () => {
    assert.doesNotThrow(() => diagnosticar({ cnpj: "x", razaoSocial: "x", regime: "MEI" } as EmpresaPenteFino, ctx));
  });

  it("B2 competência em formato errado não pode sumir como 'fora do prazo'", () => {
    for (const competencia of ["2026/09", "09-2026"]) {
      const d = diagnosticar(mei({ guias: [guia(competencia, 81.9, "2026-10-10"), guia(competencia, 81.9, "2026-10-11")] }), ctx);
      assert.ok(d.foraDoPrazo === 0 && (d.totalPagoAMais === 81.9 || d.avisos.some((a) => /competência/i.test(a))), `${competencia}: ${JSON.stringify(d)}`);
    }
  });

  it("B3 data de referência inválida deve ser rejeitada", () => {
    assert.throws(() => diagnosticar(mei({ guias: [guia("2026-05", 81.9, "2026-06-10"), guia("2026-05", 81.9, "2026-06-11")] }), carregarContexto("2026/10")));
  });

  it("B4 dataBaixa em DD/MM/AAAA não pode marcar a própria competência da baixa como pago a mais", () => {
    const d = diagnosticar(mei({ dataBaixa: "15/03/2026", guias: [guia("2026-03", 80, "2026-04-20")] }), ctx);
    assert.equal(d.totalPagoAMais, 0);
  });

  it("B5 guia em duplicidade após a baixa não pode ser contada duas vezes", () => {
    const d = diagnosticar(mei({ dataBaixa: "2026-03-15", guias: [guia("2026-04", 80, "2026-05-20"), guia("2026-04", 80, "2026-05-21")] }), ctx);
    assert.equal(d.totalPagoAMais, 160); 
  });

  it("B6 Simples: duplicata exata não pode depender de qual guia foi paga primeiro", () => {
    const d = diagnosticar(simples({ guias: [guia("2026-05", 120, "2026-06-01"), guia("2026-05", 1000, "2026-06-20"), guia("2026-05", 1000, "2026-06-21")] }), ctx);
    assert.equal(d.totalPagoAMais, 1000); 
  });

  it("B7 Simples: igualdade de valor deve ser em centavos", () => {
    const d = diagnosticar(simples({ guias: [guia("2026-05", 0.1 + 0.2, "2026-06-10"), guia("2026-05", 0.3, "2026-06-11")] }), ctx);
    assert.equal(d.totalPagoAMais, 0.3);
  });

  it("B8 mesma guia importada duas vezes (mesmo numeroDocumento) não é duplicidade", () => {
    const d = diagnosticar(simples({ guias: [guia("2026-05", 1000, "2026-06-20", "07202612345"), guia("2026-05", 1000, "2026-06-20", "07202612345")] }), ctx);
    assert.equal(d.totalPagoAMais, 0);
  });

  it("B9 valores negativos, nulos ou texto são rejeitados ou ignorados com aviso (nunca total negativo/NaN)", () => {
    const negativo = diagnosticar(mei({ guias: [guia("2026-05", 81.9, "2026-06-10"), guia("2026-05", -500, "2026-06-11")] }), ctx);
    assert.ok(negativo.totalPagoAMais >= 0, `total ${negativo.totalPagoAMais}`);
    const texto = diagnosticar(mei({ guias: ["a", "b", "c"].map((_, i) => guia("2026-05", "81.90" as unknown as number, `2026-06-1${i}`)) }), ctx);
    assert.ok(Number.isFinite(texto.totalPagoAMais), `total ${texto.totalPagoAMais}`);
    assert.doesNotThrow(() => diagnosticar(mei({ guias: [guia("2026-05", null as unknown as number, "2026-06-10"), guia("2026-05", 81.9, "2026-06-11")] }), ctx));
    const receitaTexto = diagnosticar(mei({ apuracoes: [{ competencia: "2025-01", receitaBruta: "7200" as unknown as number }, { competencia: "2025-02", receitaBruta: "7900" as unknown as number }] }), ctx);
    assert.equal(receitaTexto.achados.length, 0); 
  });

  it("B10 Fator R: folha12 null (dado faltando) não pode virar 'pago a menos'", () => {
    const d = diagnosticar(simples({ apuracoes: [servico(null, 100000, "III")] }), ctx);
    assert.equal(d.achados.length, 0); 
  });

  it("B11 Fator R: diferença zero não gera achado nem '-R$ 0,00'", () => {
    const d = diagnosticar(simples({ apuracoes: [servico(1000, 100000, "III", 0)] }), ctx);
    assert.equal(d.achados.length, 0);
  });

  it("B12 Fator R: texto não pode dizer '28,0% (< 28%)'", () => {
    const [achado] = diagnosticar(simples({ apuracoes: [servico(27996, 100000, "III")] }), ctx).achados;
    assert.doesNotMatch(achado.explicacao, /28,0% \(< 28%\)/);
  });

  it("B13 monofásico: rbt12 inválido não pode gerar NaN no total", () => {
    const d = diagnosticar(simples({
      apuracoes: [{ competencia: "2026-08", receitaBruta: 60000, rbt12: "abc" as unknown as number, atividade: "comercio" }],
      itensNotas: [{ competencia: "2026-08", ncm: "8708.30.90", valor: 10000 }],
    }), ctx);
    assert.ok(Number.isFinite(d.totalPagoAMais));
  });

  it("B14 RBT12 acima de 4,8 milhões deve gerar aviso de exclusão do Simples", () => {
    const d = diagnosticar(simples({
      apuracoes: [{ competencia: "2026-08", receitaBruta: 60000, rbt12: 6_000_000, atividade: "comercio" }],
      itensNotas: [{ competencia: "2026-08", ncm: "8708.30.90", valor: 10000 }],
    }), ctx);
    assert.ok(d.avisos.some((a) => /4\.800\.000|exclus/i.test(a)) || d.achados.some((a) => a.tipo === "risco"));
  });

  it("B15 monofásico: 8409.10.00 (motor de aeronave) não é autopeça monofásica", () => {
    assert.equal(grupoMonofasico("8409.10.00", ctx.monofasicos), null);
    assert.equal(grupoMonofasico("8409.91.90", ctx.monofasicos), "Autopeças e pneus");
  });

  it("B16 prazo de 5 anos conta da data do pagamento (CTN art. 168, I), não da competência", () => {
    // Competência 2021-09 paga em atraso em 2022-01: ainda restituível em 2026-10-24.
    const d = diagnosticar(mei({ guias: [guia("2021-09", 60, "2022-01-10"), guia("2021-09", 60, "2022-01-11")] }), ctx);
    assert.equal(d.totalPagoAMais, 60);
  });

  it("B17 relatório: '|', quebra de linha e HTML em campos de entrada não quebram o Markdown", () => {
    const d = diagnosticar(simples({ razaoSocial: "Foo | Bar\nLinha 2 <script>", apuracoes: [servico(96000, 387000, "III", 30000)] }), ctx);
    d.achados[0].explicacao = "texto com | barra\ne quebra";
    const md = relatorioMarkdown(d);
    const titulo = md.split("\n")[0];
    assert.ok(titulo.includes("Linha 2"), "título quebrado em duas linhas");
    assert.ok(titulo.includes("&lt;script&gt;"));
    const linha = md.split("\n").find((l) => l.includes("Pago a menos"))!;
    assert.equal(linha.split(/(?<!\\)\|/).length, 7, linha); // 5 colunas
  });

  it("B18 Fator R exatamente 28% com centavos (7.000,07 / 25.000,25) vai para o III", () => {
    const d = diagnosticar(simples({ apuracoes: [servico(7000.07, 25000.25, "V")] }), ctx);
    assert.equal(d.achados[0]?.tipo, "pago_a_mais"); 
  });

  it("B19 monofásico: segregar mais do que as vendas monofásicas é indício de pago a menos", () => {
    const d = diagnosticar(simples({
      apuracoes: [{ competencia: "2026-08", receitaBruta: 60000, rbt12: 650000, atividade: "comercio", receitaMonofasicaSegregada: 50000 }],
      itensNotas: [{ competencia: "2026-08", ncm: "8708.30.90", valor: 10000 }],
    }), ctx);
    assert.ok(d.achados.some((a) => a.regra === "monofasico" && a.tipo !== "pago_a_mais"));
  });
});

describe("LC 238/2026: limite do MEI por ano e reforma tributária", () => {
  it("2026 continua com R$ 81 mil; 2027 sobe para R$ 110 mil; 2028 para R$ 140 mil", () => {
    assert.equal(diagnosticar(mei({ apuracoes: [{ competencia: "2026-06", receitaBruta: 81000.01 }] }), ctx).achados.length, 1);
    assert.equal(diagnosticar(mei({ apuracoes: [{ competencia: "2027-06", receitaBruta: 110000 }] }), ctx).achados.length, 0);
    assert.equal(diagnosticar(mei({ apuracoes: [{ competencia: "2027-06", receitaBruta: 110000.01 }] }), ctx).achados.length, 1);
    assert.equal(diagnosticar(mei({ apuracoes: [{ competencia: "2028-06", receitaBruta: 140000 }] }), ctx).achados.length, 0);
  });

  it("proporcional de 2027: R$ 9.166,67 por mês (abertura em julho = 6 meses)", () => {
    const [achado] = diagnosticar(mei({ dataAbertura: "2027-07-10", apuracoes: [{ competencia: "2027-12", receitaBruta: 70000 }] }), ctx).achados;
    assert.equal(achado.evidencias.limite, 55000.02);
    assert.match(achado.explicacao, /início da atividade/);
  });

  it("monofásico depois de 2026 vira ponto de atenção, sem valor estimado", () => {
    const d = diagnosticar(simples({
      apuracoes: [{ competencia: "2027-02", receitaBruta: 60000, rbt12: 650000, atividade: "comercio" }],
      itensNotas: [{ competencia: "2027-02", ncm: "8708.30.90", valor: 10000 }],
    }), ctx);
    assert.deepEqual(d.achados.map((a) => `${a.regra}:${a.tipo}`), ["monofasico:risco"]);
    assert.ok(d.avisos.some((a) => /NCM/.test(a)));
  });
});
