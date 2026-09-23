import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import type { AvaliacaoRepository, AvaliacaoResumo } from "../domain/avaliacao.ts";

export type ListarAvaliacoes = (paginacao: Paginacao) => Promise<Pagina<AvaliacaoResumo>>;

// RF-18: aba "Peneiras Abertas" do feed do atleta.
export function criarListarAvaliacoes(deps: {
  avaliacoes: AvaliacaoRepository;
  agora?: () => Date;
}): ListarAvaliacoes {
  const agora = deps.agora ?? (() => new Date());

  return async (paginacao) => {
    const { dados, total } = await deps.avaliacoes.listarFuturas(paginacao, agora());
    return { dados, total, pagina: paginacao.pagina };
  };
}
