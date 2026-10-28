import { formatarReais } from "./simples.ts";
import type { Diagnostico, TipoAchado } from "./tipos.ts";

const ROTULOS: Record<TipoAchado, string> = {
  pago_a_mais: "Pago a mais",
  pago_a_menos: "Pago a menos",
  risco: "Ponto de atenção",
};

/** Texto de entrada dentro do Markdown: sem quebra de linha, sem `|` cru (quebra a tabela) e sem HTML. */
export function escaparMarkdown(texto: string): string {
  return texto.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Relatório em Markdown, montado só com regras (sem IA), para ser reproduzível e auditável. */
export function relatorioMarkdown(diagnostico: Diagnostico, resumoIa?: string): string {
  const linhas = [
    `# Pente-Fino — ${escaparMarkdown(diagnostico.razaoSocial)}`,
    "",
    `CNPJ ${escaparMarkdown(diagnostico.cnpj)} · ${diagnostico.regime === "MEI" ? "MEI" : "Simples Nacional"} · referência ${diagnostico.dataReferencia}`,
    "",
    `**Indícios de pagamento a mais:** ${formatarReais(diagnostico.totalPagoAMais)}  `,
    `**Indícios de pagamento a menos:** ${formatarReais(diagnostico.totalPagoAMenos)}`,
    "",
  ];

  if (resumoIa) linhas.push("## Resumo", "", resumoIa, "");

  if (diagnostico.achados.length === 0) {
    linhas.push("Nenhum indício encontrado com as regras atuais.");
  } else {
    linhas.push("## Achados", "", "| Competência | Tipo | Valor estimado | O que foi visto | Próximo passo |", "|---|---|---|---|---|");
    for (const achado of diagnostico.achados) {
      const valor = achado.valorEstimado > 0 ? formatarReais(achado.valorEstimado) : "—";
      const celulas = [achado.competencia, ROTULOS[achado.tipo], valor, achado.explicacao, achado.proximoPasso].map(escaparMarkdown);
      linhas.push(`| ${celulas.join(" | ")} |`);
    }
  }

  if (diagnostico.avisos.length > 0) linhas.push("", "## Avisos", "", ...diagnostico.avisos.map((aviso) => `- ${escaparMarkdown(aviso)}`));

  linhas.push(
    "",
    "_Diagnóstico automático com base nos dados informados. Os valores são estimativas e precisam ser confirmados por um contador antes de qualquer retificação ou pedido de restituição._",
  );
  return linhas.join("\n");
}
