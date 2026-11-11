import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import type {
  AvaliacaoRepository,
  AvaliacaoResumo,
  FiltroAvaliacoes,
} from "../domain/avaliacao.ts";

export type ListarAvaliacoes = (
  filtro: FiltroAvaliacoes,
  paginacao: Paginacao,
) => Promise<Pagina<AvaliacaoResumo>>;

// RF-18, RF-23 e RF-24: feed "Peneiras Abertas" e tela de Pesquisa do atleta.
export function criarListarAvaliacoes(deps: {
  avaliacoes: AvaliacaoRepository;
  agora?: () => Date;
}): ListarAvaliacoes {
  const agora = deps.agora ?? (() => new Date());

  return async (filtro, paginacao) => {
    const { dados, total } = await deps.avaliacoes.listarFuturas(filtro, paginacao, agora());
    return { dados, total, pagina: paginacao.pagina };
  };
}
