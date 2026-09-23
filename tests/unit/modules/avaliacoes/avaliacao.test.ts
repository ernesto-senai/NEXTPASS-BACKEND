import { describe, expect, it } from "vitest";
import { clubeVisivel } from "../../../../src/modules/avaliacoes/domain/avaliacao.ts";

describe("clubeVisivel (RN-05)", () => {
  it("mostra o clube só de olheiro verificado que atua por clube", () => {
    expect(clubeVisivel({ verificado: true, atuacao: "CLUBE", clube: "Palmeiras" })).toBe(
      "Palmeiras",
    );
    expect(clubeVisivel({ verificado: false, atuacao: "CLUBE", clube: "Palmeiras" })).toBeNull();
    expect(
      clubeVisivel({ verificado: true, atuacao: "INDEPENDENTE", clube: "Palmeiras" }),
    ).toBeNull();
  });
});
