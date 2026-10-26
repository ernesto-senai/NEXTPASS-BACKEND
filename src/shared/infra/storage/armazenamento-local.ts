import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Armazenamento } from "../../domain/armazenamento.ts";

// Pasta dos arquivos enviados, fora do Git. Em produção, troque por um serviço
// de armazenamento (ex.: S3) que implemente a mesma interface.
export const PASTA_UPLOADS = path.resolve("uploads");

export function criarArmazenamentoLocal(raiz = PASTA_UPLOADS): Armazenamento {
  // Caminho no disco de uma URL /uploads/...; null se ela sair da pasta.
  const caminho = (url: string) => {
    if (!url.startsWith("/uploads/")) return null;
    const arquivo = path.resolve(raiz, url.replace(/^\/uploads\//, ""));
    return arquivo.startsWith(path.resolve(raiz) + path.sep) ? arquivo : null;
  };

  return {
    salvar: async ({ pasta, extensao, conteudo }) => {
      const nome = `${randomUUID()}.${extensao}`;
      await mkdir(path.join(raiz, pasta), { recursive: true });
      await writeFile(path.join(raiz, pasta, nome), conteudo);
      return `/uploads/${pasta}/${nome}`;
    },

    // URLs de fora (ex.: vídeos de demonstração) não são arquivos desta pasta.
    remover: async (url) => {
      const arquivo = caminho(url);
      if (arquivo) await rm(arquivo, { force: true });
    },

    ler: async (url) => {
      const arquivo = caminho(url);
      return arquivo ? readFile(arquivo).catch(() => null) : null;
    },
  };
}
