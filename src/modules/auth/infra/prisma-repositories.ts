import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type {
  ContaRepository,
  RefreshTokenRepository,
  TokenSenhaRepository,
} from "../domain/sessao.ts";

const camposConta = { id: true, nome: true, tipo: true, status: true, senhaHash: true } as const;

export function criarContaRepositoryPrisma(prisma: PrismaClient): ContaRepository {
  return {
    buscarPorEmail: (email) => prisma.usuario.findUnique({ where: { email }, select: camposConta }),
    buscarPorId: (id) => prisma.usuario.findUnique({ where: { id }, select: camposConta }),
    atualizarSenha: async (id, senhaHash) => {
      await prisma.usuario.update({ where: { id }, data: { senhaHash } });
    },
  };
}

export function criarRefreshTokenRepositoryPrisma(prisma: PrismaClient): RefreshTokenRepository {
  return {
    salvar: async ({ usuarioId, tokenHash, expiraEm }) => {
      await prisma.token.create({ data: { usuarioId, tokenHash, expiraEm, tipo: "REFRESH" } });
    },

    buscarValido: (tokenHash, agora) =>
      prisma.token.findFirst({
        where: { tokenHash, tipo: "REFRESH", usadoEm: null, expiraEm: { gt: agora } },
        select: { id: true, usuarioId: true, expiraEm: true },
      }),

    // UPDATE condicional: só um de dois pedidos simultâneos consegue revogar.
    revogar: async (id, agora) => {
      const { count } = await prisma.token.updateMany({
        where: { id, usadoEm: null },
        data: { usadoEm: agora },
      });
      return count > 0;
    },

    revogarTodos: async (usuarioId, agora) => {
      await prisma.token.updateMany({
        where: { usuarioId, tipo: "REFRESH", usadoEm: null },
        data: { usadoEm: agora },
      });
    },
  };
}

export function criarTokenSenhaRepositoryPrisma(prisma: PrismaClient): TokenSenhaRepository {
  return {
    salvar: async ({ usuarioId, tokenHash, expiraEm }) => {
      await prisma.$transaction([
        prisma.token.updateMany({
          where: { usuarioId, tipo: "REDEFINIR_SENHA", usadoEm: null },
          data: { usadoEm: new Date() },
        }),
        prisma.token.create({
          data: { usuarioId, tokenHash, expiraEm, tipo: "REDEFINIR_SENHA" },
        }),
      ]);
    },

    buscarValido: (tokenHash, agora) =>
      prisma.token.findFirst({
        where: { tokenHash, tipo: "REDEFINIR_SENHA", usadoEm: null, expiraEm: { gt: agora } },
        select: { id: true, usuarioId: true },
      }),

    usar: async (id, agora) => {
      const { count } = await prisma.token.updateMany({
        where: { id, usadoEm: null },
        data: { usadoEm: agora },
      });
      return count > 0;
    },
  };
}
