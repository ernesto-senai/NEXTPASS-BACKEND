import type { PrismaClient } from "../../../generated/prisma/client.ts";

// RN-04: o olheiro fica verificado quando a equipe aprova a verificação (RF-57).
export function criarConsultaOlheiroVerificado(prisma: PrismaClient) {
  return async (usuarioId: string) => {
    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId },
      select: { verificado: true },
    });
    return olheiro?.verificado ?? false;
  };
}
