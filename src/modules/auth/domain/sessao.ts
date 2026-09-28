import type { StatusUsuario, TipoUsuario } from "../../../generated/prisma/enums.ts";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  tipo: TipoUsuario;
}

// Resposta de login, cadastro e renovação: o app guarda os dois tokens.
export interface Sessao {
  usuario: UsuarioAutenticado;
  accessToken: string;
  refreshToken: string;
}

export interface Conta extends UsuarioAutenticado {
  status: StatusUsuario;
  senhaHash: string | null;
}

// RF-03: com "Lembrar de mim" a sessão dura mais. A validade é fixada no login
// e mantida nas renovações, então a sessão não se estende para sempre.
export const DURACAO_SESSAO_MS = {
  lembrar: 30 * 24 * 60 * 60 * 1000,
  padrao: 12 * 60 * 60 * 1000,
} as const;

export interface EmissorTokens {
  gerarAccessToken(usuario: UsuarioAutenticado): string;
  gerarRefreshToken(): { token: string; hash: string };
  hashRefreshToken(token: string): string;
}

export interface ContaRepository {
  buscarPorEmail(email: string): Promise<Conta | null>;
  buscarPorId(id: string): Promise<Conta | null>;
}

export interface RefreshTokenSalvo {
  id: string;
  usuarioId: string;
  expiraEm: Date;
}

// Só o hash do token de atualização vai para o banco (RNF-07).
export interface RefreshTokenRepository {
  salvar(dados: { usuarioId: string; tokenHash: string; expiraEm: Date }): Promise<void>;
  buscarValido(tokenHash: string, agora: Date): Promise<RefreshTokenSalvo | null>;
  // Devolve false se outro pedido já usou o token (renovação concorrente).
  revogar(id: string, agora: Date): Promise<boolean>;
}

export function paraUsuarioAutenticado({ id, nome, tipo }: Conta): UsuarioAutenticado {
  return { id, nome, tipo };
}
