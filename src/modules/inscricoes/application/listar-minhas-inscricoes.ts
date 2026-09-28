import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import type {
  InscricaoDoAtleta,
  InscricaoRepository,
  SituacaoInscricao,
} from "../domain/inscricao.ts";

export type ListarMinhasInscricoes = (
  atletaId: string,
  situacao: SituacaoInscricao,
  paginacao: Paginacao,
) => Promise<Pagina<InscricaoDoAtleta>>;

// RF-19: abas Inscrições e Participadas do feed do atleta.
export function criarListarMinhasInscricoes(deps: {
  inscricoes: InscricaoRepository;
  agora?: () => Date;
}): ListarMinhasInscricoes {
  const agora = deps.agora ?? (() => new Date());

  return async (atletaId, situacao, paginacao) => {
    const { dados, total } = await deps.inscricoes.listarDoAtleta(
      atletaId,
      situacao,
      paginacao,
      agora(),
    );
    return { dados, total, pagina: paginacao.pagina };
  };
}
