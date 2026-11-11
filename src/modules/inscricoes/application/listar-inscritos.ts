import type { Posicao, StatusInscricao } from "../../../generated/prisma/enums.ts";
import { calcularIdade } from "../../../shared/domain/idade-categoria.ts";
import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { AvaliacaoRepository } from "../../avaliacoes/domain/avaliacao.ts";
import type { InscricaoParaAprovar, InscricaoRepository } from "../domain/inscricao.ts";

// RF-44: participante na lista do olheiro, com a idade já calculada (RN-01).
export interface Participante {
  id: string;
  status: StatusInscricao;
  atleta: {
    id: string;
    nome: string;
    fotoUrl: string | null;
    idade: number | null;
    posicoes: Posicao[];
    cidade: string | null;
    uf: string | null;
  };
}

export type ListarParticipantes = (
  olheiroId: string,
  avaliacaoId: string,
  busca: string | undefined,
  paginacao: Paginacao,
) => Promise<Pagina<Participante>>;

export type ListarInscricoesParaAprovar = (
  responsavelId: string,
  paginacao: Paginacao,
) => Promise<Pagina<InscricaoParaAprovar>>;

// RF-44: inscritos de uma avaliação própria (RN-11), com busca por nome.
export function criarListarParticipantes(deps: {
  inscricoes: InscricaoRepository;
  avaliacoes: AvaliacaoRepository;
  agora?: () => Date;
}): ListarParticipantes {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, avaliacaoId, busca, paginacao) => {
    const avaliacao = await deps.avaliacoes.buscarParaDono(avaliacaoId);
    if (!avaliacao) throw new AppError("NAO_ENCONTRADO", "Avaliação não encontrada.");
    if (avaliacao.olheiroId !== olheiroId) {
      throw new AppError("ACESSO_NEGADO", "Você só vê os participantes das suas avaliações.");
    }

    const hoje = agora();
    const { dados, total } = await deps.inscricoes.listarInscritos(avaliacaoId, busca, paginacao);
    return {
      dados: dados.map(({ id, status, atleta: { dataNascimento, ...atleta } }) => ({
        id,
        status,
        atleta: { ...atleta, idade: dataNascimento ? calcularIdade(dataNascimento, hoje) : null },
      })),
      total,
      pagina: paginacao.pagina,
    };
  };
}

// RF-50: inscrições dos atletas vinculados esperando a aprovação.
export function criarListarInscricoesParaAprovar(deps: {
  inscricoes: InscricaoRepository;
  agora?: () => Date;
}): ListarInscricoesParaAprovar {
  const agora = deps.agora ?? (() => new Date());

  return async (responsavelId, paginacao) => ({
    ...(await deps.inscricoes.listarParaResponsavel(responsavelId, paginacao, agora())),
    pagina: paginacao.pagina,
  });
}
