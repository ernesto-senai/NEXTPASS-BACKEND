// Listas paginadas (RNF-02): ?pagina=1&limite=20 e resposta { dados, total, pagina }.
export interface Paginacao {
  pagina: number;
  limite: number;
}

export interface Pagina<T> {
  dados: T[];
  total: number;
  pagina: number;
}

// Deslocamento da página para consultas: quantos itens pular e quantos trazer.
export function intervalo({ pagina, limite }: Paginacao) {
  return { skip: (pagina - 1) * limite, take: limite };
}
