import type { StatusInscricao } from "../../../generated/prisma/enums.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";
import type { AvaliacaoResumo } from "../../avaliacoes/domain/avaliacao.ts";

// RF-19: "ativas" alimenta a aba Inscrições (aguardando responsável ou
// confirmadas, antes da data); "participadas", a aba Participadas.
export type SituacaoInscricao = "ativas" | "participadas";

export interface InscricaoDoAtleta {
  id: string;
  status: StatusInscricao;
  avaliacao: AvaliacaoResumo;
}

export interface InscricaoRepository {
  listarDoAtleta(
    atletaId: string,
    situacao: SituacaoInscricao,
    paginacao: Paginacao,
    agora: Date,
  ): Promise<{ dados: InscricaoDoAtleta[]; total: number }>;
}
