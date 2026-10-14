import type { StatusVerificacao } from "../../../generated/prisma/enums.ts";

// RF-17: situação da verificação do olheiro. status null: ainda não enviou os
// documentos. Só a aprovação libera as funções de olheiro (RN-04).
export interface SituacaoVerificacao {
  verificado: boolean;
  status: StatusVerificacao | null;
  motivoRecusa: string | null;
}

export interface VerificacaoRepository {
  situacao(olheiroId: string): Promise<SituacaoVerificacao>;
}
