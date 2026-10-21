import type { StatusVerificacao } from "../../../generated/prisma/enums.ts";
import type { Armazenamento } from "../../../shared/domain/armazenamento.ts";
import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { NotificacaoRepository } from "../../notificacoes/domain/notificacao.ts";
import {
  FORMATOS_DOCUMENTO,
  type FormatoDocumento,
  type SituacaoVerificacao,
  type VerificacaoParaAnalise,
  type VerificacaoRepository,
} from "../domain/verificacao.ts";

interface ArquivoEnviado {
  conteudo: Buffer;
  formato: FormatoDocumento;
}

export type EnviarDocumentos = (
  olheiroId: string,
  arquivos: { documento: ArquivoEnviado; comprovante?: ArquivoEnviado | undefined },
) => Promise<SituacaoVerificacao>;

export type ListarVerificacoes = (
  status: StatusVerificacao,
  paginacao: Paginacao,
) => Promise<Pagina<VerificacaoParaAnalise>>;

export type AnalisarVerificacao = (
  adminId: string,
  id: string,
  decisao: { status: "APROVADA" | "RECUSADA"; motivoRecusa?: string | undefined },
) => Promise<void>;

// RF-16: o olheiro envia o documento de identidade e, se atua por clube, o
// comprovante do vínculo (RN-05). Os arquivos vão para uma pasta privada, fora
// do alcance do app (RNF-09). Depois de recusado, pode enviar de novo.
export function criarEnviarDocumentos(deps: {
  verificacoes: VerificacaoRepository;
  armazenamento: Armazenamento;
}): EnviarDocumentos {
  const guardar = ({ conteudo, formato }: ArquivoEnviado) =>
    deps.armazenamento.salvar({
      pasta: "documentos",
      extensao: FORMATOS_DOCUMENTO[formato],
      conteudo,
    });

  return async (olheiroId, { documento, comprovante }) => {
    const situacao = await deps.verificacoes.situacao(olheiroId);
    if (situacao.verificado) {
      throw new AppError("CONTA_JA_VERIFICADA", "Sua conta já está verificada.");
    }
    if (situacao.status === "PENDENTE") {
      throw new AppError("VERIFICACAO_EM_ANALISE", "Seus documentos já estão em análise.");
    }
    if (!comprovante && (await deps.verificacoes.atuacaoDoOlheiro(olheiroId)) === "CLUBE") {
      throw new AppError(
        "DADOS_INVALIDOS",
        "Quem atua por clube precisa enviar o comprovante de vínculo.",
      );
    }

    await deps.verificacoes.criar({
      olheiroId,
      documentoUrl: await guardar(documento),
      comprovanteUrl: comprovante ? await guardar(comprovante) : null,
    });
    return deps.verificacoes.situacao(olheiroId);
  };
}

// RF-57: fila de verificações para a equipe do NextPass.
export function criarListarVerificacoes(deps: {
  verificacoes: VerificacaoRepository;
}): ListarVerificacoes {
  return async (status, paginacao) => ({
    ...(await deps.verificacoes.listarParaAnalise(status, paginacao)),
    pagina: paginacao.pagina,
  });
}

// RF-57: o administrador aprova ou recusa (com o motivo) e o olheiro é avisado.
export function criarAnalisarVerificacao(deps: {
  verificacoes: VerificacaoRepository;
  notificacoes: NotificacaoRepository;
  agora?: () => Date;
}): AnalisarVerificacao {
  const agora = deps.agora ?? (() => new Date());

  return async (adminId, id, { status, motivoRecusa }) => {
    const verificacao = await deps.verificacoes.buscar(id);
    if (!verificacao) throw new AppError("NAO_ENCONTRADO", "Verificação não encontrada.");
    if (verificacao.status !== "PENDENTE") {
      throw new AppError("JA_ANALISADA", "Esta verificação já foi analisada.");
    }

    await deps.verificacoes.analisar(id, {
      status,
      motivoRecusa: status === "RECUSADA" ? (motivoRecusa ?? null) : null,
      adminId,
      agora: agora(),
    });
    await deps.notificacoes.criar([
      {
        usuarioId: verificacao.olheiroId,
        tipo: "VERIFICACAO_ANALISADA",
        texto:
          status === "APROVADA"
            ? "Sua verificação foi aprovada! Agora você pode buscar atletas, criar avaliações e enviar convites."
            : `Sua verificação foi recusada: ${motivoRecusa}. Envie os documentos de novo.`,
      },
    ]);
  };
}
