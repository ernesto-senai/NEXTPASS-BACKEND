import type { TipoUsuario } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { InscricaoRepository } from "../../inscricoes/domain/inscricao.ts";
import type { AvaliacaoDetalhe, AvaliacaoRepository } from "../domain/avaliacao.ts";

export type ConsultarAvaliacao = (
  usuario: { id: string; tipo: TipoUsuario },
  id: string,
) => Promise<AvaliacaoDetalhe>;

// RF-20: tudo o que o atleta precisa antes de se inscrever. RN-08: o endereço
// completo só aparece para o olheiro dono e para quem já está confirmado.
export function criarConsultarAvaliacao(deps: {
  avaliacoes: AvaliacaoRepository;
  inscricoes: Pick<InscricaoRepository, "daAvaliacao">;
}): ConsultarAvaliacao {
  return async (usuario, id) => {
    const avaliacao = await deps.avaliacoes.buscarDetalhe(id);
    if (!avaliacao) throw new AppError("NAO_ENCONTRADO", "Avaliação não encontrada.");

    const minhaInscricao =
      usuario.tipo === "ATLETA" ? await deps.inscricoes.daAvaliacao(usuario.id, id) : null;
    const podeVerEndereco =
      avaliacao.olheiro.id === usuario.id || minhaInscricao?.status === "CONFIRMADA";

    return {
      ...avaliacao,
      endereco: podeVerEndereco ? avaliacao.endereco : null,
      minhaInscricao,
    };
  };
}
