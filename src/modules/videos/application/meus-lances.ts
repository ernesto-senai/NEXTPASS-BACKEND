import type { Armazenamento } from "../../../shared/domain/armazenamento.ts";
import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  type EdicaoDeLance,
  type Lance,
  type LanceDoAtleta,
  type LanceRepository,
  MAXIMO_DESTAQUES,
} from "../domain/lance.ts";

export type ListarMeusLances = (
  atletaId: string,
  paginacao: Paginacao,
) => Promise<Pagina<LanceDoAtleta>>;
export type EditarLance = (atletaId: string, id: string, dados: EdicaoDeLance) => Promise<Lance>;
export type ExcluirLance = (atletaId: string, id: string) => Promise<void>;

// Só o dono mexe no lance; para os outros, ele "não existe".
async function lanceDoDono(lances: LanceRepository, atletaId: string, id: string) {
  const lance = await lances.buscarParaDono(id);
  if (!lance || lance.atletaId !== atletaId) {
    throw new AppError("NAO_ENCONTRADO", "Lance não encontrado.");
  }
  return lance;
}

// RF-28: lances do perfil, com os destaques do carrossel primeiro.
export function criarListarMeusLances(deps: { lances: LanceRepository }): ListarMeusLances {
  return async (atletaId, paginacao) => ({
    ...(await deps.lances.listarDoAtleta(atletaId, paginacao)),
    pagina: paginacao.pagina,
  });
}

// RF-31: edita a legenda ou marca o lance como destaque (até 3 no carrossel).
export function criarEditarLance(deps: { lances: LanceRepository }): EditarLance {
  return async (atletaId, id, dados) => {
    const lance = await lanceDoDono(deps.lances, atletaId, id);
    const novoDestaque = dados.destaque && !lance.destaque;
    if (novoDestaque && (await deps.lances.contarDestaques(atletaId)) >= MAXIMO_DESTAQUES) {
      throw new AppError(
        "LIMITE_DESTAQUES",
        `Você pode destacar até ${MAXIMO_DESTAQUES} lances. Tire o destaque de outro antes.`,
      );
    }
    return deps.lances.atualizar(id, dados);
  };
}

// RF-30: exclui o lance e o arquivo do vídeo.
export function criarExcluirLance(deps: {
  lances: LanceRepository;
  armazenamento: Armazenamento;
}): ExcluirLance {
  return async (atletaId, id) => {
    const { url } = await lanceDoDono(deps.lances, atletaId, id);
    await deps.lances.remover(id);
    await deps.armazenamento.remover(url);
  };
}
