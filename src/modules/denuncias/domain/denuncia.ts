import type { AlvoDenuncia, StatusDenuncia } from "../../../generated/prisma/enums.ts";
import type { Paginacao } from "../../../shared/domain/pagina.ts";

export interface NovaDenuncia {
  autorId: string;
  alvoTipo: AlvoDenuncia;
  alvoId: string;
  motivo: string;
}

// RF-58: denúncia na fila do administrador.
export interface DenunciaParaAnalise {
  id: string;
  alvoTipo: AlvoDenuncia;
  alvoId: string;
  motivo: string;
  status: StatusDenuncia;
  criadoEm: Date;
  autor: { id: string; nome: string };
}

export interface DenunciaRepository {
  // Usuário dono do conteúdo denunciado (o próprio perfil, o autor do lance,
  // do convite ou da avaliação); null se o alvo não existe.
  donoDoAlvo(alvoTipo: AlvoDenuncia, alvoId: string): Promise<string | null>;
  criar(dados: NovaDenuncia): Promise<{ id: string; status: StatusDenuncia }>;
  listar(
    status: StatusDenuncia,
    paginacao: Paginacao,
  ): Promise<{ dados: DenunciaParaAnalise[]; total: number }>;
  buscar(id: string): Promise<{
    id: string;
    status: StatusDenuncia;
    alvoTipo: AlvoDenuncia;
    alvoId: string;
  } | null>;
  analisar(
    id: string,
    decisao: { status: StatusDenuncia; decisao: string | null; adminId: string },
  ): Promise<void>;
  // RF-58: conta suspensa não entra e some do feed e das buscas.
  suspender(usuarioId: string): Promise<void>;
}
