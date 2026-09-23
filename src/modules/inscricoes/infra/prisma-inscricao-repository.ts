import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { intervalo } from "../../../shared/domain/pagina.ts";
import { paraResumo, selecaoResumo } from "../../avaliacoes/infra/prisma-avaliacao-repository.ts";
import type { InscricaoRepository, SituacaoInscricao } from "../domain/inscricao.ts";

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
