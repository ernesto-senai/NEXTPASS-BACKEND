import { createHash, randomInt } from "node:crypto";
import type { Correio } from "../../../shared/domain/correio.ts";
import type { Hasher } from "../../../shared/domain/hasher.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type {
  CodigoDeSenhaRepository,
  ContaRepository,
  RefreshTokenRepository,
} from "../domain/sessao.ts";

export const VALIDADE_CODIGO_MS = 15 * 60 * 1000;

export type PedirNovaSenha = (email: string) => Promise<void>;
export type RedefinirSenha = (dados: {
  email: string;
  codigo: string;
  novaSenha: string;
}) => Promise<void>;

// O hash junta a conta e o código, porque duas pessoas podem receber o mesmo número.
const hashDoCodigo = (usuarioId: string, codigo: string) =>
  createHash("sha256").update(`${usuarioId}:${codigo}`).digest("hex");

const textoDoEmail = (nome: string, codigo: string) =>
  [
    `Olá, ${nome.trim().split(/\s+/)[0]}!`,
    "Use este código para criar uma nova senha no NextPass:",
    codigo,
    "Ele vale por 15 minutos. Se você não pediu uma nova senha, ignore este e-mail: a sua senha continua a mesma.",
  ].join("\n\n");

// RF-05: manda por e-mail um código de 6 números que vale 15 minutos. A resposta é a
// mesma com ou sem conta, para não revelar quem está cadastrado.
export function criarPedirNovaSenha(deps: {
  contas: ContaRepository;
  codigosDeSenha: CodigoDeSenhaRepository;
  correio: Correio;
  agora?: () => Date;
}): PedirNovaSenha {
  const agora = deps.agora ?? (() => new Date());

  return async (email) => {
    const conta = await deps.contas.buscarPorEmail(email);
    if (!conta || conta.status !== "ATIVO") return;

    const codigo = String(randomInt(1_000_000)).padStart(6, "0");
    await deps.codigosDeSenha.substituir({
      usuarioId: conta.id,
      tokenHash: hashDoCodigo(conta.id, codigo),
      expiraEm: new Date(agora().getTime() + VALIDADE_CODIGO_MS),
    });
    // Sem esperar o envio: assim a resposta demora o mesmo com ou sem conta.
    deps.correio
      .enviar({
        para: email,
        assunto: "Código para criar uma nova senha no NextPass",
        texto: textoDoEmail(conta.nome, codigo),
      })
      .catch((erro) => console.error("Não foi possível enviar o código de nova senha:", erro));
  };
}

// RF-05: troca a senha com o código do e-mail e encerra as sessões dos outros aparelhos.
export function criarRedefinirSenha(deps: {
  contas: ContaRepository;
  codigosDeSenha: CodigoDeSenhaRepository;
  refreshTokens: RefreshTokenRepository;
  hasher: Hasher;
  agora?: () => Date;
}): RedefinirSenha {
  const agora = deps.agora ?? (() => new Date());

  return async ({ email, codigo, novaSenha }) => {
    const momento = agora();
    const conta = await deps.contas.buscarPorEmail(email);
    const valido =
      conta && (await deps.codigosDeSenha.usar(hashDoCodigo(conta.id, codigo), momento));
    if (!conta || !valido) {
      throw new AppError("CODIGO_INVALIDO", "Código errado ou vencido. Peça um novo código.");
    }

    await deps.contas.atualizarSenha(conta.id, await deps.hasher.gerar(novaSenha));
    await deps.refreshTokens.revogarTodos(conta.id, momento);
  };
}
