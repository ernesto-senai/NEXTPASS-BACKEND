import { calcularCategoria, calcularIdade } from "../../../shared/domain/idade-categoria.ts";
import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import {
  type AtletaRepository,
  type AtletaResumo,
  type FiltroAtletas,
  intervaloDeNascimento,
} from "../domain/atleta.ts";

export type BuscarAtletas = (
  filtro: FiltroAtletas,
  paginacao: Paginacao,
) => Promise<Pagina<AtletaResumo>>;

// RF-35 a RF-37: tela "Encontrar atleta" do olheiro verificado.
export function criarBuscarAtletas(deps: {
  atletas: AtletaRepository;
  agora?: () => Date;
}): BuscarAtletas {
  const agora = deps.agora ?? (() => new Date());

  return async (filtro, paginacao) => {
    const hoje = agora();
    const { dados, total } = await deps.atletas.buscar(
      { ...filtro, ...intervaloDeNascimento(filtro, hoje) },
      paginacao,
    );

    return {
      dados: dados.map(({ dataNascimento, ...atleta }) => ({
        ...atleta,
        idade: calcularIdade(dataNascimento, hoje),
        categoria: calcularCategoria(dataNascimento, hoje.getUTCFullYear()),
      })),
      total,
      pagina: paginacao.pagina,
    };
  };
}
