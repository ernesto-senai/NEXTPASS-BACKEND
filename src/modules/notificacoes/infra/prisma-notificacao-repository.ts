import type { PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import type { NotificacaoRepository } from "../domain/notificacao.ts";

export function criarNotificacaoRepositoryPrisma(prisma: PrismaClient): NotificacaoRepository {
  return {
    criar: async (notificacoes) => {
      if (notificacoes.length > 0) await prisma.notificacao.createMany({ data: notificacoes });
    },

    listar: async (usuarioId, paginacao) => {
      const [linhas, total, naoLidas] = await prisma.$transaction([
        prisma.notificacao.findMany({
          where: { usuarioId },
          select: { id: true, tipo: true, texto: true, dados: true, lida: true, criadoEm: true },
          orderBy: { criadoEm: "desc" },
          ...intervalo(paginacao),
        }),
        prisma.notificacao.count({ where: { usuarioId } }),
        prisma.notificacao.count({ where: { usuarioId, lida: false } }),
      ]);

      return {
        // dados é sempre gravado por criar(), como um objeto de textos.
        dados: linhas.map((linha) => ({
          ...linha,
          dados: linha.dados as Record<string, string> | null,
        })),
        total,
        naoLidas,
      };
    },

    marcarComoLidas: async (usuarioId, ids) => {
      await prisma.notificacao.updateMany({
        where: { usuarioId, lida: false, ...(ids ? { id: { in: ids } } : {}) },
        data: { lida: true },
      });
    },
  };
}
