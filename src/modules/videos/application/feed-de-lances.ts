import { intervalo, type Pagina, type Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { LanceDoFeed, LanceRepository } from "../domain/lance.ts";
import { ordenarFeed } from "../domain/ordem-do-feed.ts";

export interface ConsultaDoFeed extends Paginacao {
  olheiroId: string;
  // Momento em que o olheiro abriu o feed (Date.now() no app). Sorteia a ordem e separa
  // o que ele já tinha visto. Lance publicado depois entra quando ele atualiza o feed.
  semente: number;
}

export type ListarFeedDeLances = (
  consulta: ConsultaDoFeed,
) => Promise<Pagina<LanceDoFeed> & { semente: number }>;
export type RegistrarVisualizacao = (videoId: string, olheiroId: string) => Promise<void>;

// RF-32: feed de lances para olheiros verificados, em ordem aleatória.
export function criarListarFeedDeLances(deps: { lances: LanceRepository }): ListarFeedDeLances {
  return async ({ olheiroId, semente, ...paginacao }) => {
    const candidatos = await deps.lances.listarCandidatosDoFeed(olheiroId, new Date(semente));
    const { skip, take } = intervalo(paginacao);
    const ids = ordenarFeed(candidatos, semente).slice(skip, skip + take);
    const lances = await deps.lances.buscarDoFeed(ids);
    const porId = new Map(lances.map((lance) => [lance.id, lance] as const));
    return {
      dados: ids.flatMap((id) => porId.get(id) ?? []),
      total: candidatos.length,
      pagina: paginacao.pagina,
      semente,
    };
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
