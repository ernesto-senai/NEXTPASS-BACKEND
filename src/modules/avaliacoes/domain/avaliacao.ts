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

// RF-41: dados de "Criar avaliação", com o endereço completo.
export type NovaAvaliacao = Pick<
  AvaliacaoResumo,
  | "nome"
  | "tipo"
  | "categoria"
  | "posicoes"
  | "dataHora"
  | "local"
  | "cidade"
  | "uf"
  | "taxaCentavos"
  | "vagas"
> & { requisitos: string; endereco: string };

export type OrdemAvaliacoes = "proximas" | "recentes" | "menorPreco";

// RF-23 e RF-24: busca e filtros da tela de Pesquisa. Campo vazio não filtra.
export interface FiltroAvaliacoes {
  busca?: string | undefined;
  categoria?: Categoria | undefined;
  tipo?: TipoAvaliacao | undefined;
  cidade?: string | undefined;
  posicoes?: Posicao[] | undefined;
  precoMaxCentavos?: number | undefined;
  // Só as que acontecem nos próximos N dias.
  dias?: number | undefined;
  somenteComVagas?: boolean | undefined;
  ordem: OrdemAvaliacoes;
}

// RF-42: "Próximas" (abertas ou esgotadas, a mais próxima primeiro) e
// "Anteriores" (já aconteceram ou foram canceladas, a mais recente primeiro).
export type SituacaoAvaliacao = "proximas" | "anteriores";

export interface AvaliacaoRepository {
  criar(olheiroId: string, dados: NovaAvaliacao): Promise<AvaliacaoResumo>;
  // Avaliações que ainda vão acontecer, abertas ou esgotadas.
  listarFuturas(
    filtro: FiltroAvaliacoes,
    paginacao: Paginacao,
    agora: Date,
  ): Promise<{ dados: AvaliacaoResumo[]; total: number }>;
  listarDoOlheiro(
    olheiroId: string,
    situacao: SituacaoAvaliacao,
    paginacao: Paginacao,
    agora: Date,
  ): Promise<{ dados: AvaliacaoResumo[]; total: number }>;
  buscarParaDono(id: string): Promise<{
    olheiroId: string;
    nome: string;
    status: StatusAvaliacao;
    dataHora: Date;
  } | null>;
  // RF-43: cancela, cancela as inscrições ativas e expira os convites pendentes.
  // Devolve os atletas que estavam inscritos, para serem avisados.
  cancelar(id: string): Promise<string[]>;
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
