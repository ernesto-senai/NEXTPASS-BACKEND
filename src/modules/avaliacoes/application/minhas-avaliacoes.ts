import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import type {
  AvaliacaoRepository,
  AvaliacaoResumo,
  NovaAvaliacao,
  SituacaoAvaliacao,
} from "../domain/avaliacao.ts";

export type ListarMinhasAvaliacoes = (
  olheiroId: string,
  situacao: SituacaoAvaliacao,
  paginacao: Paginacao,
) => Promise<Pagina<AvaliacaoResumo>>;

export type CancelarAvaliacao = (olheiroId: string, id: string) => Promise<void>;

export type EditarAvaliacao = (
  olheiroId: string,
  id: string,
  dados: NovaAvaliacao,
) => Promise<AvaliacaoResumo>;

interface Deps {
  avaliacoes: AvaliacaoRepository;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}

// RN-11: o olheiro só mexe nas próprias avaliações, e só nas que ainda vão
// acontecer.
async function avaliacaoDoDono(
  avaliacoes: AvaliacaoRepository,
  olheiroId: string,
  id: string,
  agora: Date,
) {
  const avaliacao = await avaliacoes.buscarParaDono(id);
  if (!avaliacao) throw new AppError("NAO_ENCONTRADO", "Avaliação não encontrada.");
  if (avaliacao.olheiroId !== olheiroId) {
    throw new AppError("ACESSO_NEGADO", "Você só pode alterar as suas avaliações.");
  }
  const encerrada = !["ABERTA", "ESGOTADA"].includes(avaliacao.status);
  if (encerrada || avaliacao.dataHora <= agora) {
    throw new AppError("AVALIACAO_ENCERRADA", "Esta avaliação já aconteceu ou foi cancelada.");
  }
  return avaliacao;
}

const avisarInscritos = (
  notificacoes: NotificacaoRepository,
  inscritos: string[],
  texto: string,
  avaliacaoId: string,
) =>
  notificacoes.criar(
    inscritos.map((usuarioId) => ({
      usuarioId,
      tipo: "AVALIACAO_ALTERADA",
      texto,
      dados: { avaliacaoId },
    })),
  );

// RF-42: "Minhas avaliações", com o total de participantes de cada uma.
export function criarListarMinhasAvaliacoes(deps: {
  avaliacoes: AvaliacaoRepository;
  agora?: () => Date;
}): ListarMinhasAvaliacoes {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, situacao, paginacao) => ({
    ...(await deps.avaliacoes.listarDoOlheiro(olheiroId, situacao, paginacao, agora())),
    pagina: paginacao.pagina,
  });
}

// RF-43: o olheiro cancela a avaliação e os inscritos são avisados.
export function criarCancelarAvaliacao(deps: Deps): CancelarAvaliacao {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, id) => {
    const avaliacao = await avaliacaoDoDono(deps.avaliacoes, olheiroId, id, agora());
    const inscritos = await deps.avaliacoes.cancelar(id);
    await avisarInscritos(
      deps.notificacoes,
      inscritos,
      `A avaliação ${avaliacao.nome} foi cancelada pelo olheiro.`,
      id,
    );
  };
}

// RF-43: o olheiro corrige os dados e os inscritos são avisados. O limite de
// vagas não pode ficar abaixo dos participantes já confirmados (RN-06).
export function criarEditarAvaliacao(deps: Deps): EditarAvaliacao {
  const agora = deps.agora ?? (() => new Date());

  return async (olheiroId, id, dados) => {
    const atual = await avaliacaoDoDono(deps.avaliacoes, olheiroId, id, agora());
    if (dados.dataHora <= agora()) {
      throw new AppError(
        "DADOS_INVALIDOS",
        "Escolha uma data e um horário que ainda não passaram.",
      );
    }
    if (dados.vagas < atual.vagasOcupadas) {
      throw new AppError(
        "DADOS_INVALIDOS",
        `Já há ${atual.vagasOcupadas} participantes confirmados; o limite de vagas não pode ser menor.`,
      );
    }

    const { avaliacao, inscritos } = await deps.avaliacoes.atualizar(id, dados);
    await avisarInscritos(
      deps.notificacoes,
      inscritos,
      `A avaliação ${avaliacao.nome} foi alterada. Confira a data, o horário e o local.`,
      id,
    );
    return avaliacao;
  };
}
