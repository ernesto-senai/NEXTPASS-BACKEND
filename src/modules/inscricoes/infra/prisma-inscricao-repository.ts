import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import { idsQueCombinam } from "../../../shared/infra/database/busca-textual.ts";
import { perfilCompleto } from "../../atletas/domain/atleta.ts";
import { paraResumo, selecaoResumo } from "../../avaliacoes/infra/prisma-avaliacao-repository.ts";
import {
  type InscricaoRepository,
  STATUS_ATIVOS,
  type SituacaoInscricao,
} from "../domain/inscricao.ts";

type Transacao = Prisma.TransactionClient;

function filtro(atletaId: string, situacao: SituacaoInscricao, agora: Date) {
  if (situacao === "ativas") {
    return {
      atletaId,
      status: { in: ["AGUARDANDO_RESPONSAVEL", "CONFIRMADA"] },
      avaliacao: { dataHora: { gt: agora }, status: { in: ["ABERTA", "ESGOTADA"] } },
    } satisfies Prisma.InscricaoWhereInput;
  }
  return {
    atletaId,
    status: "CONFIRMADA",
    avaliacao: { dataHora: { lte: agora }, status: { not: "CANCELADA" } },
  } satisfies Prisma.InscricaoWhereInput;
}

// RN-06: a condição no UPDATE ocupa a vaga só se ainda houver uma, sem corrida
// entre duas inscrições ao mesmo tempo.
async function ocuparVaga(tx: Transacao, avaliacaoId: string, agora: Date) {
  const { count } = await tx.avaliacao.updateMany({
    where: {
      id: avaliacaoId,
      status: "ABERTA",
      dataHora: { gt: agora },
      vagasOcupadas: { lt: tx.avaliacao.fields.vagas },
    },
    data: { vagasOcupadas: { increment: 1 } },
  });
  return count > 0;
}

// RN-06 e RN-12: a última vaga fecha as inscrições e expira os convites pendentes.
async function fecharSeLotou(tx: Transacao, avaliacaoId: string) {
  const { count } = await tx.avaliacao.updateMany({
    where: { id: avaliacaoId, vagasOcupadas: { gte: tx.avaliacao.fields.vagas } },
    data: { status: "ESGOTADA" },
  });
  if (count > 0) {
    await tx.convite.updateMany({
      where: { avaliacaoId, status: "PENDENTE" },
      data: { status: "EXPIRADO" },
    });
  }
}

