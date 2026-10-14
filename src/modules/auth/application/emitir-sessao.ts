import type {
  EmissorTokens,
  RefreshTokenRepository,
  Sessao,
  UsuarioAutenticado,
} from "../domain/sessao.ts";

export type EmitirSessao = (usuario: UsuarioAutenticado, expiraEm: Date) => Promise<Sessao>;

export function criarEmitirSessao(deps: {
  refreshTokens: RefreshTokenRepository;
  tokens: EmissorTokens;
}): EmitirSessao {
  return async (usuario, expiraEm) => {
    const refresh = deps.tokens.gerarRefreshToken();
    await deps.refreshTokens.salvar({ usuarioId: usuario.id, tokenHash: refresh.hash, expiraEm });

    return {
      usuario,
      accessToken: deps.tokens.gerarAccessToken(usuario),
      refreshToken: refresh.token,
    };
  };
}
