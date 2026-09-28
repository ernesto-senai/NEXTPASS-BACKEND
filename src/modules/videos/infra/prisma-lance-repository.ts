import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import type { LanceRepository } from "../domain/lance.ts";

export function criarLanceRepositoryPrisma(prisma: PrismaClient): LanceRepository {
  return {
    listarFeed: async (paginacao) => {
      // Lances de contas suspensas pela moderação somem do feed.
      const where = {
        atleta: { usuario: { status: "ATIVO" } },
      } satisfies Prisma.VideoWhereInput;

      const [linhas, total] = await prisma.$transaction([
        prisma.video.findMany({
          where,
          select: {
            id: true,
            url: true,
            legenda: true,
            localizacao: true,
            duracaoSeg: true,
            criadoEm: true,
            _count: { select: { visualizacoes: true } },
            atleta: { select: { usuario: { select: { id: true, nome: true, fotoUrl: true } } } },
          },
          orderBy: { criadoEm: "desc" },
          ...intervalo(paginacao),
        }),
        prisma.video.count({ where }),
      ]);

      return {
        dados: linhas.map(({ _count, atleta, ...lance }) => ({
          ...lance,
          visualizacoes: _count.visualizacoes,
          atleta: atleta.usuario,
        })),
        total,
      };
    },

    existe: async (id) => (await prisma.video.count({ where: { id } })) > 0,

    registrarVisualizacao: async (videoId, olheiroId) => {
      await prisma.visualizacao.create({ data: { videoId, olheiroId } });
    },
  };
}
