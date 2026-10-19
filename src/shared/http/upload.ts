import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error.ts";

interface RegrasDoArquivo {
  campo: string;
  tipos: readonly string[];
  tamanhoMaximoMb: number;
  // Completa as mensagens de erro: "Envie um vídeo MP4 ou MOV."
  descricao: string;
}

// Recebe um arquivo multipart/form-data em req.file (na memória) e traduz os
// erros do envio para o padrão da API: 413 se passar do tamanho, 400 se o
// tipo ou o campo estiverem errados.
export function receberArquivo({
  campo,
  tipos,
  tamanhoMaximoMb,
  descricao,
}: RegrasDoArquivo): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: tamanhoMaximoMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, arquivo, aceitar) => {
      if (tipos.includes(arquivo.mimetype)) aceitar(null, true);
      else aceitar(new AppError("DADOS_INVALIDOS", `Envie ${descricao}.`));
    },
  }).single(campo);

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
      if (!erro && !req.file) {
        next(new AppError("DADOS_INVALIDOS", `Envie ${descricao}.`));
        return;
      }
      next(erro);
    });
  };
}
