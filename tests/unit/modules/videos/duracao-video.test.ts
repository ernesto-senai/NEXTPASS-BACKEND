import { describe, expect, it } from "vitest";
import { lerDuracaoDoVideo } from "../../../../src/modules/videos/infra/duracao-video.ts";
import { videoMp4 } from "../../../support/video-mp4.ts";

describe("lerDuracaoDoVideo", () => {
  it("lê a duração do cabeçalho, mesmo depois do vídeo", () => {
    expect(lerDuracaoDoVideo(videoMp4(45))).toBe(45);
    expect(lerDuracaoDoVideo(videoMp4(30.5))).toBe(30.5);
  });

  it("lê o cabeçalho de 64 bits (versão 1)", () => {
    expect(lerDuracaoDoVideo(videoMp4(59, { versao: 1 }))).toBe(59);
  });

  it("devolve null para arquivos que não são vídeo ou estão cortados", () => {
    expect(lerDuracaoDoVideo(Buffer.from("não sou um vídeo"))).toBeNull();
    expect(lerDuracaoDoVideo(videoMp4(45).subarray(0, 110))).toBeNull();
  });
});
