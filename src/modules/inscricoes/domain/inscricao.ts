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

// Inscrição ativa: conta para a RN-07 (uma por atleta e avaliação).
export const STATUS_ATIVOS = ["AGUARDANDO_RESPONSAVEL", "CONFIRMADA"] as const;

// RN-02 e RN-03: o que a inscrição precisa saber do atleta.
export interface AtletaParaInscricao {
  nome: string;
  perfilCompleto: boolean;
  dataNascimento: Date | null;
  // Responsáveis com vínculo confirmado: aprovam as inscrições do menor.
  responsaveis: string[];
}

export interface NovaInscricao {
  atletaId: string;
  avaliacaoId: string;
  // Inscrição pelo aceite do convite (RF-27): o convite vira ACEITO junto.
  conviteId?: string | undefined;
  status: (typeof STATUS_ATIVOS)[number];
}

export interface InscricaoCriada {
  id: string;
  status: StatusInscricao;
  avaliacao: { nome: string };
}

export type ResultadoInscricao = InscricaoCriada | "SEM_VAGAS" | "INSCRICAO_EXISTENTE";

export interface InscricaoRepository {
  atletaParaInscricao(atletaId: string): Promise<AtletaParaInscricao | null>;
  // Numa única transação: confere a RN-07, ocupa a vaga se a inscrição já nasce
  // confirmada (RN-06) e, se a avaliação lotar, expira os convites pendentes (RN-12).
  inscrever(dados: NovaInscricao, agora: Date): Promise<ResultadoInscricao>;
  listarDoAtleta(
    atletaId: string,
    situacao: SituacaoInscricao,
    paginacao: Paginacao,
    agora: Date,
  ): Promise<{ dados: InscricaoDoAtleta[]; total: number }>;
}
