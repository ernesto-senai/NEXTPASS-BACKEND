import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Armazenamento } from "../../domain/armazenamento.ts";

// Pasta dos arquivos enviados, fora do Git. Em produção, troque por um serviço
// de armazenamento (ex.: S3) que implemente a mesma interface.
export const PASTA_UPLOADS = path.resolve("uploads");

export function criarArmazenamentoLocal(raiz = PASTA_UPLOADS): Armazenamento {
  return {
    salvar: async ({ pasta, extensao, conteudo }) => {
      const nome = `${randomUUID()}.${extensao}`;
      await mkdir(path.join(raiz, pasta), { recursive: true });
      await writeFile(path.join(raiz, pasta, nome), conteudo);
      return `/uploads/${pasta}/${nome}`;
    },

    // URLs de fora (ex.: vídeos de demonstração) não são arquivos desta pasta.
    remover: async (url) => {
      if (!url.startsWith("/uploads/")) return;
      await rm(path.join(raiz, url.replace(/^\/uploads\//, "")), { force: true });
    },
  };
}
