import type {
  AtuacaoOlheiro,
  PePreferencial,
  Posicao,
  StatusVinculo,
  TipoUsuario,
} from "../../../generated/prisma/enums.ts";
import type { Categoria } from "../../../shared/domain/idade-categoria.ts";
import type { DadosTecnicos } from "../../atletas/domain/atleta.ts";

// Perfil como está no banco: só a parte do tipo da conta vem preenchida.
export interface PerfilSalvo {
  id: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
  tipo: TipoUsuario;
  atleta:
    | (DadosTecnicos & {
        uf: string | null;
        // RF-15: situação do vínculo com o responsável (null: nenhum indicado).
        responsavel: StatusVinculo | null;
      })
    | null;
  olheiro: {
    telefone: string;
    atuacao: AtuacaoOlheiro;
    clube: string | null;
    verificado: boolean;
  } | null;
}

// RF-14 e RF-28: perfil do usuário logado. Idade e categoria são calculadas
// (RN-01) e perfilCompleto diz se o atleta já aparece na busca (RN-02).
export type Perfil = Omit<PerfilSalvo, "atleta"> & {
  atleta:
    | (NonNullable<PerfilSalvo["atleta"]> & {
        idade: number | null;
        categoria: Categoria | null;
        perfilCompleto: boolean;
      })
    | null;
};

// RF-13: dados que o atleta preenche em "Completar perfil".
export interface DadosDoAtleta {
  nome: string;
  dataNascimento: Date;
  posicoes: Posicao[];
  alturaCm: number;
  pesoKg: number;
  pePreferencial: PePreferencial;
  cidade: string;
  uf: string;
  nacionalidade: string;
}

// RF-14: formatos aceitos para a foto do perfil (tipo MIME → extensão).
export const FORMATOS_FOTO = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type FormatoFoto = keyof typeof FORMATOS_FOTO;
export const TAMANHO_MAXIMO_FOTO_MB = 5;

export interface PerfilRepository {
  buscar(usuarioId: string): Promise<PerfilSalvo | null>;
  atualizarAtleta(usuarioId: string, dados: DadosDoAtleta): Promise<void>;
  // Devolve a foto anterior, para o arquivo ser apagado.
  atualizarFoto(usuarioId: string, fotoUrl: string): Promise<string | null>;
  // RF-56: apaga a conta e tudo o que depende dela; devolve os arquivos da
  // pessoa (foto, lances, documentos), para também serem apagados.
  excluirConta(usuarioId: string): Promise<string[]>;
}
