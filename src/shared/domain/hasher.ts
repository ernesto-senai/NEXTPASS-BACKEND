// Contrato para gerar e conferir hashes de senha (implementado com bcrypt).
export interface Hasher {
  gerar(valor: string): Promise<string>;
  comparar(valor: string, hash: string): Promise<boolean>;
}
