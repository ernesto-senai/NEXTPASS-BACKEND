import type { SituacaoVerificacao, VerificacaoRepository } from "../domain/verificacao.ts";

export type ConsultarVerificacao = (olheiroId: string) => Promise<SituacaoVerificacao>;

// RF-17: o app mostra se as funções do olheiro já estão liberadas.
export function criarConsultarVerificacao(deps: {
  verificacoes: VerificacaoRepository;
}): ConsultarVerificacao {
  return (olheiroId) => deps.verificacoes.situacao(olheiroId);
}
