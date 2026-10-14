import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { VerificacaoRepository } from "../domain/verificacao.ts";

export function criarVerificacaoRepositoryPrisma(prisma: PrismaClient): VerificacaoRepository {
  return {
    // Vale o último envio de documentos (o olheiro reenvia depois de uma recusa).
    situacao: async (olheiroId) => {
      const olheiro = await prisma.olheiro.findUnique({
        where: { usuarioId: olheiroId },
        select: {
          verificado: true,
          verificacoes: {
            select: { status: true, motivoRecusa: true },
            orderBy: { criadoEm: "desc" },
            take: 1,
          },
        },
      });
      const ultima = olheiro?.verificacoes[0];

      return {
        verificado: olheiro?.verificado ?? false,
        status: ultima?.status ?? null,
        motivoRecusa: ultima?.motivoRecusa ?? null,
      };
    },
  };
}
