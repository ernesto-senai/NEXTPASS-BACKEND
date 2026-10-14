import type { AtuacaoOlheiro } from "../../../generated/prisma/enums.ts";
import type { Hasher } from "../../../shared/domain/hasher.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { UsuarioCriado, UsuarioRepository } from "../domain/usuario-repository.ts";

export interface EntradaCadastroAtleta {
  nome: string;
  email: string;
  senha: string;
}

export interface EntradaCadastroOlheiro extends EntradaCadastroAtleta {
  telefone: string;
  atuacao: AtuacaoOlheiro;
  clube?: string | undefined;
}

export type CadastrarAtleta = (entrada: EntradaCadastroAtleta) => Promise<UsuarioCriado>;
export type CadastrarOlheiro = (entrada: EntradaCadastroOlheiro) => Promise<UsuarioCriado>;

interface Deps {
  usuarios: UsuarioRepository;
  hasher: Hasher;
  agora?: () => Date;
}

const emailJaCadastrado = () =>
  new AppError("EMAIL_JA_CADASTRADO", "Este e-mail já tem uma conta. Faça login.");

// Prepara os dados comuns: e-mail livre, hash da senha e registro do aceite dos termos (RF-10).
async function prepararUsuario(deps: Deps, { nome, email, senha }: EntradaCadastroAtleta) {
  if (await deps.usuarios.emailEmUso(email)) throw emailJaCadastrado();

  return {
    nome,
    email,
    senhaHash: await deps.hasher.gerar(senha),
    termosAceitosEm: (deps.agora ?? (() => new Date()))(),
  };
}

// RF-08: o perfil técnico fica vazio até o atleta completá-lo (RF-13).
export function criarCadastrarAtleta(deps: Deps): CadastrarAtleta {
  return async (entrada) => {
    const criado = await deps.usuarios.criarAtleta(await prepararUsuario(deps, entrada));
    if (!criado) throw emailJaCadastrado();
    return criado;
  };
}

// RF-09: o olheiro nasce sem verificação e só atua depois da aprovação (RN-04).
export function criarCadastrarOlheiro(deps: Deps): CadastrarOlheiro {
  return async (entrada) => {
    const criado = await deps.usuarios.criarOlheiro({
      ...(await prepararUsuario(deps, entrada)),
      telefone: entrada.telefone,
      atuacao: entrada.atuacao,
      clube: entrada.atuacao === "CLUBE" ? (entrada.clube ?? null) : null,
    });
    if (!criado) throw emailJaCadastrado();
    return criado;
  };
}
