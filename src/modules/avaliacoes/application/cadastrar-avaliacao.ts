import { AppError } from "../../../shared/errors/app-error.ts";
import type { AvaliacaoRepository, AvaliacaoResumo, NovaAvaliacao } from "../domain/avaliacao.ts";

export type CadastrarAvaliacao = (
  olheiroId: string,
  dados: NovaAvaliacao,
) => Promise<AvaliacaoResumo>;

// RF-41: o olheiro verificado (RN-04) divulga uma peneira ou um teste. A
// avaliação nasce aberta, com todas as vagas livres.
export function criarCadastrarAvaliacao(deps: {
  avaliacoes: AvaliacaoRepository;
  agora?: () => Date;
}): CadastrarAvaliacao {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, dados) => {
    if (dados.dataHora <= agora()) {
      throw new AppError(
        "DADOS_INVALIDOS",
        "Escolha uma data e um horário que ainda não passaram.",
      );
    }
    return deps.avaliacoes.criar(olheiroId, dados);
  };
}
