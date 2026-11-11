import { createHash } from "node:crypto";
import type { CandidatoDoFeed } from "./lance.ts";

// RF-32: primeiro os lances que o olheiro ainda não viu, depois os já vistos, cada grupo
// embaralhado pela semente. A mesma semente dá a mesma ordem, e as páginas não se repetem.
export function ordenarFeed(candidatos: CandidatoDoFeed[], semente: number): string[] {
  const sorteio = (id: string) => createHash("md5").update(`${semente}:${id}`).digest("hex");

  return candidatos
    .map((candidato) => ({ ...candidato, chave: sorteio(candidato.id) }))
    .sort((a, b) => Number(a.visto) - Number(b.visto) || (a.chave < b.chave ? -1 : 1))
    .map(({ id }) => id);
}
