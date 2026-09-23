import { z } from "zod";

// Listas aceitam ?pagina=1&limite=20 (RNF-02).
export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export type Paginacao = z.infer<typeof paginacaoSchema>;

export interface Pagina<T> {
  dados: T[];
  total: number;
  pagina: number;
}

export function paraPrisma({ pagina, limite }: Paginacao) {
  return { skip: (pagina - 1) * limite, take: limite };
}
