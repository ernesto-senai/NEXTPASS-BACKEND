import { createHash, randomBytes } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { EmissorTokens } from "../domain/sessao.ts";

const hashSha256 = (valor: string) => createHash("sha256").update(valor).digest("hex");

// Access token: JWT curto conferido pelo middleware authenticate.
// Refresh token: valor aleatório opaco; o banco guarda só o SHA-256.
export function criarEmissorTokens(config: { segredo: string; expiraEm: string }): EmissorTokens {
  return {
    gerarAccessToken: (usuario) =>
      jwt.sign({ tipo: usuario.tipo }, config.segredo, {
        subject: usuario.id,
        expiresIn: config.expiraEm as SignOptions["expiresIn"],
      }),

    gerarRefreshToken: () => {
      const token = randomBytes(32).toString("base64url");
      return { token, hash: hashSha256(token) };
    },

    hashRefreshToken: hashSha256,
  };
}
