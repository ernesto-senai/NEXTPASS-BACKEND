import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import { SIMILARIDADE_MINIMA, TAMANHO_MINIMO_TOLERANCIA } from "../../domain/busca.ts";

// Colunas pesquisáveis. Os nomes vêm só daqui (nunca do usuário), então podem
// entrar direto no SQL; o texto da busca vai sempre como parâmetro.
const CAMPOS = {
  nomeDoUsuario: { tabela: `"Usuario"`, id: `"id"`, texto: `"nome"` },
  cidadeDoAtleta: { tabela: `"Atleta"`, id: `"usuarioId"`, texto: `"cidade"` },
  nacionalidadeDoAtleta: { tabela: `"Atleta"`, id: `"usuarioId"`, texto: `"nacionalidade"` },
  nomeDaAvaliacao: { tabela: `"Avaliacao"`, id: `"id"`, texto: `"nome"` },
  cidadeDaAvaliacao: { tabela: `"Avaliacao"`, id: `"id"`, texto: `"cidade"` },
  clubeDoOlheiro: { tabela: `"Olheiro"`, id: `"usuarioId"`, texto: `"clube"` },
} as const;

export type CampoPesquisavel = keyof typeof CAMPOS;

// % e _ digitados pelo usuário valem como letras, não como curingas do LIKE.
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

// RNF-16: ids das linhas cujo campo combina com a busca, ignorando acentos e
// maiúsculas e tolerando pequenos erros (mesma regra de shared/domain/busca.ts).
export async function idsQueCombinam(
  prisma: PrismaClient,
  campo: CampoPesquisavel,
  busca: string,
): Promise<string[]> {
  const { tabela, id, texto } = CAMPOS[campo];
  const coluna = Prisma.raw(texto);
  const termo = busca.trim();
  const tolerante =
    termo.length >= TAMANHO_MINIMO_TOLERANCIA
      ? Prisma.sql`OR word_similarity(unaccent(lower(${termo})), unaccent(lower(${coluna}))) >= ${SIMILARIDADE_MINIMA}`
      : Prisma.empty;

  const linhas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT ${Prisma.raw(id)}::text AS id
    FROM ${Prisma.raw(tabela)}
    WHERE ${coluna} IS NOT NULL
      AND (
        unaccent(lower(${coluna})) LIKE '%' || unaccent(lower(${escaparLike(termo)})) || '%' ESCAPE '\\'
        ${tolerante}
      )`;
  return linhas.map((linha) => linha.id);
}
