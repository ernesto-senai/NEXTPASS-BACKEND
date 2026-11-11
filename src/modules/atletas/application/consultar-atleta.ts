import { AppError } from "../../../shared/errors/app-error.ts";
import type { LanceRepository } from "../../videos/domain/lance.ts";
import { type AtletaDetalhe, type AtletaRepository, paraAtletaResumo } from "../domain/atleta.ts";

export type ConsultarAtleta = (id: string) => Promise<AtletaDetalhe>;

// O carrossel do perfil mostra até 3 lances, os destaques primeiro (RF-28).
const LANCES_DO_PERFIL = 3;

// RF-38 e RF-45: ficha técnica, posições e lances em destaque do atleta, para
// o olheiro verificado (RN-04). Perfil incompleto não aparece (RN-02).
export function criarConsultarAtleta(deps: {
  atletas: AtletaRepository;
  lances: Pick<LanceRepository, "listarDoAtleta">;
  agora?: () => Date;
}): ConsultarAtleta {
  const agora = deps.agora ?? (() => new Date());

  return async (id) => {
    const atleta = await deps.atletas.buscarPorId(id);
    if (!atleta) throw new AppError("NAO_ENCONTRADO", "Atleta não encontrado.");

    const { dados, total } = await deps.lances.listarDoAtleta(id, {
      pagina: 1,
      limite: LANCES_DO_PERFIL,
    });
    return { ...paraAtletaResumo(atleta, agora()), lances: dados, totalLances: total };
  };
}
