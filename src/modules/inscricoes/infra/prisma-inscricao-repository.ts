import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import { perfilCompleto } from "../../atletas/domain/atleta.ts";
import { paraResumo, selecaoResumo } from "../../avaliacoes/infra/prisma-avaliacao-repository.ts";
import {
  type InscricaoRepository,
  STATUS_ATIVOS,
  type SituacaoInscricao,
} from "../domain/inscricao.ts";

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

        const aberta = { id: avaliacaoId, status: "ABERTA", dataHora: { gt: agora } } as const;
        if (status === "CONFIRMADA") {
          // RN-06: a condição no UPDATE ocupa a vaga só se ainda houver uma, sem
          // corrida entre duas inscrições ao mesmo tempo.
          const { count } = await tx.avaliacao.updateMany({
            where: { ...aberta, vagasOcupadas: { lt: tx.avaliacao.fields.vagas } },
            data: { vagasOcupadas: { increment: 1 } },
          });
          if (count === 0) return "SEM_VAGAS";
        } else if ((await tx.avaliacao.count({ where: aberta })) === 0) {
          return "SEM_VAGAS";
        }

        // Reinscrição (depois de cancelar ou recusar) reaproveita a linha (RN-07).
        const inscricao = await tx.inscricao.upsert({
          where: { avaliacaoId_atletaId: { avaliacaoId, atletaId } },
          create: { avaliacaoId, atletaId, status, conviteId },
          update: { status, conviteId },
          select: { id: true, status: true, avaliacao: { select: { nome: true } } },
        });
        if (conviteId) {
          await tx.convite.update({
            where: { id: conviteId },
            data: { status: "ACEITO", respondidoEm: agora },
          });
        }

        // RN-06 e RN-12: a última vaga fecha as inscrições e expira os convites pendentes.
        const { count: lotou } = await tx.avaliacao.updateMany({
          where: { id: avaliacaoId, vagasOcupadas: { gte: tx.avaliacao.fields.vagas } },
          data: { status: "ESGOTADA" },
        });
        if (lotou > 0) {
          await tx.convite.updateMany({
            where: { avaliacaoId, status: "PENDENTE" },
            data: { status: "EXPIRADO" },
          });
        }

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
  };
}
