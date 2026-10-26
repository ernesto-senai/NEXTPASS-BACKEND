import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarArmazenamentoLocal } from "../../../../src/shared/infra/storage/armazenamento-local.ts";

let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "nextpass-uploads-"));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe("armazenamento local", () => {
  it("guarda, lê e remove um arquivo", async () => {
    const armazenamento = criarArmazenamentoLocal(raiz);
    const url = await armazenamento.salvar({
      pasta: "documentos",
      extensao: "pdf",
      conteudo: Buffer.from("%PDF teste"),
    });

    expect(url).toMatch(/^\/uploads\/documentos\/.+\.pdf$/);
    expect((await armazenamento.ler(url))?.toString()).toBe("%PDF teste");

    await armazenamento.remover(url);
    expect(await armazenamento.ler(url)).toBeNull();
  });

  it("não lê nada fora da pasta de uploads", async () => {
    const armazenamento = criarArmazenamentoLocal(path.join(raiz, "uploads"));
    await writeFile(path.join(raiz, "segredo.txt"), "não pode sair");

    expect(await armazenamento.ler("/uploads/../segredo.txt")).toBeNull();
    expect(await armazenamento.ler("https://exemplo.com/video.mp4")).toBeNull();
  });
});
