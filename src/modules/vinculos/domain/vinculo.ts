import type { StatusVinculo } from "../../../generated/prisma/enums.ts";

// RF-15: o link enviado ao responsável vale por 7 dias.
export const VALIDADE_PEDIDO_MS = 7 * 24 * 60 * 60 * 1000;

// Vínculo na visão do atleta: para quem pediu e se já foi confirmado.
export interface VinculoDoAtleta {
  id: string;
  emailResponsavel: string;
  status: StatusVinculo;
  responsavel: { nome: string } | null;
}

// RF-49: atleta vinculado, na visão do responsável.
export interface AtletaVinculado {
  vinculoId: string;
  atleta: { id: string; nome: string; fotoUrl: string | null; dataNascimento: Date | null };
}

export interface PedidoDeVinculo {
  id: string;
  atleta: { id: string; nome: string };
  emailResponsavel: string;
  status: StatusVinculo;
  expiraEm: Date | null;
}

export interface VinculoRepository {
  // Cria ou renova o pedido (novo link). Vínculo já confirmado não muda.
  salvarPedido(dados: {
    atletaId: string;
    emailResponsavel: string;
    tokenHash: string;
    expiraEm: Date;
  }): Promise<{ id: string; status: StatusVinculo }>;
  listarDoAtleta(atletaId: string): Promise<VinculoDoAtleta[]>;
  listarDoResponsavel(responsavelId: string): Promise<AtletaVinculado[]>;
  buscarPorToken(tokenHash: string): Promise<PedidoDeVinculo | null>;
  // O link é de uso único: confirmar apaga o token.
  confirmar(id: string, responsavelId: string): Promise<void>;
}
