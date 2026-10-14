import type { StatusInscricao } from "../../../generated/prisma/enums.ts";
import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { InscreverAtleta } from "../../inscricoes/application/inscrever-atleta.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import {
  type ConviteRecebido,
  type ConviteRepository,
  situacaoDoConvite,
} from "../domain/convite.ts";

export type RespostaConvite = "ACEITO" | "RECUSADO";

export type ListarConvitesRecebidos = (
  atletaId: string,
  paginacao: Paginacao,
) => Promise<Pagina<ConviteRecebido>>;

export type ResponderConvite = (
  atletaId: string,
  conviteId: string,
  resposta: RespostaConvite,
) => Promise<{
  id: string;
  status: RespostaConvite;
  inscricao: { id: string; status: StatusInscricao } | null;
}>;

// RF-26: caixa de convites do atleta, já com os expirados marcados (RN-12).
export function criarListarConvitesRecebidos(deps: {
  convites: ConviteRepository;
  agora?: () => Date;
}): ListarConvitesRecebidos {
  const agora = deps.agora ?? (() => new Date());

  return async (atletaId, paginacao) => {
    const { dados, total } = await deps.convites.listarDoAtleta(atletaId, paginacao);
    return {
      dados: dados.map((convite) => ({
        ...convite,
        status: situacaoDoConvite(convite.status, convite.avaliacao, agora()),
      })),
      total,
      pagina: paginacao.pagina,
    };
  };
}

// RF-27: o atleta aceita ou recusa. O aceite cria a inscrição (com as regras
// RN-02, RN-03, RN-06 e RN-07); nos dois casos o olheiro é avisado (RF-47).
export function criarResponderConvite(deps: {
  convites: ConviteRepository;
  inscreverAtleta: InscreverAtleta;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}): ResponderConvite {
  const agora = deps.agora ?? (() => new Date());

  return async (atletaId, conviteId, resposta) => {
    const convite = await deps.convites.buscar(conviteId);
    if (!convite || convite.atleta.id !== atletaId) {
      throw new AppError("NAO_ENCONTRADO", "Convite não encontrado.");
    }
    if (situacaoDoConvite(convite.status, convite.avaliacao, agora()) !== "PENDENTE") {
      throw new AppError("CONVITE_ENCERRADO", "Este convite já foi respondido ou expirou.");
    }

    let inscricao = null;
    if (resposta === "ACEITO") {
      const { id, status } = await deps.inscreverAtleta({
        atletaId,
        avaliacaoId: convite.avaliacao.id,
        conviteId,
      });
      inscricao = { id, status };
    } else {
      await deps.convites.recusar(conviteId, agora());
    }

    await deps.notificacoes.criar([
      {
        usuarioId: convite.olheiroId,
        tipo: "CONVITE_RESPONDIDO",
        texto: `${convite.atleta.nome} ${resposta === "ACEITO" ? "aceitou" : "recusou"} o convite para ${convite.avaliacao.nome}.`,
        dados: { conviteId },
      },
    ]);

    return { id: conviteId, status: resposta, inscricao };
  };
}
