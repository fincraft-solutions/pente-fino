import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { carregarContexto, diagnosticar } from "./diagnostico.ts";
import { relatorioMarkdown } from "./relatorio.ts";
import { resumirComIa } from "./resumo-ia.ts";
import type { EmpresaPenteFino } from "./tipos.ts";

const USO = "Uso: npm run diagnosticar -- exemplos/simples-servicos.json [--com-ia] [--json] [--referencia AAAA-MM-DD]";

function falhar(mensagem: string, codigo = 2): never {
  console.error(mensagem);
  process.exit(codigo);
}

let opcoes: { values: { "com-ia"?: boolean; json?: boolean; referencia?: string }; positionals: string[] };
try {
  opcoes = parseArgs({
    allowPositionals: true,
    options: {
      "com-ia": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      referencia: { type: "string" },
    },
  });
} catch (erro) {
  falhar(`${(erro as Error).message}\n${USO}`);
}
const { values, positionals } = opcoes;

const arquivo = positionals[0];
if (!arquivo) falhar(USO, 1);

let entrada: EmpresaPenteFino;
try {
  entrada = JSON.parse(readFileSync(arquivo, "utf8")) as EmpresaPenteFino;
} catch (erro) {
  const motivo = (erro as NodeJS.ErrnoException).code === "ENOENT" ? "arquivo não encontrado" : "JSON inválido";
  falhar(`Não consegui ler ${arquivo}: ${motivo}.`);
}

let diagnostico;
try {
  diagnostico = diagnosticar(entrada, carregarContexto(values.referencia));
} catch (erro) {
  falhar(`Entrada inválida: ${(erro as Error).message}`);
}
for (const aviso of diagnostico.avisos) console.warn(`Aviso: ${aviso}`);

if (values.json) {
  if (values["com-ia"]) console.warn("Aviso: --com-ia é ignorado com --json.");
  console.log(JSON.stringify(diagnostico, null, 2));
} else {
  let resumo: string | undefined;
  if (values["com-ia"]) {
    try {
      resumo = await resumirComIa(diagnostico);
    } catch (erro) {
      // Sem chave ou com a API fora, o relatório sai do mesmo jeito, só sem o resumo.
      console.warn(`Aviso: resumo com IA indisponível (${(erro as Error).message.split("\n")[0]}). Relatório gerado sem resumo.`);
    }
  }
  const relatorio = relatorioMarkdown(diagnostico, resumo);
  mkdirSync("saida", { recursive: true });
  const destino = `saida/${basename(arquivo, ".json")}.md`;
  writeFileSync(destino, relatorio);
  console.log(relatorio);
  console.log(`\nRelatório salvo em ${destino}`);
}
