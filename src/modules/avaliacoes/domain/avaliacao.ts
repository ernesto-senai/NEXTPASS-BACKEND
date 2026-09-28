import type {
  AtuacaoOlheiro,
  Categoria,
  Posicao,
  StatusAvaliacao,
  TipoAvaliacao,
} from "../../../generated/prisma/enums.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";

// Dados do card da avaliação (RF-18). Sem o endereço completo, que só aparece
// depois da confirmação da inscrição (RN-08).
export interface AvaliacaoResumo {
  id: string;
  nome: string;
  tipo: TipoAvaliacao;
  categoria: Categoria;
  posicoes: Posicao[];
  dataHora: Date;
  local: string;
  cidade: string;
  uf: string;
  taxaCentavos: number;
  vagas: number;
  vagasOcupadas: number;
  status: StatusAvaliacao;
  clube: string | null;
  olheiro: { id: string; nome: string };
}

export interface AvaliacaoRepository {
  // Avaliações que ainda vão acontecer, abertas ou esgotadas, da mais próxima à mais distante.
  listarFuturas(
    paginacao: Paginacao,
    agora: Date,
  ): Promise<{ dados: AvaliacaoResumo[]; total: number }>;
}

// RN-05: nome do clube só aparece em avaliações de olheiro verificado que atua
// por clube (a verificação de quem atua por clube exige o comprovante, RF-16).
export function clubeVisivel(olheiro: {
  verificado: boolean;
  atuacao: AtuacaoOlheiro;
  clube: string | null;
}): string | null {
  return olheiro.verificado && olheiro.atuacao === "CLUBE" ? olheiro.clube : null;
}