export function criarInscricaoRepositoryPrisma(prisma: PrismaClient): InscricaoRepository {
  return {
    atletaParaInscricao: async (atletaId) => {
      const atleta = await prisma.atleta.findFirst({
        where: { usuarioId: atletaId, usuario: { status: "ATIVO" } },
        select: {
          dataNascimento: true,
          alturaCm: true,
          pesoKg: true,
          pePreferencial: true,
          cidade: true,
          nacionalidade: true,
          posicoes: true,
          usuario: { select: { nome: true } },
          vinculos: {
            where: { status: "CONFIRMADO", responsavelId: { not: null } },
            select: { responsavelId: true },
          },
        },
      });
      if (!atleta) return null;

      const { usuario, vinculos, ...dadosTecnicos } = atleta;
      return {
        nome: usuario.nome,
        perfilCompleto: perfilCompleto(dadosTecnicos),
        dataNascimento: dadosTecnicos.dataNascimento,
        responsaveis: vinculos.map((vinculo) => vinculo.responsavelId!),
      };
    },

    inscrever: ({ atletaId, avaliacaoId, conviteId, status }, agora) =>
      prisma.$transaction(async (tx) => {
        const existente = await tx.inscricao.findUnique({
          where: { avaliacaoId_atletaId: { avaliacaoId, atletaId } },
          select: { status: true },
        });
        if (existente && STATUS_ATIVOS.some((ativo) => ativo === existente.status)) {
          return "INSCRICAO_EXISTENTE";
        }

        if (status === "CONFIRMADA") {
          if (!(await ocuparVaga(tx, avaliacaoId, agora))) return "SEM_VAGAS";
        } else {
          // A inscrição do menor só ocupa a vaga quando o responsável aprova.
          const aberta = { id: avaliacaoId, status: "ABERTA", dataHora: { gt: agora } } as const;
          if ((await tx.avaliacao.count({ where: aberta })) === 0) return "SEM_VAGAS";
        }

        // Reinscrição (depois de cancelar ou recusar) reaproveita a linha (RN-07).
        const inscricao = await tx.inscricao.upsert({
          where: { avaliacaoId_atletaId: { avaliacaoId, atletaId } },
          create: { avaliacaoId, atletaId, status, conviteId },
          update: { status, conviteId },
          select: {
            id: true,
            status: true,
            avaliacao: { select: { nome: true, olheiroId: true } },
          },
        });
        if (conviteId) {
          await tx.convite.update({
            where: { id: conviteId },
            data: { status: "ACEITO", respondidoEm: agora },
          });
        }
        await fecharSeLotou(tx, avaliacaoId);

        return inscricao;
      }),

    listarDoAtleta: async (atletaId, situacao, paginacao, agora) => {
      const where = filtro(atletaId, situacao, agora);

      const [linhas, total] = await prisma.$transaction([
        prisma.inscricao.findMany({
          where,
          select: { id: true, status: true, avaliacao: { select: selecaoResumo } },
          // Ativas: a próxima primeiro. Participadas: a mais recente primeiro.
          orderBy: { avaliacao: { dataHora: situacao === "ativas" ? "asc" : "desc" } },
          ...intervalo(paginacao),
        }),
        prisma.inscricao.count({ where }),
      ]);

      return {
        dados: linhas.map(({ avaliacao, ...inscricao }) => ({
          ...inscricao,
          avaliacao: paraResumo(avaliacao),
        })),
        total,
      };
    },

    daAvaliacao: (atletaId, avaliacaoId) =>
      prisma.inscricao.findUnique({
        where: { avaliacaoId_atletaId: { avaliacaoId, atletaId } },
        select: { id: true, status: true },
      }),

    buscarParaAlteracao: async (id) => {
      const inscricao = await prisma.inscricao.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          atleta: { select: { usuarioId: true, usuario: { select: { nome: true } } } },
          avaliacao: {
            select: { id: true, nome: true, olheiroId: true, dataHora: true, status: true },
          },
        },
      });
      if (!inscricao) return null;

      const { atleta, ...dados } = inscricao;
      return { ...dados, atleta: { id: atleta.usuarioId, nome: atleta.usuario.nome } };
    },

    encerrar: (id, status) =>
      prisma.$transaction(async (tx) => {
        const anterior = await tx.inscricao.findUniqueOrThrow({
          where: { id },
          select: { status: true, avaliacaoId: true },
        });
        await tx.inscricao.update({ where: { id }, data: { status } });

        // Quem estava confirmado libera a vaga; a avaliação esgotada reabre (RN-06).
        if (anterior.status === "CONFIRMADA") {
          await tx.avaliacao.update({
            where: { id: anterior.avaliacaoId },
            data: { vagasOcupadas: { decrement: 1 } },
          });
          await tx.avaliacao.updateMany({
            where: { id: anterior.avaliacaoId, status: "ESGOTADA" },
            data: { status: "ABERTA" },
          });
        }
      }),

    confirmar: (id, agora) =>
      prisma.$transaction(async (tx) => {
        const { avaliacaoId } = await tx.inscricao.findUniqueOrThrow({
          where: { id },
          select: { avaliacaoId: true },
        });
        if (!(await ocuparVaga(tx, avaliacaoId, agora))) return "SEM_VAGAS";

        await tx.inscricao.update({ where: { id }, data: { status: "CONFIRMADA" } });
        await fecharSeLotou(tx, avaliacaoId);
        return "CONFIRMADA";
      }),

    listarInscritos: async (avaliacaoId, busca, paginacao) => {
      // RNF-16: o nome ignora acentos e tolera pequenos erros.
      const where = {
        avaliacaoId,
        status: { in: [...STATUS_ATIVOS] },
        ...(busca
          ? { atletaId: { in: await idsQueCombinam(prisma, "nomeDoUsuario", busca) } }
          : {}),
      } satisfies Prisma.InscricaoWhereInput;

      const [linhas, total] = await prisma.$transaction([
        prisma.inscricao.findMany({
          where,
          select: {
            id: true,
            status: true,
            criadoEm: true,
            atleta: {
              select: {
                usuarioId: true,
                dataNascimento: true,
                posicoes: true,
                cidade: true,
                uf: true,
                usuario: { select: { nome: true, fotoUrl: true } },
              },
            },
          },
          orderBy: { atleta: { usuario: { nome: "asc" } } },
          ...intervalo(paginacao),
        }),
        prisma.inscricao.count({ where }),
      ]);

      return {
        dados: linhas.map(({ atleta: { usuarioId, usuario, ...atleta }, ...inscricao }) => ({
          ...inscricao,
          atleta: { ...atleta, id: usuarioId, nome: usuario.nome, fotoUrl: usuario.fotoUrl },
        })),
        total,
      };
    },

    responsavelDe: async (responsavelId, atletaId) =>
      (await prisma.vinculo.count({
        where: { responsavelId, atletaId, status: "CONFIRMADO" },
      })) > 0,

    listarParaResponsavel: async (responsavelId, paginacao, agora) => {
      const where = {
        status: "AGUARDANDO_RESPONSAVEL",
        avaliacao: { dataHora: { gt: agora }, status: { in: ["ABERTA", "ESGOTADA"] } },
        atleta: { vinculos: { some: { responsavelId, status: "CONFIRMADO" } } },
      } satisfies Prisma.InscricaoWhereInput;

      const [linhas, total] = await prisma.$transaction([
        prisma.inscricao.findMany({
          where,
          select: {
            id: true,
            status: true,
            atleta: { select: { usuarioId: true, usuario: { select: { nome: true } } } },
            avaliacao: { select: selecaoResumo },
          },
          orderBy: { avaliacao: { dataHora: "asc" } },
          ...intervalo(paginacao),
        }),
        prisma.inscricao.count({ where }),
      ]);

      return {
        dados: linhas.map(({ atleta, avaliacao, ...inscricao }) => ({
          ...inscricao,
          atleta: { id: atleta.usuarioId, nome: atleta.usuario.nome },
          avaliacao: paraResumo(avaliacao),
        })),
        total,
      };
    },
  };
}
