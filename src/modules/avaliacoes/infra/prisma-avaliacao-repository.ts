import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import { STATUS_ATIVOS } from "../../inscricoes/domain/inscricao.ts";
import {
  type AvaliacaoRepository,
  type AvaliacaoResumo,
  clubeVisivel,
  type FiltroAvaliacoes,
  type OrdemAvaliacoes,
} from "../domain/avaliacao.ts";

// Campos do card; também usados pelo módulo de inscrições.
export const selecaoResumo = {
  id: true,
  nome: true,
  tipo: true,
  categoria: true,
  posicoes: true,
  dataHora: true,
  local: true,
  cidade: true,
  uf: true,
  taxaCentavos: true,
  vagas: true,
  vagasOcupadas: true,
  status: true,
  olheiro: {
    select: {
      usuarioId: true,
      verificado: true,
      atuacao: true,
      clube: true,
      usuario: { select: { nome: true } },
    },
  },
} satisfies Prisma.AvaliacaoSelect;

type AvaliacaoSelecionada = Prisma.AvaliacaoGetPayload<{ select: typeof selecaoResumo }>;

export function paraResumo({ olheiro, ...avaliacao }: AvaliacaoSelecionada): AvaliacaoResumo {
  return {
    ...avaliacao,
    clube: clubeVisivel(olheiro),
    olheiro: { id: olheiro.usuarioId, nome: olheiro.usuario.nome },
  };
}

const DIA_MS = 24 * 60 * 60 * 1000;

const ordenacao = {
  proximas: [{ dataHora: "asc" }],
  recentes: [{ criadoEm: "desc" }],
  menorPreco: [{ taxaCentavos: "asc" }, { dataHora: "asc" }],
} satisfies Record<OrdemAvaliacoes, Prisma.AvaliacaoOrderByWithRelationInput[]>;

function condicoes(filtro: FiltroAvaliacoes, agora: Date): Prisma.AvaliacaoWhereInput {
  const { busca, categoria, tipo, cidade, posicoes, precoMaxCentavos, dias } = filtro;
  const contem = (texto: string) => ({ contains: texto, mode: "insensitive" as const });

  return {
    // RN-06: avaliação esgotada aparece, a não ser que o atleta peça só as com vagas.
    status: filtro.somenteComVagas ? "ABERTA" : { in: ["ABERTA", "ESGOTADA"] },
    dataHora: { gt: agora, ...(dias ? { lte: new Date(agora.getTime() + dias * DIA_MS) } : {}) },
    // Avaliações de contas suspensas pela moderação somem do feed.
    olheiro: { usuario: { status: "ATIVO" } },
    ...(categoria ? { categoria } : {}),
    ...(tipo ? { tipo } : {}),
    ...(cidade ? { cidade: contem(cidade) } : {}),
    ...(posicoes?.length ? { posicoes: { hasSome: posicoes } } : {}),
    ...(precoMaxCentavos !== undefined ? { taxaCentavos: { lte: precoMaxCentavos } } : {}),
    // RF-23: pelo nome da avaliação ou do clube.
    ...(busca ? { OR: [{ nome: contem(busca) }, { olheiro: { clube: contem(busca) } }] } : {}),
  };
}

export function criarAvaliacaoRepositoryPrisma(prisma: PrismaClient): AvaliacaoRepository {
  return {
    criar: async (olheiroId, dados) =>
      paraResumo(
        await prisma.avaliacao.create({ data: { ...dados, olheiroId }, select: selecaoResumo }),
      ),

    listarDoOlheiro: async (olheiroId, situacao, paginacao, agora) => {
      const where =
        situacao === "proximas"
          ? ({
              olheiroId,
              status: { in: ["ABERTA", "ESGOTADA"] },
              dataHora: { gt: agora },
            } satisfies Prisma.AvaliacaoWhereInput)
          : ({
              olheiroId,
              OR: [{ dataHora: { lte: agora } }, { status: { in: ["CANCELADA", "ENCERRADA"] } }],
            } satisfies Prisma.AvaliacaoWhereInput);

      const [linhas, total] = await prisma.$transaction([
        prisma.avaliacao.findMany({
          where,
          select: selecaoResumo,
          orderBy: { dataHora: situacao === "proximas" ? "asc" : "desc" },
          ...intervalo(paginacao),
        }),
        prisma.avaliacao.count({ where }),
      ]);

      return { dados: linhas.map(paraResumo), total };
    },

    buscarDetalhe: async (id) => {
      const avaliacao = await prisma.avaliacao.findUnique({
        where: { id },
        select: { ...selecaoResumo, requisitos: true, endereco: true },
      });
      if (!avaliacao) return null;
      const { requisitos, endereco, ...resumo } = avaliacao;
      return { ...paraResumo(resumo), requisitos, endereco };
    },

    buscarParaDono: (id) =>
      prisma.avaliacao.findUnique({
        where: { id },
        select: { olheiroId: true, nome: true, status: true, dataHora: true, vagasOcupadas: true },
      }),

    atualizar: (id, dados) =>
      prisma.$transaction(async (tx) => {
        const { vagasOcupadas } = await tx.avaliacao.findUniqueOrThrow({
          where: { id },
          select: { vagasOcupadas: true },
        });
        const avaliacao = await tx.avaliacao.update({
          where: { id },
          data: { ...dados, status: vagasOcupadas >= dados.vagas ? "ESGOTADA" : "ABERTA" },
          select: selecaoResumo,
        });
        const inscritos = await tx.inscricao.findMany({
          where: { avaliacaoId: id, status: { in: [...STATUS_ATIVOS] } },
          select: { atletaId: true },
        });
        return {
          avaliacao: paraResumo(avaliacao),
          inscritos: inscritos.map((inscricao) => inscricao.atletaId),
        };
      }),

    cancelar: (id) =>
      prisma.$transaction(async (tx) => {
        const ativas = { avaliacaoId: id, status: { in: [...STATUS_ATIVOS] } };
        const inscritos = await tx.inscricao.findMany({
          where: ativas,
          select: { atletaId: true },
        });

        await tx.avaliacao.update({ where: { id }, data: { status: "CANCELADA" } });
        await tx.inscricao.updateMany({ where: ativas, data: { status: "CANCELADA" } });
        await tx.convite.updateMany({
          where: { avaliacaoId: id, status: "PENDENTE" },
          data: { status: "EXPIRADO" },
        });

        return inscritos.map((inscricao) => inscricao.atletaId);
      }),

    listarFuturas: async (filtro, paginacao, agora) => {
      const where = condicoes(filtro, agora);

      const [linhas, total] = await prisma.$transaction([
        prisma.avaliacao.findMany({
          where,
          select: selecaoResumo,
          orderBy: ordenacao[filtro.ordem],
          ...intervalo(paginacao),
        }),
        prisma.avaliacao.count({ where }),
      ]);

      return { dados: linhas.map(paraResumo), total };
    },
  };
}
