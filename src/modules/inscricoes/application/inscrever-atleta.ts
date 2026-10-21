import { ehMenorDeIdade } from "../../../shared/domain/idade-categoria.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import type { InscricaoCriada, InscricaoRepository } from "../domain/inscricao.ts";

export type InscreverAtleta = (dados: {
  atletaId: string;
  avaliacaoId: string;
  conviteId?: string | undefined;
}) => Promise<InscricaoCriada>;

// RF-21 e RF-27: inscrição pelo botão da avaliação ou pelo aceite do convite.
// Adulto já sai confirmado e ocupa a vaga; menor de 18 anos espera a aprovação
// do responsável vinculado (RN-03).
export function criarInscreverAtleta(deps: {
  inscricoes: InscricaoRepository;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}): InscreverAtleta {
  const agora = deps.agora ?? (() => new Date());

  return async ({ atletaId, avaliacaoId, conviteId }) => {
    const atleta = await deps.inscricoes.atletaParaInscricao(atletaId);
    if (!atleta?.perfilCompleto || !atleta.dataNascimento) {
      throw new AppError("PERFIL_INCOMPLETO", "Complete seu perfil técnico para se inscrever.");
    }

    const menor = ehMenorDeIdade(atleta.dataNascimento, agora());
    if (menor && atleta.responsaveis.length === 0) {
      throw new AppError(
        "VINCULO_PENDENTE",
        "Seu responsável precisa confirmar o vínculo antes da inscrição.",
      );
    }

    const resultado = await deps.inscricoes.inscrever(
      { atletaId, avaliacaoId, conviteId, status: menor ? "AGUARDANDO_RESPONSAVEL" : "CONFIRMADA" },
      agora(),
    );
    if (resultado === "SEM_VAGAS") {
      throw new AppError("VAGAS_ESGOTADAS", "Não há mais vagas nesta avaliação.");
    }
    if (resultado === "INSCRICAO_EXISTENTE") {
      throw new AppError("INSCRICAO_EXISTENTE", "Você já está inscrito nesta avaliação.");
    }

    if (menor) {
      await deps.notificacoes.criar(
        atleta.responsaveis.map((usuarioId) => ({
          usuarioId,
          tipo: "APROVAR_INSCRICAO",
          texto: `${atleta.nome} quer participar de ${resultado.avaliacao.nome}. Aprove ou recuse a inscrição.`,
          dados: { inscricaoId: resultado.id },
        })),
      );
    } else if (!conviteId) {
      // RF-47: pelo convite, o olheiro já recebe "aceitou o convite".
      await deps.notificacoes.criar([
        {
          usuarioId: resultado.avaliacao.olheiroId,
          tipo: "NOVA_INSCRICAO",
          texto: `${atleta.nome} se inscreveu em ${resultado.avaliacao.nome}.`,
          dados: { inscricaoId: resultado.id },
        },
      ]);
    }
    return resultado;
  };
}
