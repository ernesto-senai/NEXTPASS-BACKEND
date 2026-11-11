import type { StatusConvite } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { InscricaoRepository } from "../../inscricoes/domain/inscricao.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import type { ConviteRepository, NovoConvite } from "../domain/convite.ts";

export interface ConviteEnviado {
  id: string;
  status: StatusConvite;
  criadoEm: Date;
  avaliacao: { id: string; nome: string; dataHora: Date };
  copiaResponsavel: boolean;
}

export type EnviarConvite = (dados: NovoConvite) => Promise<ConviteEnviado>;

// RF-39 e RF-40: o olheiro verificado (RN-04) convida o atleta para uma
// avaliação própria (RN-11) e aberta. O responsável recebe uma cópia.
export function criarEnviarConvite(deps: {
  convites: ConviteRepository;
  inscricoes: Pick<InscricaoRepository, "atletaParaInscricao">;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}): EnviarConvite {
  const agora = deps.agora ?? (() => new Date());

  return async ({ olheiroId, atletaId, avaliacaoId, mensagem }) => {
    const avaliacao = await deps.convites.avaliacaoParaConvite(avaliacaoId);
    if (!avaliacao) throw new AppError("NAO_ENCONTRADO", "Avaliação não encontrada.");
    if (avaliacao.olheiroId !== olheiroId) {
      throw new AppError("ACESSO_NEGADO", "Você só pode convidar para as suas avaliações.");
    }
    if (avaliacao.status !== "ABERTA" || avaliacao.dataHora <= agora()) {
      throw new AppError("VAGAS_ESGOTADAS", "Esta avaliação não está mais aberta a inscrições.");
    }

    // RN-02 e RN-04: só perfis completos aparecem para o olheiro.
    const atleta = await deps.inscricoes.atletaParaInscricao(atletaId);
    if (!atleta?.perfilCompleto) throw new AppError("NAO_ENCONTRADO", "Atleta não encontrado.");
    if (await deps.convites.jaConvidado(atletaId, avaliacaoId)) {
      throw new AppError(
        "CONVITE_EXISTENTE",
        "Este atleta já foi convidado ou está inscrito nesta avaliação.",
      );
    }

    const convite = await deps.convites.criar({ olheiroId, atletaId, avaliacaoId, mensagem });
    const dados = { conviteId: convite.id };
    await deps.notificacoes.criar([
      {
        usuarioId: atletaId,
        tipo: "NOVO_CONVITE",
        texto: `Você recebeu um convite para ${avaliacao.nome}.`,
        dados,
      },
      ...atleta.responsaveis.map((usuarioId) => ({
        usuarioId,
        tipo: "COPIA_CONVITE" as const,
        texto: `${atleta.nome} recebeu um convite para ${avaliacao.nome}.`,
        dados,
      })),
    ]);

    return {
      ...convite,
      avaliacao: { id: avaliacaoId, nome: avaliacao.nome, dataHora: avaliacao.dataHora },
      copiaResponsavel: atleta.responsaveis.length > 0,
    };
  };
}
