import type { Paginacao } from "../../../shared/domain/pagina.ts";

// RN-09: duração do lance, em segundos.
export const DURACAO_LANCE = { min: 30, max: 60 } as const;

// RNF-04: formatos aceitos (tipo MIME → extensão do arquivo) e tamanho máximo.
export const FORMATOS_LANCE = { "video/mp4": "mp4", "video/quicktime": "mov" } as const;
export type FormatoLance = keyof typeof FORMATOS_LANCE;
export const TAMANHO_MAXIMO_LANCE_MB = 50;

// Lance do próprio atleta (RF-25, RF-28).
export interface Lance {
  id: string;
  url: string;
  legenda: string | null;
  localizacao: string | null;
  duracaoSeg: number;
  destaque: boolean;
  criadoEm: Date;
}

export type NovoLance = Pick<Lance, "url" | "legenda" | "localizacao" | "duracaoSeg"> & {
  atletaId: string;
};

// RF-28 e RF-31: o carrossel do perfil mostra até 3 lances em destaque.
export const MAXIMO_DESTAQUES = 3;

export type LanceDoAtleta = Lance & { visualizacoes: number };

export interface EdicaoDeLance {
  legenda?: string | null | undefined;
  destaque?: boolean | undefined;
}

// Item do feed de lances do olheiro (RF-32).
export interface LanceDoFeed {
  id: string;
  url: string;
  legenda: string | null;
  localizacao: string | null;
  duracaoSeg: number;
  criadoEm: Date;
  visualizacoes: number;
  atleta: { id: string; nome: string; fotoUrl: string | null };
}

export interface LanceRepository {
  criar(dados: NovoLance): Promise<Lance>;
  // Destaques primeiro, depois do mais recente para o mais antigo.
  listarDoAtleta(
    atletaId: string,
    paginacao: Paginacao,
  ): Promise<{ dados: LanceDoAtleta[]; total: number }>;
  buscarParaDono(id: string): Promise<{ atletaId: string; url: string; destaque: boolean } | null>;
  contarDestaques(atletaId: string): Promise<number>;
  atualizar(id: string, dados: EdicaoDeLance): Promise<Lance>;
  remover(id: string): Promise<void>;
  // Do mais recente para o mais antigo.
  listarFeed(paginacao: Paginacao): Promise<{ dados: LanceDoFeed[]; total: number }>;
  existe(id: string): Promise<boolean>;
  registrarVisualizacao(videoId: string, olheiroId: string): Promise<void>;
}
