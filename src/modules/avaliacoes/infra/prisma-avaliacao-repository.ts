import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import {
  type AvaliacaoRepository,
  type AvaliacaoResumo,
  clubeVisivel,
} from "../domain/avaliacao.ts";

// Campos do card; também usados pelo módulo de inscrições.
export const selecaoResumo = {
  id: true,
  nome: true,
  tipo: true,
  categoria: true,
  posicoes: true,
  dataHora: true,
  local: true,
  cidade: true,
  uf: true,
  taxaCentavos: true,
  vagas: true,
  vagasOcupadas: true,
  status: true,
  olheiro: {
    select: {
      usuarioId: true,
      verificado: true,
      atuacao: true,
      clube: true,
      usuario: { select: { nome: true } },
    },
  },
} satisfies Prisma.AvaliacaoSelect;

type AvaliacaoSelecionada = Prisma.AvaliacaoGetPayload<{ select: typeof selecaoResumo }>;

export function paraResumo({ olheiro, ...avaliacao }: AvaliacaoSelecionada): AvaliacaoResumo {
  return {
    ...avaliacao,
    clube: clubeVisivel(olheiro),
    olheiro: { id: olheiro.usuarioId, nome: olheiro.usuario.nome },
  };
}

export function criarAvaliacaoRepositoryPrisma(prisma: PrismaClient): AvaliacaoRepository {
  return {
    listarFuturas: async (paginacao, agora) => {
      const where = {
        status: { in: ["ABERTA", "ESGOTADA"] },
        dataHora: { gt: agora },
        // Avaliações de contas suspensas pela moderação somem do feed.
        olheiro: { usuario: { status: "ATIVO" } },
      } satisfies Prisma.AvaliacaoWhereInput;

      const [linhas, total] = await prisma.$transaction([
        prisma.avaliacao.findMany({
          where,
          select: selecaoResumo,
          orderBy: { dataHora: "asc" },
          ...intervalo(paginacao),
        }),
        prisma.avaliacao.count({ where }),
      ]);

      return { dados: linhas.map(paraResumo), total };
    },
  };
}
