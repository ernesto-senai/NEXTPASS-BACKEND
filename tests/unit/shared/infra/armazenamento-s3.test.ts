import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarArmazenamentoS3 } from "../../../../src/shared/infra/storage/armazenamento-s3.ts";

// Serviço S3 mínimo, em memória, para o teste usar o SDK de verdade sem internet:
// guarda, devolve e apaga objetos em /bucket/chave.
const objetos = new Map<string, { corpo: Buffer; tipo: string | undefined }>();
let servidor: Server;
let endpoint: string;

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const caminho = decodeURIComponent(new URL(req.url ?? "/", "http://s3").pathname);
    if (req.method === "PUT") {
      const partes: Buffer[] = [];
      for await (const parte of req) partes.push(parte as Buffer);
      objetos.set(caminho, { corpo: Buffer.concat(partes), tipo: req.headers["content-type"] });
      res.writeHead(200, { ETag: '"ok"' }).end();
      return;
    }
    if (req.method === "DELETE") {
      objetos.delete(caminho);
      res.writeHead(204).end();
      return;
    }
    const objeto = objetos.get(caminho);
    if (!objeto) {
      res
        .writeHead(404, { "Content-Type": "application/xml" })
        .end("<Error><Code>NoSuchKey</Code><Message>Não existe.</Message></Error>");
      return;
    }
    res
      .writeHead(200, { "Content-Type": objeto.tipo ?? "application/octet-stream" })
      .end(objeto.corpo);
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  endpoint = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((fim) => servidor.close(() => fim())));

const URL_PUBLICA = "https://arquivos.exemplo.com/nextpass-publico";
const armazenamento = () =>
  criarArmazenamentoS3({
    endpoint,
    regiao: "us-east-1",
    chaveId: "teste",
    chaveSecreta: "teste",
    bucketPublico: "nextpass-publico",
    bucketPrivado: "nextpass-privado",
    urlPublica: `${URL_PUBLICA}/`,
  });

describe("armazenamento S3 (Supabase Storage, R2)", () => {
  it("guarda o lance no bucket público e devolve o endereço público", async () => {
    const s3 = armazenamento();
    const url = await s3.salvar({
      pasta: "videos",
      extensao: "mp4",
      tipo: "video/mp4",
      conteudo: Buffer.from("video"),
    });
    const chave = url.replace(`${URL_PUBLICA}/`, "");

    expect(url).toMatch(/^https:\/\/arquivos\.exemplo\.com\/nextpass-publico\/videos\/.+\.mp4$/);
    expect(objetos.get(`/nextpass-publico/${chave}`)).toEqual({
      corpo: Buffer.from("video"),
      tipo: "video/mp4",
    });
    expect((await s3.ler(url))?.toString()).toBe("video");

    await s3.remover(url);
    expect(objetos.has(`/nextpass-publico/${chave}`)).toBe(false);
    expect(await s3.ler(url)).toBeNull();
  });

  it("guarda o documento no bucket privado, sem endereço público (RNF-09)", async () => {
    const s3 = armazenamento();
    const url = await s3.salvar({
      pasta: "documentos",
      extensao: "pdf",
      tipo: "application/pdf",
      conteudo: Buffer.from("%PDF"),
    });

    expect(url).toMatch(/^privado:documentos\/.+\.pdf$/);
    expect(objetos.has(`/nextpass-privado/${url.slice("privado:".length)}`)).toBe(true);
    expect((await s3.ler(url))?.toString()).toBe("%PDF");
  });

  it("ignora arquivos que não são deste armazenamento", async () => {
    const s3 = armazenamento();

    expect(await s3.ler("/uploads/videos/antigo.mp4")).toBeNull();
    expect(await s3.ler("https://outro.site/video.mp4")).toBeNull();
    await expect(s3.remover("/uploads/videos/antigo.mp4")).resolves.toBeUndefined();
  });
});
