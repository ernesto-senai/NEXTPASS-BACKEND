import type { PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import { paraResumo, selecaoResumo } from "../../avaliacoes/infra/prisma-avaliacao-repository.ts";
import { STATUS_ATIVOS } from "../../inscricoes/domain/inscricao.ts";
import type { ConviteRepository } from "../domain/convite.ts";

export function criarConviteRepositoryPrisma(prisma: PrismaClient): ConviteRepository {
  return {
    listarDoAtleta: async (atletaId, paginacao) => {
      const where = { atletaId };

      const [linhas, total] = await prisma.$transaction([
        prisma.convite.findMany({
          where,
          select: {
            id: true,
            status: true,
            mensagem: true,
            criadoEm: true,
            avaliacao: { select: selecaoResumo },
            inscricao: { select: { id: true, status: true } },
          },
          orderBy: { criadoEm: "desc" },
          ...intervalo(paginacao),
        }),
        prisma.convite.count({ where }),
      ]);

      return {
        dados: linhas.map(({ avaliacao, ...convite }) => ({
          ...convite,
          avaliacao: paraResumo(avaliacao),
        })),
        total,
      };
    },

    buscar: async (id) => {
      const convite = await prisma.convite.findUnique({
        where: { id },
        select: {
          id: true,
          olheiroId: true,
          status: true,
          atleta: { select: { usuarioId: true, usuario: { select: { nome: true } } } },
          avaliacao: { select: { id: true, nome: true, dataHora: true, status: true } },
        },
      });
      if (!convite) return null;

      const { atleta, ...dados } = convite;
      return { ...dados, atleta: { id: atleta.usuarioId, nome: atleta.usuario.nome } };
    },

    recusar: async (id, agora) => {
      await prisma.convite.update({
        where: { id },
        data: { status: "RECUSADO", respondidoEm: agora },
      });
    },

    avaliacaoParaConvite: (avaliacaoId) =>
      prisma.avaliacao.findUnique({
        where: { id: avaliacaoId },
        select: { olheiroId: true, nome: true, dataHora: true, status: true },
      }),

    jaConvidado: async (atletaId, avaliacaoId) => {
      const [convites, inscricoes] = await prisma.$transaction([
        prisma.convite.count({
          where: { atletaId, avaliacaoId, status: { in: ["PENDENTE", "ACEITO"] } },
        }),
        prisma.inscricao.count({
          where: { atletaId, avaliacaoId, status: { in: [...STATUS_ATIVOS] } },
        }),
      ]);
      return convites + inscricoes > 0;
    },

    criar: (dados) =>
      prisma.convite.create({ data: dados, select: { id: true, status: true, criadoEm: true } }),
  };
}
