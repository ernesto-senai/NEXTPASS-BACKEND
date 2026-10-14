import type { Hasher } from "../../../shared/domain/hasher.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  type ContaRepository,
  DURACAO_SESSAO_MS,
  paraUsuarioAutenticado,
  type Sessao,
} from "../domain/sessao.ts";
import type { EmitirSessao } from "./emitir-sessao.ts";

export interface EntradaLogin {
  email: string;
  senha: string;
  lembrar: boolean;
}

export type FazerLogin = (entrada: EntradaLogin) => Promise<Sessao>;

// RF-01 e RF-03: login com e-mail e senha.
export function criarFazerLogin(deps: {
  contas: ContaRepository;
  hasher: Hasher;
  emitirSessao: EmitirSessao;
  agora?: () => Date;
}): FazerLogin {
  const agora = deps.agora ?? (() => new Date());

  return async ({ email, senha, lembrar }) => {
    const conta = await deps.contas.buscarPorEmail(email);
    const senhaConfere = conta?.senhaHash
      ? await deps.hasher.comparar(senha, conta.senhaHash)
      : false;

    // A mesma mensagem para e-mail inexistente e senha errada não revela quem tem conta.
    if (!conta || !senhaConfere) {
      throw new AppError("CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos.");
    }
    if (conta.status === "SUSPENSO") {
      throw new AppError("CONTA_SUSPENSA", "Sua conta está suspensa. Fale com o suporte.");
    }

    const duracao = lembrar ? DURACAO_SESSAO_MS.lembrar : DURACAO_SESSAO_MS.padrao;
    return deps.emitirSessao(paraUsuarioAutenticado(conta), new Date(agora().getTime() + duracao));
  };
}
