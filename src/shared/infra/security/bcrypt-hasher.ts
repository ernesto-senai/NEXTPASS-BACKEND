import bcrypt from "bcryptjs";
import type { Hasher } from "../../domain/hasher.ts";

// RNF-06: senhas guardadas só como hash bcrypt, nunca em texto puro.
export function criarBcryptHasher(custo = 10): Hasher {
  return {
    gerar: (valor) => bcrypt.hash(valor, custo),
    comparar: (valor, hash) => bcrypt.compare(valor, hash),
  };
}
