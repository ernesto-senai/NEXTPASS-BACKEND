import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";
import { AppError } from "../../errors/app-error.ts";

// Todas as respostas de erro seguem { erro: { codigo, mensagem } }.
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ erro: { codigo: "NAO_ENCONTRADO", mensagem: "Rota não encontrada." } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ erro: { codigo: err.codigo, mensagem: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      erro: {
        codigo: "DADOS_INVALIDOS",
        mensagem: "Confira os dados enviados.",
        campos: z.flattenError(err).fieldErrors,
      },
    });
    return;
  }

  req.log.error(err);
  res.status(500).json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado." } });
};
