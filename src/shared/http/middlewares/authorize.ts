import type { RequestHandler } from "express";
import type { TipoUsuario } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../errors/app-error.ts";

// Libera a rota só para os perfis informados. Use depois de authenticate.
export function authorize(...tipos: TipoUsuario[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario || !tipos.includes(req.usuario.tipo)) {
      throw new AppError("ACESSO_NEGADO", "Seu perfil não tem acesso a este recurso.");
    }
    next();
  };
}

// RN-04: só olheiro verificado assiste lances, busca atletas, cria avaliações e convida.
// Consulta o banco em toda chamada para a aprovação valer na hora.
export function exigirOlheiroVerificado(
  estaVerificado: (usuarioId: string) => Promise<boolean>,
): RequestHandler {
  return async (req, _res, next) => {
    if (req.usuario?.tipo !== "OLHEIRO") {
      throw new AppError("ACESSO_NEGADO", "Recurso exclusivo para olheiros.");
    }
    if (!(await estaVerificado(req.usuario.id))) {
      throw new AppError("OLHEIRO_NAO_VERIFICADO", "Aguarde a aprovação da sua verificação.");
    }
    next();
  };
}
