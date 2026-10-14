import { AppError } from "../../../shared/errors/app-error.ts";
import {
  type ContaRepository,
  type EmissorTokens,
  paraUsuarioAutenticado,
  type RefreshTokenRepository,
  type Sessao,
} from "../domain/sessao.ts";
import type { EmitirSessao } from "./emitir-sessao.ts";

export type RenovarSessao = (refreshToken: string) => Promise<Sessao>;

// RF-03: troca o token de atualização por uma sessão nova. Cada token vale uma
// vez só (rotação), então um token vazado deixa de funcionar no primeiro uso.
export function criarRenovarSessao(deps: {
  contas: ContaRepository;
  refreshTokens: RefreshTokenRepository;
  tokens: EmissorTokens;
  emitirSessao: EmitirSessao;
  agora?: () => Date;
}): RenovarSessao {
  const agora = deps.agora ?? (() => new Date());
  const sessaoInvalida = () => new AppError("TOKEN_INVALIDO", "Sessão expirada. Entre novamente.");

  return async (refreshToken) => {
    const momento = agora();
    const salvo = await deps.refreshTokens.buscarValido(
      deps.tokens.hashRefreshToken(refreshToken),
      momento,
    );
    if (!salvo || !(await deps.refreshTokens.revogar(salvo.id, momento))) {
      throw sessaoInvalida();
    }

    const conta = await deps.contas.buscarPorId(salvo.usuarioId);
    if (!conta || conta.status === "SUSPENSO") throw sessaoInvalida();

    return deps.emitirSessao(paraUsuarioAutenticado(conta), salvo.expiraEm);
  };
}
