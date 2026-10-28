import type { Achado, Contexto, EmpresaPenteFino } from "../tipos.ts";
import { regraDuplicidade } from "./duplicidade.ts";
import { regraFatorR } from "./fator-r.ts";
import { regraLimiteSimples } from "./limite-simples.ts";
import { regraMonofasico } from "./monofasico.ts";
import { regraTetoMei } from "./teto-mei.ts";

export type Regra = (empresa: EmpresaPenteFino, contexto: Contexto) => Achado[];

/** Ordem das etapas do roadmap: (a) guias e limites, (b) anexo e Fator R, (c) monofásico. Nova regra entra aqui. */
export const REGRAS: Record<string, Regra> = {
  duplicidade: regraDuplicidade,
  "teto-mei": regraTetoMei,
  "limite-simples": regraLimiteSimples,
  "fator-r": regraFatorR,
  monofasico: regraMonofasico,
};
