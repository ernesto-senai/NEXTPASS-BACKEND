import type {
  StatusAvaliacao,
  StatusConvite,
  StatusInscricao,
} from "../../../generated/prisma/enums.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";
import type { AvaliacaoResumo } from "../../avaliacoes/domain/avaliacao.ts";

// RN-10: a mensagem do convite tem até 300 caracteres.
export const TAMANHO_MAXIMO_MENSAGEM = 300;

// Card da caixa de convites do atleta (RF-26).
export interface ConviteRecebido {
  id: string;
  status: StatusConvite;
  mensagem: string;
  criadoEm: Date;
  avaliacao: AvaliacaoResumo;
  // Inscrição criada pelo aceite (RN-03: a do menor aguarda o responsável).
  inscricao: { id: string; status: StatusInscricao } | null;
  // Na visão do responsável, de qual atleta vinculado é o convite (RF-49).
  atleta: { id: string; nome: string };
}

// Caixa do atleta ou, para o responsável, os convites dos atletas vinculados.
export type DestinoDosConvites = { atletaId: string } | { responsavelId: string };

// O necessário para responder um convite e avisar o olheiro.
export interface ConviteParaResposta {
  id: string;
  atleta: { id: string; nome: string };
  olheiroId: string;
  status: StatusConvite;
  avaliacao: { id: string; nome: string; dataHora: Date; status: StatusAvaliacao };
}

export interface NovoConvite {
  olheiroId: string;
  atletaId: string;
  avaliacaoId: string;
  mensagem: string;
}

export interface ConviteRepository {
  // Do mais recente para o mais antigo.
  listarRecebidos(
    destino: DestinoDosConvites,
    paginacao: Paginacao,
  ): Promise<{ dados: ConviteRecebido[]; total: number }>;
  buscar(id: string): Promise<ConviteParaResposta | null>;
  recusar(id: string, agora: Date): Promise<void>;
  avaliacaoParaConvite(avaliacaoId: string): Promise<{
    olheiroId: string;
    nome: string;
    dataHora: Date;
    status: StatusAvaliacao;
  } | null>;
  // Convite pendente ou aceito, ou inscrição ativa, na mesma avaliação.
  jaConvidado(atletaId: string, avaliacaoId: string): Promise<boolean>;
  criar(dados: NovoConvite): Promise<{ id: string; status: StatusConvite; criadoEm: Date }>;
}

// RN-12: convite sem resposta expira quando a avaliação lota, é cancelada ou
// chega a data. O banco marca o caso da lotação; os outros são vistos na hora.
export function situacaoDoConvite(
  status: StatusConvite,
  avaliacao: { status: StatusAvaliacao; dataHora: Date },
  agora: Date,
): StatusConvite {
  const encerrada = avaliacao.status !== "ABERTA" || avaliacao.dataHora <= agora;
  return status === "PENDENTE" && encerrada ? "EXPIRADO" : status;
}
