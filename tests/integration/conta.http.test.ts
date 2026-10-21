import { beforeEach, describe, expect, it } from "vitest";
import { type Conta, criarCenario } from "../support/cenario.ts";
import { videoMp4 } from "../support/video-mp4.ts";

let cenario: ReturnType<typeof criarCenario>;
let atleta: Conta;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(async () => {
  cenario = criarCenario();
  atleta = await cenario.atleta("Silas Rodrigues", "silas@exemplo.com");
});

const enviarFoto = (tipo = "image/png") =>
  cenario
    .como(atleta)
    .post("/perfil/foto")
    .attach("foto", PNG, { filename: "foto.png", contentType: tipo });

describe("POST /perfil/foto (RF-14)", () => {
  it("troca a foto e apaga o arquivo da anterior", async () => {
    const primeira = await enviarFoto();
    expect(primeira.status).toBe(200);
    expect(primeira.body.fotoUrl).toMatch(/^\/uploads\/fotos\/.+\.png$/);

    const segunda = await enviarFoto();
    expect(cenario.memoria.arquivos.has(primeira.body.fotoUrl)).toBe(false);
    expect((await cenario.como(atleta).get("/perfil")).body.fotoUrl).toBe(segunda.body.fotoUrl);
  });

  it("aceita só imagens", async () => {
    expect((await enviarFoto("application/pdf")).status).toBe(400);
  });
});

describe("DELETE /perfil (RF-56)", () => {
  it("exige a senha, apaga a conta e os arquivos (LGPD)", async () => {
    await enviarFoto();
    await cenario
      .como(atleta)
      .post("/videos")
      .attach("video", videoMp4(45), { filename: "lance.mp4", contentType: "video/mp4" });
    expect(cenario.memoria.arquivos.size).toBe(2);

    const senhaErrada = await cenario.como(atleta).delete("/perfil", { senha: "outra-senha" });
    expect(senhaErrada.status).toBe(401);

    const exclusao = await cenario.como(atleta).delete("/perfil", { senha: "senha-segura" });
    expect(exclusao.status).toBe(204);
    expect(cenario.memoria.arquivos.size).toBe(0);
    expect((await cenario.entrar("silas@exemplo.com")).status).toBe(401);
  });
});
