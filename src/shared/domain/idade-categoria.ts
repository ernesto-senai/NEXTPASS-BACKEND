// Regras puras de domínio: sem Express, sem Prisma, fáceis de testar.

export type Categoria =
  "SUB_9" | "SUB_11" | "SUB_13" | "SUB_15" | "SUB_17" | "SUB_20" | "PROFISSIONAL";

// RN-01: idade que o atleta completa no ano de referência, por categoria. Até a
// Sub-17 as faixas têm dois anos (em 2026, a Sub-17 reúne nascidos em 2009 e
// 2010, conforme o glossário). As faixas Sub-20 (18 a 20 anos) e Profissional
// são uma proposta a validar com a equipe.
const IDADES_NO_ANO: Record<Categoria, readonly [number, number]> = {
  SUB_9: [0, 9],
  SUB_11: [10, 11],
  SUB_13: [12, 13],
  SUB_15: [14, 15],
  SUB_17: [16, 17],
  SUB_20: [18, 20],
  PROFISSIONAL: [21, 150],
};

// RN-01: idade calculada pela data de nascimento.
export function calcularIdade(dataNascimento: Date, hoje = new Date()): number {
  const idade = hoje.getUTCFullYear() - dataNascimento.getUTCFullYear();
  const mes = hoje.getUTCMonth() - dataNascimento.getUTCMonth();
  const aindaNaoFezAniversario =
    mes < 0 || (mes === 0 && hoje.getUTCDate() < dataNascimento.getUTCDate());
  return aindaNaoFezAniversario ? idade - 1 : idade;
}

// RN-01: a categoria depende só do ano de nascimento.
export function calcularCategoria(
  dataNascimento: Date,
  anoReferencia = new Date().getUTCFullYear(),
): Categoria {
  const idadeNoAno = anoReferencia - dataNascimento.getUTCFullYear();
  const categorias = Object.keys(IDADES_NO_ANO) as Categoria[];
  return (
    categorias.find((categoria) => idadeNoAno <= IDADES_NO_ANO[categoria][1]) ?? "PROFISSIONAL"
  );
}

// Caminho inverso, para filtrar por categoria: anos de nascimento que a formam.
export function anosDaCategoria(categoria: Categoria, anoReferencia: number) {
  const [idadeMinima, idadeMaxima] = IDADES_NO_ANO[categoria];
  return { de: anoReferencia - idadeMaxima, ate: anoReferencia - idadeMinima };
}

// RN-03: menores de 18 anos precisam de responsável vinculado.
export function ehMenorDeIdade(dataNascimento: Date, hoje = new Date()): boolean {
  return calcularIdade(dataNascimento, hoje) < 18;
}
