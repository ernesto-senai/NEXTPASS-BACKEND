import type { AtuacaoOlheiro, StatusVerificacao } from "../../../generated/prisma/enums.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";

// RF-17: situação da verificação do olheiro. status null: ainda não enviou os
// documentos. Só a aprovação libera as funções de olheiro (RN-04).
export interface SituacaoVerificacao {
  verificado: boolean;
  status: StatusVerificacao | null;
  motivoRecusa: string | null;
}

// RF-16: documentos aceitos (tipo MIME → extensão) e tamanho máximo.
export const FORMATOS_DOCUMENTO = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;
export type FormatoDocumento = keyof typeof FORMATOS_DOCUMENTO;
export const TAMANHO_MAXIMO_DOCUMENTO_MB = 10;

// RF-57: pedido na fila do administrador.
export interface VerificacaoParaAnalise {
  id: string;
  status: StatusVerificacao;
  criadoEm: Date;
  documentoUrl: string;
  comprovanteUrl: string | null;
  olheiro: {
    id: string;
    nome: string;
    email: string;
    atuacao: AtuacaoOlheiro;
    clube: string | null;
  };
}

export interface VerificacaoRepository {
  situacao(olheiroId: string): Promise<SituacaoVerificacao>;
  atuacaoDoOlheiro(olheiroId: string): Promise<AtuacaoOlheiro | null>;
  criar(dados: {
    olheiroId: string;
    documentoUrl: string;
    comprovanteUrl: string | null;
  }): Promise<void>;
  listarParaAnalise(
    status: StatusVerificacao,
    paginacao: Paginacao,
  ): Promise<{ dados: VerificacaoParaAnalise[]; total: number }>;
  buscar(id: string): Promise<{ id: string; olheiroId: string; status: StatusVerificacao } | null>;
  // Grava a decisão e libera (ou não) as funções do olheiro (RN-04).
  analisar(
    id: string,
    decisao: {
      status: "APROVADA" | "RECUSADA";
      motivoRecusa: string | null;
      adminId: string;
      agora: Date;
    },
  ): Promise<void>;
}
