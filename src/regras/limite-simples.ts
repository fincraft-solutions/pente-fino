import { formatarReais } from "../simples.ts";
import type { Achado, Contexto, EmpresaPenteFino } from "../tipos.ts";

// RBT12 acima do teto: a empresa deveria ter sido excluída do Simples, e os recálculos das outras regras perdem o sentido.
export function regraLimiteSimples(empresa: EmpresaPenteFino, contexto: Contexto): Achado[] {
  if (empresa.regime !== "SIMPLES") return [];
  const { limiteSimples } = contexto.parametros;

  return (empresa.apuracoes ?? [])
    .filter((apuracao) => (apuracao.rbt12 ?? 0) > limiteSimples)
    .map((apuracao) => ({
      regra: "limite-simples",
      competencia: apuracao.competencia,
      tipo: "risco" as const,
      valorEstimado: 0,
      explicacao: `A receita dos 12 meses anteriores (${formatarReais(apuracao.rbt12 ?? 0)}) passa o limite de ${formatarReais(limiteSimples)} do Simples Nacional. Os valores estimados para esta competência não são confiáveis.`,
      proximoPasso: "Avaliar com o contador a exclusão do Simples e o regime de tributação correto.",
      evidencias: { rbt12: apuracao.rbt12 ?? 0, limiteSimples },
    }));
}
