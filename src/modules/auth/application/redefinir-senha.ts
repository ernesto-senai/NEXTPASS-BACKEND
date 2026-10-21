import type { Correio } from "../../../shared/domain/correio.ts";
import type { Hasher } from "../../../shared/domain/hasher.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  type ContaRepository,
  type EmissorTokens,
  type RefreshTokenRepository,
  type TokenSenhaRepository,
  VALIDADE_LINK_SENHA_MS,
} from "../domain/sessao.ts";

export type PedirNovaSenha = (email: string) => Promise<void>;
export type RedefinirSenha = (dados: { token: string; senha: string }) => Promise<void>;

interface Deps {
  contas: ContaRepository;
  tokensSenha: TokenSenhaRepository;
  refreshTokens: RefreshTokenRepository;
  tokens: EmissorTokens;
  hasher: Hasher;
  correio: Correio;
  urlDoApp: string;
  agora?: () => Date;
}

// RF-05: envia o link de nova senha. Responde igual se o e-mail não existir,
// para não revelar quem tem conta.
export function criarPedirNovaSenha(deps: Deps): PedirNovaSenha {
  const agora = deps.agora ?? (() => new Date());

  return async (email) => {
    const conta = await deps.contas.buscarPorEmail(email);
    if (!conta || conta.status === "SUSPENSO") return;

    const { token, hash } = deps.tokens.gerarRefreshToken();
    await deps.tokensSenha.salvar({
      usuarioId: conta.id,
      tokenHash: hash,
      expiraEm: new Date(agora().getTime() + VALIDADE_LINK_SENHA_MS),
    });
    await deps.correio.enviar({
      para: email,
      assunto: "Crie uma nova senha no NextPass",
      texto: [
        `Olá, ${conta.nome}!`,
        "",
        "Recebemos um pedido para criar uma nova senha. Use este link em até 1 hora:",
        `${deps.urlDoApp}/redefinir-senha?token=${token}`,
        "",
        "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
      ].join("\n"),
    });
  };
}

// RF-05: troca a senha pelo link (uso único) e encerra as sessões abertas.
export function criarRedefinirSenha(deps: Deps): RedefinirSenha {
  const agora = deps.agora ?? (() => new Date());

  return async ({ token, senha }) => {
    const salvo = await deps.tokensSenha.buscarValido(deps.tokens.hashRefreshToken(token), agora());
    if (!salvo || !(await deps.tokensSenha.usar(salvo.id, agora()))) {
      throw new AppError("LINK_INVALIDO", "Este link é inválido ou expirou. Peça um novo.");
    }

    await deps.contas.atualizarSenha(salvo.usuarioId, await deps.hasher.gerar(senha));
    await deps.refreshTokens.revogarTodos(salvo.usuarioId, agora());
  };
}
