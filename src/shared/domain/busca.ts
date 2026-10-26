// RNF-16: a busca ignora acentos e maiúsculas e tolera pequenos erros de
// digitação ("leandor" acha "Leandro", "sao paulo" acha "São Paulo"). No banco
// a mesma regra usa as extensões unaccent e pg_trgm; aqui fica a versão em
// TypeScript, usada pelos testes e documentada para o TCC.

// Abaixo disso a busca só procura o trecho exato: com 1 a 3 letras, a
// tolerância a erro traria resultados demais.
export const TAMANHO_MINIMO_TOLERANCIA = 4;

// Parecença mínima (de 0 a 1) entre a busca e um pedaço do texto, medida por
// trigramas no PostgreSQL (word_similarity).
export const SIMILARIDADE_MINIMA = 0.5;

// "São Paulo" → "sao paulo".
export const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// Quantas letras é preciso trocar, tirar, pôr ou inverter de lugar ("leandor"
// → "leandro" é um erro só) para ir de um texto ao outro.
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

// O texto contém a busca ou, a partir de 4 letras, tem um trecho com até um
// erro a cada 4 letras (ex.: "lendro" em "Leandro Sousa").
export function combinaComBusca(texto: string, busca: string): boolean {
  const alvo = normalizar(texto);
  const procurado = normalizar(busca);
  if (alvo.includes(procurado)) return true;
  if (procurado.length < TAMANHO_MINIMO_TOLERANCIA) return false;

  const erros = Math.floor(procurado.length / 4);
  const palavras = alvo.split(/[^a-z0-9]+/).filter(Boolean);
  const quantas = procurado.split(/\s+/).length;
  // Compara com cada sequência de palavras do mesmo tamanho da busca.
  for (let i = 0; i + quantas <= palavras.length; i++) {
    const trecho = palavras.slice(i, i + quantas).join(" ");
    if (distancia(trecho, procurado) <= erros) return true;
  }
  return false;
}
