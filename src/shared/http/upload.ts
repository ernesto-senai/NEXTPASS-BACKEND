import type { Request, RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error.ts";

interface RegrasDoEnvio {
  tipos: readonly string[];
  tamanhoMaximoMb: number;
  // Completa as mensagens de erro: "Envie um vídeo MP4 ou MOV."
  descricao: string;
}

function criarUpload({ tipos, tamanhoMaximoMb, descricao }: RegrasDoEnvio, arquivos: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: tamanhoMaximoMb * 1024 * 1024, files: arquivos },
    fileFilter: (_req, arquivo, aceitar) => {
      if (tipos.includes(arquivo.mimetype)) aceitar(null, true);
      else aceitar(new AppError("DADOS_INVALIDOS", `Envie ${descricao}.`));
    },
  });
}

// Traduz os erros do envio para o padrão da API: 413 se passar do tamanho,
// 400 se o tipo ou o campo estiverem errados ou faltar um arquivo.
function comErrosDaApi(
  upload: RequestHandler,
  { tamanhoMaximoMb, descricao }: RegrasDoEnvio,
  faltaArquivo: (req: Request) => boolean,
): RequestHandler {
  return (req, res, next) => {
    upload(req, res, (erro: unknown) => {
      if (erro instanceof multer.MulterError) {
        next(
          erro.code === "LIMIT_FILE_SIZE"
            ? new AppError("ARQUIVO_GRANDE_DEMAIS", `O arquivo pode ter até ${tamanhoMaximoMb} MB.`)
            : new AppError("DADOS_INVALIDOS", `Envie ${descricao}.`),
        );
        return;
      }
      if (!erro && faltaArquivo(req)) {
        next(new AppError("DADOS_INVALIDOS", `Envie ${descricao}.`));
        return;
      }
      next(erro);
    });
  };
}

// Um arquivo multipart/form-data, em req.file (na memória).
export function receberArquivo({ campo, ...regras }: RegrasDoEnvio & { campo: string }) {
  return comErrosDaApi(criarUpload(regras, 1).single(campo), regras, (req) => !req.file);
}

// Vários campos de arquivo no mesmo envio (ex.: documento e comprovante). Cada
// um fica em arquivoDoCampo(req, campo); os obrigatórios que faltarem dão 400.
export function receberArquivos({
  campos,
  obrigatorios,
  ...regras
}: RegrasDoEnvio & { campos: readonly string[]; obrigatorios: readonly string[] }) {
  const upload = criarUpload(regras, campos.length).fields(
    campos.map((name) => ({ name, maxCount: 1 })),
  );
  return comErrosDaApi(upload, regras, (req) =>
    obrigatorios.some((campo) => !arquivoDoCampo(req, campo)),
  );
}

export const arquivoDoCampo = (req: Request, campo: string) =>
  (req.files as Record<string, Express.Multer.File[]> | undefined)?.[campo]?.[0];
