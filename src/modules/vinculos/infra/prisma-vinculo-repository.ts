import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { VinculoRepository } from "../domain/vinculo.ts";

export function criarVinculoRepositoryPrisma(prisma: PrismaClient): VinculoRepository {
  return {
    salvarPedido: async ({ atletaId, emailResponsavel, tokenHash, expiraEm }) => {
      const chave = { atletaId_emailResponsavel: { atletaId, emailResponsavel } };
      const existente = await prisma.vinculo.findUnique({
        where: chave,
        select: { id: true, status: true },
      });
      if (existente?.status === "CONFIRMADO") return existente;

      return prisma.vinculo.upsert({
        where: chave,
        create: { atletaId, emailResponsavel, tokenHash, tokenExpiraEm: expiraEm },
        update: { tokenHash, tokenExpiraEm: expiraEm },
        select: { id: true, status: true },
      });
    },

    listarDoAtleta: (atletaId) =>
      prisma.vinculo.findMany({
        where: { atletaId },
        select: {
          id: true,
          emailResponsavel: true,
          status: true,
          responsavel: { select: { nome: true } },
        },
        orderBy: { criadoEm: "desc" },
      }),

    listarDoResponsavel: async (responsavelId) => {
      const vinculos = await prisma.vinculo.findMany({
        where: { responsavelId, status: "CONFIRMADO" },
        select: {
          id: true,
          atleta: {
            select: {
              usuarioId: true,
              dataNascimento: true,
              usuario: { select: { nome: true, fotoUrl: true } },
            },
          },
        },
        orderBy: { criadoEm: "asc" },
      });
      return vinculos.map(({ id, atleta }) => ({
        vinculoId: id,
        atleta: {
          id: atleta.usuarioId,
          nome: atleta.usuario.nome,
          fotoUrl: atleta.usuario.fotoUrl,
          dataNascimento: atleta.dataNascimento,
        },
      }));
    },

    buscarPorToken: async (tokenHash) => {
      const vinculo = await prisma.vinculo.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          emailResponsavel: true,
          status: true,
          tokenExpiraEm: true,
          atleta: { select: { usuarioId: true, usuario: { select: { nome: true } } } },
        },
      });
      if (!vinculo) return null;

      const { atleta, tokenExpiraEm, ...dados } = vinculo;
      return {
        ...dados,
        expiraEm: tokenExpiraEm,
        atleta: { id: atleta.usuarioId, nome: atleta.usuario.nome },
      };
    },

    confirmar: async (id, responsavelId) => {
      await prisma.vinculo.update({
        where: { id },
        data: { responsavelId, status: "CONFIRMADO", tokenHash: null, tokenExpiraEm: null },
      });
    },
  };
}
