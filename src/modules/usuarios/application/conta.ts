import type { Armazenamento } from "../../../shared/domain/armazenamento.ts";
import type { Hasher } from "../../../shared/domain/hasher.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { ContaRepository } from "../../auth/domain/sessao.ts";
import { FORMATOS_FOTO, type FormatoFoto, type PerfilRepository } from "../domain/perfil.ts";

export type TrocarFoto = (
  usuarioId: string,
  foto: { conteudo: Buffer; formato: FormatoFoto },
) => Promise<{ fotoUrl: string }>;

export type ExcluirConta = (usuarioId: string, senha: string) => Promise<void>;

// RF-14: a foto nova substitui a anterior, cujo arquivo é apagado.
export function criarTrocarFoto(deps: {
  perfis: PerfilRepository;
  armazenamento: Armazenamento;
}): TrocarFoto {
  return async (usuarioId, { conteudo, formato }) => {
    const fotoUrl = await deps.armazenamento.salvar({
      pasta: "fotos",
      extensao: FORMATOS_FOTO[formato],
      conteudo,
    });
    const anterior = await deps.perfis.atualizarFoto(usuarioId, fotoUrl);
    if (anterior) await deps.armazenamento.remover(anterior);
    return { fotoUrl };
  };
}

// RF-56 (LGPD): o usuário exclui a própria conta, confirmando a senha. Os
// dados e os arquivos (foto, lances, documentos) são apagados de vez.
export function criarExcluirConta(deps: {
  contas: ContaRepository;
  perfis: PerfilRepository;
  armazenamento: Armazenamento;
  hasher: Hasher;
}): ExcluirConta {
  return async (usuarioId, senha) => {
    const conta = await deps.contas.buscarPorId(usuarioId);
    if (!conta) throw new AppError("NAO_ENCONTRADO", "Conta não encontrada.");
    if (!conta.senhaHash || !(await deps.hasher.comparar(senha, conta.senhaHash))) {
      throw new AppError("CREDENCIAIS_INVALIDAS", "Senha incorreta.");
    }

    const arquivos = await deps.perfis.excluirConta(usuarioId);
    for (const url of arquivos) await deps.armazenamento.remover(url);
  };
}
