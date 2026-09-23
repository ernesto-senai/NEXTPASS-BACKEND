import type { EmissorTokens, RefreshTokenRepository } from "../domain/sessao.ts";

export type EncerrarSessao = (refreshToken: string, usuarioId: string) => Promise<void>;

// RF-55: invalida o token de atualização do aparelho. Repetir o logout não dá erro.
export function criarEncerrarSessao(deps: {
  refreshTokens: RefreshTokenRepository;
  tokens: EmissorTokens;
  agora?: () => Date;
}): EncerrarSessao {
  const agora = deps.agora ?? (() => new Date());

  return async (refreshToken, usuarioId) => {
    const momento = agora();
    const salvo = await deps.refreshTokens.buscarValido(
      deps.tokens.hashRefreshToken(refreshToken),
      momento,
    );
    if (salvo?.usuarioId === usuarioId) await deps.refreshTokens.revogar(salvo.id, momento);
  };
}
