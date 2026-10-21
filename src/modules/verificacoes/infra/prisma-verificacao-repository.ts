import type { PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
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

    atuacaoDoOlheiro: async (olheiroId) =>
      (
        await prisma.olheiro.findUnique({
          where: { usuarioId: olheiroId },
          select: { atuacao: true },
        })
      )?.atuacao ?? null,

    criar: async (dados) => {
      await prisma.verificacao.create({ data: dados });
    },

    listarParaAnalise: async (status, paginacao) => {
      const where = { status };
      const [linhas, total] = await prisma.$transaction([
        prisma.verificacao.findMany({
          where,
          select: {
            id: true,
            status: true,
            criadoEm: true,
            documentoUrl: true,
            comprovanteUrl: true,
            olheiro: {
              select: {
                usuarioId: true,
                atuacao: true,
                clube: true,
                usuario: { select: { nome: true, email: true } },
              },
            },
          },
          // A fila é atendida por ordem de chegada.
          orderBy: { criadoEm: "asc" },
          ...intervalo(paginacao),
        }),
        prisma.verificacao.count({ where }),
      ]);

      return {
        dados: linhas.map(({ olheiro: { usuarioId, usuario, ...olheiro }, ...verificacao }) => ({
          ...verificacao,
          olheiro: { ...olheiro, id: usuarioId, nome: usuario.nome, email: usuario.email },
        })),
        total,
      };
    },

    buscar: (id) =>
      prisma.verificacao.findUnique({
        where: { id },
        select: { id: true, olheiroId: true, status: true },
      }),

    analisar: async (id, { status, motivoRecusa, adminId, agora }) => {
      await prisma.$transaction(async (tx) => {
        const { olheiroId } = await tx.verificacao.update({
          where: { id },
          data: { status, motivoRecusa, analisadaPorId: adminId, analisadaEm: agora },
          select: { olheiroId: true },
        });
        await tx.olheiro.update({
          where: { usuarioId: olheiroId },
          data: { verificado: status === "APROVADA" },
        });
      });
    },
  };
}
