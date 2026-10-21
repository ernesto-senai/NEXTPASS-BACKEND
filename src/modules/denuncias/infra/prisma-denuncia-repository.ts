import type { PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import type { DenunciaRepository } from "../domain/denuncia.ts";

export function criarDenunciaRepositoryPrisma(prisma: PrismaClient): DenunciaRepository {
  return {
    donoDoAlvo: async (alvoTipo, alvoId) => {
      switch (alvoTipo) {
        case "PERFIL":
          return (
            (await prisma.usuario.findUnique({ where: { id: alvoId }, select: { id: true } }))
              ?.id ?? null
          );
        case "VIDEO":
          return (
            (await prisma.video.findUnique({ where: { id: alvoId }, select: { atletaId: true } }))
              ?.atletaId ?? null
          );
        case "CONVITE":
          return (
            (
              await prisma.convite.findUnique({
                where: { id: alvoId },
                select: { olheiroId: true },
              })
            )?.olheiroId ?? null
          );
        case "AVALIACAO":
          return (
            (
              await prisma.avaliacao.findUnique({
                where: { id: alvoId },
                select: { olheiroId: true },
              })
            )?.olheiroId ?? null
          );
      }
    },

    criar: (dados) => prisma.denuncia.create({ data: dados, select: { id: true, status: true } }),

    listar: async (status, paginacao) => {
      const where = { status };
      const [linhas, total] = await prisma.$transaction([
        prisma.denuncia.findMany({
          where,
          select: {
            id: true,
            alvoTipo: true,
            alvoId: true,
            motivo: true,
            status: true,
            criadoEm: true,
            autor: { select: { id: true, nome: true } },
          },
          orderBy: { criadoEm: "asc" },
          ...intervalo(paginacao),
        }),
        prisma.denuncia.count({ where }),
      ]);
      return { dados: linhas, total };
    },

    buscar: (id) =>
      prisma.denuncia.findUnique({
        where: { id },
        select: { id: true, status: true, alvoTipo: true, alvoId: true },
      }),

    analisar: async (id, { status, decisao, adminId }) => {
      await prisma.denuncia.update({
        where: { id },
        data: { status, decisao, analisadaPorId: adminId },
      });
    },

    suspender: async (usuarioId) => {
      await prisma.usuario.update({ where: { id: usuarioId }, data: { status: "SUSPENSO" } });
    },
  };
}
