import type { PePreferencial, Posicao } from "../../../generated/prisma/enums.ts";
import { anosDaCategoria, type Categoria } from "../../../shared/domain/idade-categoria.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";

// Card do atleta na busca do olheiro (RF-37). Idade e categoria são calculadas
// pela data de nascimento (RN-01).
export interface AtletaResumo {
  id: string;
  nome: string;
  fotoUrl: string | null;
  posicoes: Posicao[];
  idade: number;
  categoria: Categoria;
  cidade: string;
  uf: string | null;
  nacionalidade: string;
  alturaCm: number;
  pesoKg: number;
  pePreferencial: PePreferencial;
}

export type AtletaPerfil = Omit<AtletaResumo, "idade" | "categoria"> & { dataNascimento: Date };

// Dados técnicos como estão no banco: opcionais até o atleta completar o perfil.
export interface DadosTecnicos {
  dataNascimento: Date | null;
  alturaCm: number | null;
  pesoKg: number | null;
  pePreferencial: PePreferencial | null;
  cidade: string | null;
  nacionalidade: string | null;
  posicoes: Posicao[];
}

// RN-02: sem os dados técnicos obrigatórios, o atleta não aparece na busca e
// não se inscreve. É o mesmo critério da consulta do repositório de atletas.
export function perfilCompleto(atleta: DadosTecnicos): boolean {
  const { dataNascimento, alturaCm, pesoKg, pePreferencial, cidade, nacionalidade } = atleta;
  const obrigatorios = [dataNascimento, alturaCm, pesoKg, pePreferencial, cidade, nacionalidade];
  return atleta.posicoes.length > 0 && obrigatorios.every((valor) => valor !== null);
}

export type OrdemAtletas = "nome" | "maisNovos" | "maisAltos";

// RF-35 e RF-36: busca pelo nome e filtros. Campo vazio não filtra.
export interface FiltroAtletas {
  busca?: string | undefined;
  categoria?: Categoria | undefined;
  idadeMin?: number | undefined;
  idadeMax?: number | undefined;
  cidade?: string | undefined;
  nacionalidade?: string | undefined;
  pePreferencial?: PePreferencial | undefined;
  pesoMin?: number | undefined;
  pesoMax?: number | undefined;
  alturaMin?: number | undefined;
  alturaMax?: number | undefined;
  posicoes?: Posicao[] | undefined;
  ordem: OrdemAtletas;
}

// No banco, categoria e idade viram um intervalo de datas de nascimento.
export type ConsultaAtletas = FiltroAtletas & { nascidoDe?: Date; nascidoAte?: Date };

export interface AtletaRepository {
  // Só perfis completos (RN-02) de contas ativas.
  buscar(
    consulta: ConsultaAtletas,
    paginacao: Paginacao,
  ): Promise<{ dados: AtletaPerfil[]; total: number }>;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const anosAtras = (hoje: Date, anos: number) =>
  Date.UTC(hoje.getUTCFullYear() - anos, hoje.getUTCMonth(), hoje.getUTCDate());

// Converte categoria e faixa de idade num único intervalo de nascimento.
export function intervaloDeNascimento(
  { categoria, idadeMin, idadeMax }: FiltroAtletas,
  hoje: Date,
): { nascidoDe?: Date; nascidoAte?: Date } {
  const inicios: number[] = [];
  const fins: number[] = [];

  if (categoria) {
    const anos = anosDaCategoria(categoria, hoje.getUTCFullYear());
    inicios.push(Date.UTC(anos.de, 0, 1));
    fins.push(Date.UTC(anos.ate, 11, 31));
  }
  // Tem pelo menos idadeMin anos: nasceu até essa data.
  if (idadeMin !== undefined) fins.push(anosAtras(hoje, idadeMin));
  // Tem no máximo idadeMax anos: ainda não completou idadeMax + 1.
  if (idadeMax !== undefined) inicios.push(anosAtras(hoje, idadeMax + 1) + DIA_MS);

  return {
    ...(inicios.length ? { nascidoDe: new Date(Math.max(...inicios)) } : {}),
    ...(fins.length ? { nascidoAte: new Date(Math.min(...fins)) } : {}),
  };
}
