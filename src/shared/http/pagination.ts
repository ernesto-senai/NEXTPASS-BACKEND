import { z } from "zod";

// Listas aceitam ?pagina=1&limite=20 (RNF-02). Os tipos ficam em shared/domain/pagina.ts.
export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});
