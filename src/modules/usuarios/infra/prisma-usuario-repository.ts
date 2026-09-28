import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import type { UsuarioCriado, UsuarioRepository } from "../domain/usuario-repository.ts";

const camposCriado = { id: true, nome: true, tipo: true } as const;

// Dois cadastros simultâneos com o mesmo e-mail: o índice único barra o segundo.
async function nuloSeEmailDuplicado(criar: Promise<UsuarioCriado>): Promise<UsuarioCriado | null> {
  try {
    return await criar;
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return null;
    throw erro;
  }
}

export function criarUsuarioRepositoryPrisma(prisma: PrismaClient): UsuarioRepository {
  return {
    emailEmUso: async (email) => (await prisma.usuario.count({ where: { email } })) > 0,

    criarAtleta: (dados) =>
      nuloSeEmailDuplicado(
        prisma.usuario.create({
          data: { ...dados, tipo: "ATLETA", atleta: { create: {} } },
          select: camposCriado,
        }),
      ),

    criarOlheiro: ({ telefone, atuacao, clube, ...dados }) =>
      nuloSeEmailDuplicado(
        prisma.usuario.create({
          data: { ...dados, tipo: "OLHEIRO", olheiro: { create: { telefone, atuacao, clube } } },
          select: camposCriado,
        }),
      ),
  };
}
