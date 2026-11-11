import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import type { LanceRepository } from "../domain/lance.ts";

const camposDoLance = {
  id: true,
  url: true,
  legenda: true,
  localizacao: true,
  duracaoSeg: true,
  destaque: true,
  horizontal: true,
  criadoEm: true,
} satisfies Prisma.VideoSelect;

export function criarLanceRepositoryPrisma(prisma: PrismaClient): LanceRepository {
  return {
    criar: (dados) => prisma.video.create({ data: dados, select: camposDoLance }),

    listarDoAtleta: async (atletaId, paginacao) => {
      const [linhas, total] = await prisma.$transaction([
        prisma.video.findMany({
          where: { atletaId },
          select: { ...camposDoLance, _count: { select: { visualizacoes: true } } },
          orderBy: [{ destaque: "desc" }, { criadoEm: "desc" }],
          ...intervalo(paginacao),
        }),
        prisma.video.count({ where: { atletaId } }),
      ]);

      return {
        dados: linhas.map(({ _count, ...lance }) => ({
          ...lance,
          visualizacoes: _count.visualizacoes,
        })),
        total,
      };
    },

    buscarParaDono: (id) =>
      prisma.video.findUnique({
        where: { id },
        select: { atletaId: true, url: true, destaque: true },
      }),

    contarDestaques: (atletaId) => prisma.video.count({ where: { atletaId, destaque: true } }),

    atualizar: (id, dados) =>
      prisma.video.update({ where: { id }, data: dados, select: camposDoLance }),

    remover: async (id) => {
      await prisma.video.delete({ where: { id } });
    },

    listarCandidatosDoFeed: async (olheiroId, ate) => {
      const linhas = await prisma.video.findMany({
        // Lances de contas suspensas pela moderação somem do feed.
        where: { atleta: { usuario: { status: "ATIVO" } }, criadoEm: { lte: ate } },
        select: {
          id: true,
          visualizacoes: {
            where: { olheiroId, criadoEm: { lt: ate } },
            select: { id: true },
            take: 1,
          },
        },
      });
      return linhas.map(({ id, visualizacoes }) => ({ id, visto: visualizacoes.length > 0 }));
    },

    buscarDoFeed: async (ids) => {
      const linhas = await prisma.video.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          url: true,
          legenda: true,
          localizacao: true,
          duracaoSeg: true,
          horizontal: true,
          criadoEm: true,
          _count: { select: { visualizacoes: true } },
          atleta: { select: { usuario: { select: { id: true, nome: true, fotoUrl: true } } } },
        },
      });
      return linhas.map(({ _count, atleta, ...lance }) => ({
        ...lance,
        visualizacoes: _count.visualizacoes,
        atleta: atleta.usuario,
      }));
    },

    existe: async (id) => (await prisma.video.count({ where: { id } })) > 0,

    registrarVisualizacao: async (videoId, olheiroId) => {
      await prisma.visualizacao.create({ data: { videoId, olheiroId } });
    },
  };
}
