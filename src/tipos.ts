/** Competência no formato AAAA-MM. */
export type Competencia = string;

export type Anexo = "I" | "III" | "V";

/** Contrato de entrada. Veja a skill conectar-dados para mapear as tabelas do Wavern para este formato. */
export interface EmpresaPenteFino {
  cnpj: string;
  razaoSocial: string;
  regime: "MEI" | "SIMPLES";
  /** Data (AAAA-MM-DD) de início da atividade; usada no limite proporcional do MEI. */
  dataAbertura?: string | null;
  /** Data (AAAA-MM-DD) da baixa do CNPJ ou do desenquadramento, se houver. */
  dataBaixa?: string | null;
  /** Guias DAS efetivamente pagas. */
  guias: GuiaDas[];
  /** Uma por competência. MEI: só receitaBruta é usada. */
  apuracoes?: Apuracao[];
  /** Itens das notas de venda (para a regra de monofásico). */
  itensNotas?: ItemNota[];
}

export interface GuiaDas {
  competencia: Competencia;
  valorPago: number;
  dataPagamento: string;
  numeroDocumento?: string;
}

export interface Apuracao {
  competencia: Competencia;
  receitaBruta: number;
  /** Receita bruta dos 12 meses anteriores à competência. */
  rbt12?: number;
  /** Folha dos 12 meses anteriores, com pró-labore e encargos. */
  folha12?: number;
  /** servico_fator_r: atividade do Anexo V que pode ir ao III pelo Fator R. */
  atividade?: "comercio" | "servico_fator_r" | "servico_anexo_iii" | "outra";
  anexoDeclarado?: Anexo;
  /** Parte da receita informada no PGDAS-D como monofásica (PIS/Cofins já recolhidos na indústria). */
  receitaMonofasicaSegregada?: number;
}

export interface ItemNota {
  competencia: Competencia;
  ncm: string;
  valor: number;
}

export type TipoAchado = "pago_a_mais" | "pago_a_menos" | "risco";

export interface Achado {
  regra: string;
  competencia: Competencia;
  tipo: TipoAchado;
  /** Estimativa em reais. Zero quando o achado é só um risco sem valor calculável. */
  valorEstimado: number;
  explicacao: string;
  proximoPasso: string;
  evidencias: Record<string, string | number>;
  /** AAAA-MM-DD do pagamento que gerou o achado; base do prazo de restituição. Sem ela, usa o vencimento do DAS. */
  dataPagamento?: string;
}

export interface Diagnostico {
  cnpj: string;
  razaoSocial: string;
  regime: EmpresaPenteFino["regime"];
  dataReferencia: string;
  achados: Achado[];
  totalPagoAMais: number;
  totalPagoAMenos: number;
  /** Achados fora do prazo de restituição, só para informação. */
  foraDoPrazo: number;
  avisos: string[];
}

export interface Faixa {
  ate: number;
  aliquota: number;
  deducao: number;
}

export interface Parametros {
  prazoRestituicaoMeses: number;
  limiteFatorR: number;
  /** Limite do MEI por ano-calendário: vale a maior chave menor ou igual ao ano. */
  limitesMei: Record<string, { anual: number; mensalProporcional: number }>;
  /** Última competência (AAAA-MM) em que a partilha de PIS/Cofins do Anexo I vale. */
  partilhaPisCofinsVigenteAte: string;
  limiteSimples: number;
  anexos: Record<Anexo, Faixa[]>;
  participacaoPisCofinsAnexoI: number[];
  verificado_em: string | null;
}

export interface GrupoMonofasico {
  grupo: string;
  prefixos: string[];
  /** Prefixos que casam com `prefixos` mas não são monofásicos. */
  excecoes?: string[];
}

export interface Contexto {
  parametros: Parametros;
  monofasicos: GrupoMonofasico[];
  /** verificado_em da lista de NCM monofásicos; null = lista de exemplo. */
  monofasicosVerificadosEm: string | null;
  /** Data (AAAA-MM-DD) que serve de base para o prazo de 5 anos. */
  dataReferencia: string;
}
