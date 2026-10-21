import type { StatusInscricao, TipoUsuario } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import {
  type InscricaoParaAlteracao,
  type InscricaoRepository,
  inscricaoAtiva,
} from "../domain/inscricao.ts";

export type NovoStatusInscricao = "CANCELADA" | "REMOVIDA" | "CONFIRMADA" | "RECUSADA";

export type AlterarInscricao = (
  usuario: { id: string; tipo: TipoUsuario },
  id: string,
  status: NovoStatusInscricao,
) => Promise<{ id: string; status: StatusInscricao }>;

interface Deps {
  inscricoes: InscricaoRepository;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}

const naoEncontrada = () => new AppError("NAO_ENCONTRADO", "Inscrição não encontrada.");
const encerrada = (mensagem: string) => new AppError("INSCRICAO_ENCERRADA", mensagem);

function exigirStatus(status: NovoStatusInscricao, permitidos: NovoStatusInscricao[]) {
  if (!permitidos.includes(status)) {
    throw new AppError("DADOS_INVALIDOS", "Essa mudança não é permitida para o seu perfil.");
  }
}

function exigirAtiva({ status }: InscricaoParaAlteracao) {
  if (!inscricaoAtiva(status)) throw encerrada("Esta inscrição já foi encerrada.");
}

// Uma rota só para as mudanças de status da inscrição (Endpoints v2.0):
// RF-22 o atleta cancela, RF-46 o olheiro dono remove (RN-11) e RF-50 o
// responsável aprova ou recusa (RN-03). Só vale antes da data da avaliação.
export function criarAlterarInscricao(deps: Deps): AlterarInscricao {
  const agora = deps.agora ?? (() => new Date());

  const avisar = (
    usuarioId: string,
    tipo: "INSCRICAO_ATUALIZADA" | "NOVA_INSCRICAO",
    texto: string,
    inscricaoId: string,
  ) => deps.notificacoes.criar([{ usuarioId, tipo, texto, dados: { inscricaoId } }]);

  return async (usuario, id, status) => {
    const inscricao = await deps.inscricoes.buscarParaAlteracao(id);
    if (!inscricao) throw naoEncontrada();
    const { atleta, avaliacao } = inscricao;

    if (!["ABERTA", "ESGOTADA"].includes(avaliacao.status) || avaliacao.dataHora <= agora()) {
      throw encerrada("Esta avaliação já aconteceu ou foi cancelada.");
    }

    if (usuario.tipo === "ATLETA") {
      if (atleta.id !== usuario.id) throw naoEncontrada();
      exigirStatus(status, ["CANCELADA"]);
      exigirAtiva(inscricao);
      await deps.inscricoes.encerrar(id, "CANCELADA");
    } else if (usuario.tipo === "OLHEIRO") {
      if (avaliacao.olheiroId !== usuario.id) {
        throw new AppError("ACESSO_NEGADO", "Você só pode alterar as suas avaliações.");
      }
      exigirStatus(status, ["REMOVIDA"]);
      exigirAtiva(inscricao);
      await deps.inscricoes.encerrar(id, "REMOVIDA");
      await avisar(
        atleta.id,
        "INSCRICAO_ATUALIZADA",
        `Sua inscrição em ${avaliacao.nome} foi removida pelo olheiro.`,
        id,
      );
    } else if (usuario.tipo === "RESPONSAVEL") {
      if (!(await deps.inscricoes.responsavelDe(usuario.id, atleta.id))) throw naoEncontrada();
      exigirStatus(status, ["CONFIRMADA", "RECUSADA"]);
      if (inscricao.status !== "AGUARDANDO_RESPONSAVEL") {
        throw encerrada("Esta inscrição já foi respondida.");
      }

      if (status === "RECUSADA") {
        await deps.inscricoes.encerrar(id, "RECUSADA");
        await avisar(
          atleta.id,
          "INSCRICAO_ATUALIZADA",
          `Seu responsável recusou a inscrição em ${avaliacao.nome}.`,
          id,
        );
      } else {
        if ((await deps.inscricoes.confirmar(id, agora())) === "SEM_VAGAS") {
          throw new AppError("VAGAS_ESGOTADAS", "Não há mais vagas nesta avaliação.");
        }
        await avisar(
          atleta.id,
          "INSCRICAO_ATUALIZADA",
          `Seu responsável aprovou a inscrição em ${avaliacao.nome}.`,
          id,
        );
        await avisar(
          avaliacao.olheiroId,
          "NOVA_INSCRICAO",
          `${atleta.nome} se inscreveu em ${avaliacao.nome}.`,
          id,
        );
      }
    } else {
      throw new AppError("ACESSO_NEGADO", "Seu perfil não tem acesso a este recurso.");
    }

    return { id, status };
  };
}
