import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.ts";
import type { TipoUsuario } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../errors/app-error.ts";

interface AccessTokenPayload {
  sub: string;
  tipo: TipoUsuario;
}

// Confere o Bearer JWT (RNF-07) e expõe o usuário em req.usuario.
export const authenticate: RequestHandler = (req, _res, next) => {
  const [esquema, token] = req.headers.authorization?.split(" ") ?? [];

  if (esquema !== "Bearer" || !token) {
    throw new AppError("NAO_AUTENTICADO", "Faça login para continuar.");
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.usuario = { id: payload.sub, tipo: payload.tipo };
    next();
  } catch {
    throw new AppError("TOKEN_INVALIDO", "Sessão expirada. Entre novamente.");
  }
};

// Usuário logado nas rotas protegidas por authenticate.
export function usuarioDaRequisicao(req: Request) {
  if (!req.usuario) throw new AppError("NAO_AUTENTICADO", "Faça login para continuar.");
  return req.usuario;
}
