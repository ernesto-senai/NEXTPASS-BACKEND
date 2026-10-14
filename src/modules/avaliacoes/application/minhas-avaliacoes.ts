import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import type {
  AvaliacaoRepository,
  AvaliacaoResumo,
  SituacaoAvaliacao,
} from "../domain/avaliacao.ts";

export type ListarMinhasAvaliacoes = (
  olheiroId: string,
  situacao: SituacaoAvaliacao,
  paginacao: Paginacao,
) => Promise<Pagina<AvaliacaoResumo>>;

export type CancelarAvaliacao = (olheiroId: string, id: string) => Promise<void>;

// RF-42: "Minhas avaliações", com o total de participantes de cada uma.
export function criarListarMinhasAvaliacoes(deps: {
  avaliacoes: AvaliacaoRepository;
  agora?: () => Date;
}): ListarMinhasAvaliacoes {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, situacao, paginacao) => ({
    ...(await deps.avaliacoes.listarDoOlheiro(olheiroId, situacao, paginacao, agora())),
    pagina: paginacao.pagina,
  });
}

// RF-43: o olheiro cancela uma avaliação própria (RN-11) que ainda vai
// acontecer, e os inscritos são avisados.
export function criarCancelarAvaliacao(deps: {
  avaliacoes: AvaliacaoRepository;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}): CancelarAvaliacao {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, id) => {
    const avaliacao = await deps.avaliacoes.buscarParaDono(id);
    if (!avaliacao) throw new AppError("NAO_ENCONTRADO", "Avaliação não encontrada.");
    if (avaliacao.olheiroId !== olheiroId) {
      throw new AppError("ACESSO_NEGADO", "Você só pode alterar as suas avaliações.");
    }
    const encerrada = !["ABERTA", "ESGOTADA"].includes(avaliacao.status);
    if (encerrada || avaliacao.dataHora <= agora()) {
      throw new AppError("AVALIACAO_ENCERRADA", "Esta avaliação já aconteceu ou foi cancelada.");
    }

    const inscritos = await deps.avaliacoes.cancelar(id);
    await deps.notificacoes.criar(
      inscritos.map((usuarioId) => ({
        usuarioId,
        tipo: "AVALIACAO_ALTERADA",
        texto: `A avaliação ${avaliacao.nome} foi cancelada pelo olheiro.`,
        dados: { avaliacaoId: id },
      })),
    );
  };
}
