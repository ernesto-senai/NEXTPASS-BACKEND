import { calcularCategoria, calcularIdade } from "../../../shared/domain/idade-categoria.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import { perfilCompleto } from "../../atletas/domain/atleta.ts";
import type { DadosDoAtleta, Perfil, PerfilRepository } from "../domain/perfil.ts";

export type ConsultarPerfil = (usuarioId: string) => Promise<Perfil>;
export type AtualizarPerfilAtleta = (usuarioId: string, dados: DadosDoAtleta) => Promise<Perfil>;

// RF-14 e RF-28: dados do usuário logado, com idade e categoria (RN-01).
export function criarConsultarPerfil(deps: {
  perfis: PerfilRepository;
  agora?: () => Date;
}): ConsultarPerfil {
  const agora = deps.agora ?? (() => new Date());

  return async (usuarioId) => {
    const perfil = await deps.perfis.buscar(usuarioId);
    if (!perfil) throw new AppError("NAO_ENCONTRADO", "Conta não encontrada.");
    if (!perfil.atleta) return { ...perfil, atleta: null };

    const { dataNascimento } = perfil.atleta;
    const hoje = agora();
    return {
      ...perfil,
      atleta: {
        ...perfil.atleta,
        idade: dataNascimento ? calcularIdade(dataNascimento, hoje) : null,
        categoria: dataNascimento ? calcularCategoria(dataNascimento, hoje.getUTCFullYear()) : null,
        perfilCompleto: perfilCompleto(perfil.atleta),
      },
    };
  };
}

// RF-13 e RF-14: o atleta completa ou edita os dados técnicos a qualquer
// momento; a resposta já traz a idade e a categoria recalculadas.
export function criarAtualizarPerfilAtleta(deps: {
  perfis: PerfilRepository;
  consultarPerfil: ConsultarPerfil;
}): AtualizarPerfilAtleta {
  return async (usuarioId, dados) => {
    await deps.perfis.atualizarAtleta(usuarioId, dados);
    return deps.consultarPerfil(usuarioId);
  };
}
