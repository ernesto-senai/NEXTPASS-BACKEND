import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarCorreioBrevo } from "../../../../src/shared/infra/mail/correio-brevo.ts";

// Servidor no lugar da API do Brevo: guarda o último pedido e responde com o status pedido.
let servidor: Server;
let endereco: string;
let statusDaResposta = 201;
let ultimo: { cabecalhos: IncomingHttpHeaders; corpo: Record<string, unknown> } | null = null;

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const partes: Buffer[] = [];
    for await (const parte of req) partes.push(parte as Buffer);
    ultimo = { cabecalhos: req.headers, corpo: JSON.parse(Buffer.concat(partes).toString()) };
    res.writeHead(statusDaResposta, { "Content-Type": "application/json" });
    res.end(statusDaResposta < 300 ? '{"messageId":"teste"}' : '{"code":"unauthorized"}');
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  endereco = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/v3/smtp/email`;
});

afterAll(() => new Promise<void>((fim) => servidor.close(() => fim())));

const correio = () =>
  criarCorreioBrevo({
    chave: "chave-de-teste",
    remetente: "nextpass@exemplo.com",
    nomeRemetente: "NextPass",
    endereco,
  });

describe("e-mail pelo Brevo", () => {
  it("manda remetente, destinatário, assunto e o texto também em HTML", async () => {
    statusDaResposta = 201;
    await correio().enviar({
      para: "silas@exemplo.com",
      assunto: "Código para criar uma nova senha no NextPass",
      texto: "Olá, Silas!\n\n123456\n\nVale por 15 minutos <só uma vez>.",
    });

    expect(ultimo?.cabecalhos["api-key"]).toBe("chave-de-teste");
    expect(ultimo?.corpo).toMatchObject({
      sender: { name: "NextPass", email: "nextpass@exemplo.com" },
      to: [{ email: "silas@exemplo.com" }],
      subject: "Código para criar uma nova senha no NextPass",
      textContent: "Olá, Silas!\n\n123456\n\nVale por 15 minutos <só uma vez>.",
    });
    expect(ultimo?.corpo.htmlContent).toContain("letter-spacing:8px");
    expect(ultimo?.corpo.htmlContent).toContain("&lt;só uma vez&gt;");
  });

  it("avisa quando o Brevo recusa o e-mail", async () => {
    statusDaResposta = 401;

    await expect(
      correio().enviar({ para: "silas@exemplo.com", assunto: "Teste", texto: "Teste" }),
    ).rejects.toThrow("401");
  });
});
