import { describe, expect, it } from "vitest";
import { videoEhHorizontal } from "../../../../src/modules/videos/infra/orientacao-video.ts";
import { videoMp4 } from "../../../support/video-mp4.ts";

const video = (largura: number, altura: number, girado = false) =>
  videoMp4(45, { imagem: { largura, altura, girado } });

describe("videoEhHorizontal", () => {
  it("vídeo deitado ou quadrado é horizontal; em pé, não", () => {
    expect(videoEhHorizontal(video(1024, 576))).toBe(true);
    expect(videoEhHorizontal(video(720, 720))).toBe(true);
    expect(videoEhHorizontal(video(720, 1280))).toBe(false);
  });

  it("considera a rotação gravada pelo celular", () => {
    expect(videoEhHorizontal(video(1920, 1080, true))).toBe(false);
    expect(videoEhHorizontal(video(1080, 1920, true))).toBe(true);
  });

  it("lê o cabeçalho de 64 bits (versão 1)", () => {
    const imagem = { largura: 1920, altura: 1080 };
    expect(videoEhHorizontal(videoMp4(45, { versao: 1, imagem }))).toBe(true);
  });

  it("sem os dados de imagem, fica como em pé", () => {
    expect(videoEhHorizontal(Buffer.from("não sou um vídeo"))).toBe(false);
    expect(videoEhHorizontal(videoMp4(45))).toBe(false);
    const cortado = video(1920, 1080);
    expect(videoEhHorizontal(cortado.subarray(0, cortado.length - 10))).toBe(false);
  });
});
