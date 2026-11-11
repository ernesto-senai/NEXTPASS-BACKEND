import type { Posicao, StatusAvaliacao, StatusInscricao } from "../../../generated/prisma/enums.ts";
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

// RF-50: inscrição de um atleta vinculado esperando a aprovação do responsável.
export interface InscricaoParaAprovar extends InscricaoDoAtleta {
  atleta: { id: string; nome: string };
}

// Inscrição ativa: conta para a RN-07 (uma por atleta e avaliação).
export const STATUS_ATIVOS = ["AGUARDANDO_RESPONSAVEL", "CONFIRMADA"] as const;

export const inscricaoAtiva = (status: StatusInscricao) =>
  STATUS_ATIVOS.some((ativo) => ativo === status);

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
  avaliacao: { nome: string; olheiroId: string };
}

export type ResultadoInscricao = InscricaoCriada | "SEM_VAGAS" | "INSCRICAO_EXISTENTE";

// O necessário para cancelar, remover, aprovar ou recusar uma inscrição.
export interface InscricaoParaAlteracao {
  id: string;
  status: StatusInscricao;
  atleta: { id: string; nome: string };
  avaliacao: {
    id: string;
    nome: string;
    olheiroId: string;
    dataHora: Date;
    status: StatusAvaliacao;
  };
}

// RF-44: participante na lista do olheiro.
export interface Inscrito {
  id: string;
  status: StatusInscricao;
  criadoEm: Date;
  atleta: {
    id: string;
    nome: string;
    fotoUrl: string | null;
    dataNascimento: Date | null;
    posicoes: Posicao[];
    cidade: string | null;
    uf: string | null;
  };
}

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
  // Inscrição do atleta na avaliação (RF-20: "Inscrito", "Aguardando responsável").
  daAvaliacao(
    atletaId: string,
    avaliacaoId: string,
  ): Promise<{
    id: string;
    status: StatusInscricao;
  } | null>;
  buscarParaAlteracao(id: string): Promise<InscricaoParaAlteracao | null>;
  // Cancela (atleta), remove (olheiro) ou recusa (responsável). Se ocupava
  // vaga, ela volta a ficar livre e a avaliação esgotada reabre (RN-06).
  encerrar(id: string, status: "CANCELADA" | "REMOVIDA" | "RECUSADA"): Promise<void>;
  // RN-03: o responsável aprova e a inscrição ocupa a vaga, se ainda houver.
  confirmar(id: string, agora: Date): Promise<"CONFIRMADA" | "SEM_VAGAS">;
  // RF-44: inscrições ativas da avaliação, com busca pelo nome do atleta.
  listarInscritos(
    avaliacaoId: string,
    busca: string | undefined,
    paginacao: Paginacao,
  ): Promise<{ dados: Inscrito[]; total: number }>;
  responsavelDe(responsavelId: string, atletaId: string): Promise<boolean>;
  // RF-50: inscrições aguardando aprovação dos atletas vinculados ao responsável.
  listarParaResponsavel(
    responsavelId: string,
    paginacao: Paginacao,
    agora: Date,
  ): Promise<{ dados: InscricaoParaAprovar[]; total: number }>;
}
