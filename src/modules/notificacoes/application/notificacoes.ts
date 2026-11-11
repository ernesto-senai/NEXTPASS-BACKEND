import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import type { Notificacao, NotificacaoRepository } from "../domain/notificacao.ts";

export type ListarNotificacoes = (
  usuarioId: string,
  paginacao: Paginacao,
) => Promise<Pagina<Notificacao> & { naoLidas: number }>;

export type MarcarComoLidas = (usuarioId: string, ids?: string[]) => Promise<void>;

// RF-47 e RF-52: avisos de convites respondidos, inscrições e avaliações.
export function criarListarNotificacoes(deps: {
  notificacoes: NotificacaoRepository;
}): ListarNotificacoes {
  return async (usuarioId, paginacao) => ({
    ...(await deps.notificacoes.listar(usuarioId, paginacao)),
    pagina: paginacao.pagina,
  });
}

// RF-52: uma a uma (ao tocar no aviso) ou todas de uma vez.
export function criarMarcarComoLidas(deps: {
  notificacoes: NotificacaoRepository;
}): MarcarComoLidas {
  return (usuarioId, ids) => deps.notificacoes.marcarComoLidas(usuarioId, ids);
}
