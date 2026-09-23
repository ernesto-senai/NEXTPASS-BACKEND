// Regras puras de domínio: sem Express, sem Prisma, fáceis de testar.

export type Categoria =
  "SUB_9" | "SUB_11" | "SUB_13" | "SUB_15" | "SUB_17" | "SUB_20" | "PROFISSIONAL";

// RN-01: idade calculada pela data de nascimento.
export function calcularIdade(dataNascimento: Date, hoje = new Date()): number {
  const idade = hoje.getUTCFullYear() - dataNascimento.getUTCFullYear();
  const mes = hoje.getUTCMonth() - dataNascimento.getUTCMonth();
  const aindaNaoFezAniversario =
    mes < 0 || (mes === 0 && hoje.getUTCDate() < dataNascimento.getUTCDate());
  return aindaNaoFezAniversario ? idade - 1 : idade;
}

// RN-01: a categoria depende só do ano de nascimento. Até a Sub-17 as faixas
// têm dois anos (em 2026, a Sub-17 reúne nascidos em 2009 e 2010, conforme o
// glossário). As faixas Sub-20 (18 a 20 anos) e Profissional são uma proposta
// a validar com a equipe.
export function calcularCategoria(
  dataNascimento: Date,
  anoReferencia = new Date().getUTCFullYear(),
): Categoria {
  const idadeNoAno = anoReferencia - dataNascimento.getUTCFullYear();
  if (idadeNoAno <= 9) return "SUB_9";
  if (idadeNoAno <= 11) return "SUB_11";
  if (idadeNoAno <= 13) return "SUB_13";
  if (idadeNoAno <= 15) return "SUB_15";
  if (idadeNoAno <= 17) return "SUB_17";
  if (idadeNoAno <= 20) return "SUB_20";
  return "PROFISSIONAL";
}

// RN-03: menores de 18 anos precisam de responsável vinculado.
export function ehMenorDeIdade(dataNascimento: Date, hoje = new Date()): boolean {
  return calcularIdade(dataNascimento, hoje) < 18;
}
