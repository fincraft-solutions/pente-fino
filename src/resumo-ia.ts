import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Diagnostico } from "./tipos.ts";

const PROMPT = readFileSync(new URL("../prompts/resumo.md", import.meta.url), "utf8");
const MODELOS_COM_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export interface ClienteClaude {
  beta: { messages: { create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage> } };
}

/** Só o que o resumo precisa: sem CNPJ, razão social nem evidências (minimização de dados, LGPD). */
export function paraResumo(diagnostico: Diagnostico) {
  return {
    regime: diagnostico.regime,
    totalPagoAMais: diagnostico.totalPagoAMais,
    totalPagoAMenos: diagnostico.totalPagoAMenos,
    achados: diagnostico.achados.map(({ competencia, tipo, valorEstimado, explicacao, proximoPasso }) => ({
      competencia,
      tipo,
      valorEstimado,
      explicacao,
      proximoPasso,
    })),
  };
}

export function montarRequisicaoResumo(diagnostico: Diagnostico, modelo: string): MessageCreateParamsNonStreaming {
  const requisicao: MessageCreateParamsNonStreaming = {
    model: modelo,
    max_tokens: 4000,
    output_config: { effort: "low" },
    system: PROMPT,
    messages: [{ role: "user", content: JSON.stringify(paraResumo(diagnostico)) }],
  };
  if (MODELOS_COM_FALLBACK.has(modelo)) {
    requisicao.betas = ["server-side-fallback-2026-07-01"];
    requisicao.fallbacks = "default";
  }
  return requisicao;
}

/** Resumo em linguagem simples. A IA só redige: todos os números vêm do diagnóstico por regras. */
export async function resumirComIa(
  diagnostico: Diagnostico,
  cliente: ClienteClaude = new Anthropic(),
  modelo: string = process.env.PENTE_FINO_MODELO || "claude-opus-5-5",
): Promise<string | undefined> {
  const mensagem = await cliente.beta.messages.create(montarRequisicaoResumo(diagnostico, modelo));
  if (mensagem.stop_reason === "refusal") return undefined;
  const texto = mensagem.content
    .filter((bloco) => bloco.type === "text")
    .map((bloco) => bloco.text)
    .join("")
    .trim();
  return texto || undefined;
}
