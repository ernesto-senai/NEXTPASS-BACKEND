import type { TipoUsuario } from "../generated/prisma/enums.ts";

declare global {
  namespace Express {
    interface Request {
      usuario?: { id: string; tipo: TipoUsuario };
    }
  }
}
