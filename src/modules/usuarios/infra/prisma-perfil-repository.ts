import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { StatusVinculo } from "../../../generated/prisma/enums.ts";
import type { PerfilRepository } from "../domain/perfil.ts";

// Um vínculo confirmado basta; senão, vale o pedido ainda pendente.
const situacaoDoVinculo = (vinculos: { status: StatusVinculo }[]): StatusVinculo | null =>
  vinculos.some((vinculo) => vinculo.status === "CONFIRMADO")
    ? "CONFIRMADO"
    : vinculos.length > 0
      ? "PENDENTE"
      : null;

export function criarPerfilRepositoryPrisma(prisma: PrismaClient): PerfilRepository {
  return {
    buscar: async (usuarioId) => {
      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nome: true,
          email: true,
          fotoUrl: true,
          tipo: true,
          atleta: {
            select: {
              dataNascimento: true,
              posicoes: true,
              alturaCm: true,
              pesoKg: true,
              pePreferencial: true,
              cidade: true,
              uf: true,
              nacionalidade: true,
              vinculos: { select: { status: true } },
            },
          },
          olheiro: { select: { telefone: true, atuacao: true, clube: true, verificado: true } },
        },
      });
      if (!usuario) return null;

      const { atleta, ...dados } = usuario;
      if (!atleta) return { ...dados, atleta: null };
      const { vinculos, ...tecnicos } = atleta;
      return { ...dados, atleta: { ...tecnicos, responsavel: situacaoDoVinculo(vinculos) } };
    },

    atualizarFoto: async (usuarioId, fotoUrl) =>
      prisma.$transaction(async (tx) => {
        const { fotoUrl: anterior } = await tx.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { fotoUrl: true },
        });
        await tx.usuario.update({ where: { id: usuarioId }, data: { fotoUrl } });
        return anterior;
      }),

    excluirConta: (usuarioId) =>
      prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: {
            fotoUrl: true,
            atleta: { select: { videos: { select: { url: true } } } },
            olheiro: {
              select: { verificacoes: { select: { documentoUrl: true, comprovanteUrl: true } } },
            },
          },
        });
        // As relações com onDelete: Cascade levam perfil, lances, avaliações,
        // inscrições, convites, vínculos, notificações e sessões junto.
        await tx.usuario.delete({ where: { id: usuarioId } });

        return [
          usuario.fotoUrl,
          ...(usuario.atleta?.videos.map((video) => video.url) ?? []),
          ...(usuario.olheiro?.verificacoes.flatMap((v) => [v.documentoUrl, v.comprovanteUrl]) ??
            []),
        ].filter((url): url is string => !!url);
      }),

    atualizarAtleta: async (usuarioId, { nome, ...dados }) => {
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { nome, atleta: { update: dados } },
      });
    },
  };
}
