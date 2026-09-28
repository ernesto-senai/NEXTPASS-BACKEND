import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { LanceDoFeed, LanceRepository } from "../domain/lance.ts";

export type ListarFeedDeLances = (paginacao: Paginacao) => Promise<Pagina<LanceDoFeed>>;
export type RegistrarVisualizacao = (videoId: string, olheiroId: string) => Promise<void>;

// RF-32: feed de lances para olheiros verificados.
export function criarListarFeedDeLances(deps: { lances: LanceRepository }): ListarFeedDeLances {
  return async (paginacao) => {
    const { dados, total } = await deps.lances.listarFeed(paginacao);
    return { dados, total, pagina: paginacao.pagina };
  };
}

// RF-33: alimenta o contador de visualizações do lance.
export function criarRegistrarVisualizacao(deps: {
  lances: LanceRepository;
}): RegistrarVisualizacao {
  return async (videoId, olheiroId) => {
    if (!(await deps.lances.existe(videoId))) {
      throw new AppError("NAO_ENCONTRADO", "Lance não encontrado.");
    }
    await deps.lances.registrarVisualizacao(videoId, olheiroId);
  };
}
