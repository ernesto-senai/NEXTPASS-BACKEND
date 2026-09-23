import type { RequestHandler } from "express";
import type { TipoUsuario } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../errors/app-error.ts";
import { prisma } from "../../infra/database/prisma.ts";

// Libera a rota só para os perfis informados. Use depois de authenticate.
export function authorize(...tipos: TipoUsuario[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario || !tipos.includes(req.usuario.tipo)) {
      throw new AppError("ACESSO_NEGADO", "Seu perfil não tem acesso a este recurso.");
    }
    next();
  };
}

// RN-04: olheiro só busca atletas, cria avaliações e envia convites depois de
// verificado. Consulta o banco a cada chamada para a aprovação valer na hora.
export const requireOlheiroVerificado: RequestHandler = async (req, _res, next) => {
  if (req.usuario?.tipo !== "OLHEIRO") {
    throw new AppError("ACESSO_NEGADO", "Recurso exclusivo para olheiros.");
  }

  const olheiro = await prisma.olheiro.findUnique({
    where: { usuarioId: req.usuario.id },
    select: { verificado: true },
  });

  if (!olheiro?.verificado) {
    throw new AppError("OLHEIRO_NAO_VERIFICADO", "Aguarde a aprovação da sua verificação.");
  }
  next();
};
