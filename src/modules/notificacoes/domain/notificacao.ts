import type { TipoNotificacao } from "../../../generated/prisma/enums.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";

// Aviso guardado para o usuário ver na tela de Notificações (RF-47, RF-52).
// dados leva os ids para o app abrir a tela certa ao tocar no aviso.
export interface NovaNotificacao {
  usuarioId: string;
  tipo: TipoNotificacao;
  texto: string;
  dados?: Record<string, string>;
}

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  texto: string;
  dados: Record<string, string> | null;
  lida: boolean;
  criadoEm: Date;
}

export interface NotificacaoRepository {
  criar(notificacoes: NovaNotificacao[]): Promise<void>;
  // Da mais recente para a mais antiga, com o total de não lidas.
  listar(
    usuarioId: string,
    paginacao: Paginacao,
  ): Promise<{ dados: Notificacao[]; total: number; naoLidas: number }>;
  // Sem ids, marca todas ("Marcar todas como lidas"). Só mexe nas do usuário.
  marcarComoLidas(usuarioId: string, ids?: string[]): Promise<void>;
}
