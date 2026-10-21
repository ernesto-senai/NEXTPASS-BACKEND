import type { StatusDenuncia } from "../../../generated/prisma/enums.ts";
import type { Pagina, Paginacao } from "../../../shared/domain/pagina.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import type { RefreshTokenRepository } from "../../auth/domain/sessao.ts";
import type { DenunciaParaAnalise, DenunciaRepository, NovaDenuncia } from "../domain/denuncia.ts";

export type Denunciar = (dados: NovaDenuncia) => Promise<{ id: string; status: StatusDenuncia }>;

export type ListarDenuncias = (
  status: StatusDenuncia,
  paginacao: Paginacao,
) => Promise<Pagina<DenunciaParaAnalise>>;

export type AnalisarDenuncia = (
  adminId: string,
  id: string,
  decisao: {
    status: "EM_ANALISE" | "PROCEDENTE" | "IMPROCEDENTE";
    decisao?: string | undefined;
    suspenderConta?: boolean | undefined;
  },
) => Promise<void>;

// RF-54 (ECA Digital, art. 28): qualquer usuário denuncia perfis, lances,
// convites e avaliações, informando o motivo.
export function criarDenunciar(deps: { denuncias: DenunciaRepository }): Denunciar {
  return async (dados) => {
    const dono = await deps.denuncias.donoDoAlvo(dados.alvoTipo, dados.alvoId);
    if (!dono) throw new AppError("NAO_ENCONTRADO", "Não encontramos o que você quer denunciar.");
    if (dono === dados.autorId) {
      throw new AppError("DADOS_INVALIDOS", "Você não pode denunciar o próprio conteúdo.");
    }
    return deps.denuncias.criar(dados);
  };
}

// RF-58: fila de denúncias para a equipe do NextPass.
export function criarListarDenuncias(deps: { denuncias: DenunciaRepository }): ListarDenuncias {
  return async (status, paginacao) => ({
    ...(await deps.denuncias.listar(status, paginacao)),
    pagina: paginacao.pagina,
  });
}

// RF-58: o administrador registra a decisão e, se procedente, pode suspender
// a conta dona do conteúdo, que perde as sessões abertas.
export function criarAnalisarDenuncia(deps: {
  denuncias: DenunciaRepository;
  refreshTokens: RefreshTokenRepository;
  agora?: () => Date;
}): AnalisarDenuncia {
  const agora = deps.agora ?? (() => new Date());

  return async (adminId, id, { status, decisao, suspenderConta }) => {
    const denuncia = await deps.denuncias.buscar(id);
    if (!denuncia) throw new AppError("NAO_ENCONTRADO", "Denúncia não encontrada.");
    if (["PROCEDENTE", "IMPROCEDENTE"].includes(denuncia.status)) {
      throw new AppError("JA_ANALISADA", "Esta denúncia já foi analisada.");
    }

    await deps.denuncias.analisar(id, { status, decisao: decisao ?? null, adminId });

    if (status === "PROCEDENTE" && suspenderConta) {
      const dono = await deps.denuncias.donoDoAlvo(denuncia.alvoTipo, denuncia.alvoId);
      if (dono) {
        await deps.denuncias.suspender(dono);
        await deps.refreshTokens.revogarTodos(dono, agora());
      }
    }
  };
}
