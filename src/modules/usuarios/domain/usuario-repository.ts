import type { AtuacaoOlheiro, TipoUsuario } from "../../../generated/prisma/enums.ts";

export interface NovoUsuario {
  nome: string;
  email: string;
  senhaHash: string;
  termosAceitosEm: Date;
}

export interface NovoOlheiro extends NovoUsuario {
  telefone: string;
  atuacao: AtuacaoOlheiro;
  clube: string | null;
}

export interface UsuarioCriado {
  id: string;
  nome: string;
  tipo: TipoUsuario;
}

export interface UsuarioRepository {
  emailEmUso(email: string): Promise<boolean>;
  // Devolve null se o e-mail foi cadastrado por outro pedido no meio do caminho.
  criarAtleta(dados: NovoUsuario): Promise<UsuarioCriado | null>;
  criarOlheiro(dados: NovoOlheiro): Promise<UsuarioCriado | null>;
}
