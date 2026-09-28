import type { Paginacao } from "../../../shared/domain/pagina.ts";

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
  // Do mais recente para o mais antigo.
  listarFeed(paginacao: Paginacao): Promise<{ dados: LanceDoFeed[]; total: number }>;
  existe(id: string): Promise<boolean>;
  registrarVisualizacao(videoId: string, olheiroId: string): Promise<void>;
}
