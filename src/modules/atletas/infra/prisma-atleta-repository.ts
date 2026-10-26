import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import { idsQueCombinam } from "../../../shared/infra/database/busca-textual.ts";
import type {
  AtletaPerfil,
  AtletaRepository,
  ConsultaAtletas,
  OrdemAtletas,
} from "../domain/atleta.ts";

const ordenacao = {
  nome: [{ usuario: { nome: "asc" } }],
  maisNovos: [{ dataNascimento: "desc" }],
  maisAltos: [{ alturaCm: "desc" }],
} satisfies Record<OrdemAtletas, Prisma.AtletaOrderByWithRelationInput[]>;

// Cada campo exige o dado preenchido (RN-02: perfil incompleto não aparece na
// busca) e, quando há filtro, também o valor pedido. Nome, cidade e
// nacionalidade ignoram acentos e toleram pequenos erros (RNF-16).
async function condicoes(
  prisma: PrismaClient,
  consulta: ConsultaAtletas,
): Promise<Prisma.AtletaWhereInput> {
  const textos = await Promise.all(
    (
      [
        ["nomeDoUsuario", consulta.busca],
        ["cidadeDoAtleta", consulta.cidade],
        ["nacionalidadeDoAtleta", consulta.nacionalidade],
      ] as const
    )
      .filter(([, valor]) => !!valor)
      .map(([campo, valor]) => idsQueCombinam(prisma, campo, valor!)),
  );

  return {
    usuario: { status: "ATIVO" },
    ...(textos.length ? { AND: textos.map((ids) => ({ usuarioId: { in: ids } })) } : {}),
    dataNascimento: { not: null, gte: consulta.nascidoDe, lte: consulta.nascidoAte },
    alturaCm: { not: null, gte: consulta.alturaMin, lte: consulta.alturaMax },
    pesoKg: { not: null, gte: consulta.pesoMin, lte: consulta.pesoMax },
    pePreferencial: consulta.pePreferencial ?? { not: null },
    cidade: { not: null },
    nacionalidade: { not: null },
    posicoes: consulta.posicoes?.length ? { hasSome: consulta.posicoes } : { isEmpty: false },
  };
}

const comUsuario = { usuario: { select: { nome: true, fotoUrl: true } } } as const;

type AtletaComUsuario = Prisma.AtletaGetPayload<{ include: typeof comUsuario }>;

// Os "!" são seguros: o filtro de perfil completo garante esses campos.
const paraPerfil = (atleta: AtletaComUsuario): AtletaPerfil => ({
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
});

export function criarAtletaRepositoryPrisma(prisma: PrismaClient): AtletaRepository {
  return {
    buscar: async (consulta, paginacao) => {
      const where = await condicoes(prisma, consulta);

      const [linhas, total] = await prisma.$transaction([
        prisma.atleta.findMany({
          where,
          include: comUsuario,
          orderBy: ordenacao[consulta.ordem],
          ...intervalo(paginacao),
        }),
        prisma.atleta.count({ where }),
      ]);

      return { dados: linhas.map(paraPerfil), total };
    },

    buscarPorId: async (id) => {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId: id, ...(await condicoes(prisma, { ordem: "nome" })) },
        include: comUsuario,
      });
      return atleta ? paraPerfil(atleta) : null;
    },
  };
}
