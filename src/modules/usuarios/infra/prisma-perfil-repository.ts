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

    atualizarAtleta: async (usuarioId, { nome, ...dados }) => {
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { nome, atleta: { update: dados } },
      });
    },
  };
}
