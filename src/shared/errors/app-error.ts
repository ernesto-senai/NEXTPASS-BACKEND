// Códigos fixos que o app usa para tratar cada caso (Endpoints v2.0, seção 3).
export const codigosErro = {
  DADOS_INVALIDOS: 400,
  NAO_AUTENTICADO: 401,
  TOKEN_INVALIDO: 401,
  ACESSO_NEGADO: 403,
  OLHEIRO_NAO_VERIFICADO: 403,
  CONTA_SUSPENSA: 403,
  NAO_ENCONTRADO: 404,
  EMAIL_JA_CADASTRADO: 409,
  VAGAS_ESGOTADAS: 409,
  INSCRICAO_EXISTENTE: 409,
  ARQUIVO_GRANDE_DEMAIS: 413,
  PERFIL_INCOMPLETO: 422,
  DURACAO_VIDEO_INVALIDA: 422,
  VINCULO_PENDENTE: 422,
  MUITAS_TENTATIVAS: 429,
  ERRO_INTERNO: 500,
} as const;

export type CodigoErro = keyof typeof codigosErro;

export class AppError extends Error {
  readonly codigo: CodigoErro;
  readonly status: number;

  constructor(codigo: CodigoErro, mensagem: string) {
    super(mensagem);
    this.name = "AppError";
    this.codigo = codigo;
    this.status = codigosErro[codigo];
  }
}
