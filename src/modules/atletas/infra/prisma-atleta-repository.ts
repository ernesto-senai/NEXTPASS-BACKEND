import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import type { AtletaRepository, ConsultaAtletas, OrdemAtletas } from "../domain/atleta.ts";

const ordenacao = {
  nome: [{ usuario: { nome: "asc" } }],
  maisNovos: [{ dataNascimento: "desc" }],
  maisAltos: [{ alturaCm: "desc" }],
} satisfies Record<OrdemAtletas, Prisma.AtletaOrderByWithRelationInput[]>;

// Cada campo exige o dado preenchido (RN-02: perfil incompleto não aparece na
// busca) e, quando há filtro, também o valor pedido.
function condicoes(consulta: ConsultaAtletas): Prisma.AtletaWhereInput {
  const contem = (texto: string) => ({ contains: texto, mode: "insensitive" as const });

  return {
    usuario: { status: "ATIVO", ...(consulta.busca ? { nome: contem(consulta.busca) } : {}) },
    dataNascimento: { not: null, gte: consulta.nascidoDe, lte: consulta.nascidoAte },
    alturaCm: { not: null, gte: consulta.alturaMin, lte: consulta.alturaMax },
    pesoKg: { not: null, gte: consulta.pesoMin, lte: consulta.pesoMax },
    pePreferencial: consulta.pePreferencial ?? { not: null },
    cidade: consulta.cidade ? contem(consulta.cidade) : { not: null },
    nacionalidade: consulta.nacionalidade ? contem(consulta.nacionalidade) : { not: null },
    posicoes: consulta.posicoes?.length ? { hasSome: consulta.posicoes } : { isEmpty: false },
  };
}

export function criarAtletaRepositoryPrisma(prisma: PrismaClient): AtletaRepository {
  return {
    buscar: async (consulta, paginacao) => {
      const where = condicoes(consulta);

      const [linhas, total] = await prisma.$transaction([
        prisma.atleta.findMany({
          where,
          include: { usuario: { select: { nome: true, fotoUrl: true } } },
          orderBy: ordenacao[consulta.ordem],
          ...intervalo(paginacao),
        }),
        prisma.atleta.count({ where }),
      ]);

      // Os "!" são seguros: o filtro de perfil completo garante esses campos.
      return {
        dados: linhas.map((atleta) => ({
          id: atleta.usuarioId,
          nome: atleta.usuario.nome,
          fotoUrl: atleta.usuario.fotoUrl,
          posicoes: atleta.posicoes,
          dataNascimento: atleta.dataNascimento!,
          cidade: atleta.cidade!,
          uf: atleta.uf,
          nacionalidade: atleta.nacionalidade!,
          alturaCm: atleta.alturaCm!,
          pesoKg: atleta.pesoKg!,
          pePreferencial: atleta.pePreferencial!,
        })),
        total,
      };
    },
  };
}
