import { describe, expect, it } from "vitest";
import { combinaComBusca, normalizar } from "../../../../src/shared/domain/busca.ts";

describe("busca (RNF-16)", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(normalizar("  São PAULO ")).toBe("sao paulo");
    expect(combinaComBusca("São Paulo", "sao paulo")).toBe(true);
    expect(combinaComBusca("João Victor", "JOAO")).toBe(true);
    expect(combinaComBusca("Sao Paulo", "são")).toBe(true);
  });

  it("acha pedaços do texto", () => {
    expect(combinaComBusca("Peneira Palmeiras Sub-17", "palm")).toBe(true);
    expect(combinaComBusca("Leandro Sousa", "sou")).toBe(true);
  });

  it("tolera pequenos erros de digitação a partir de 4 letras", () => {
    expect(combinaComBusca("Leandro Sousa", "leandor")).toBe(true);
    expect(combinaComBusca("Leandro Sousa", "lendro")).toBe(true);
    expect(combinaComBusca("Leandro Sousa", "souza")).toBe(true);
    expect(combinaComBusca("Silas Rodrigues", "rodriges")).toBe(true);
    expect(combinaComBusca("Peneira Palmeiras Sub-17", "palmeras")).toBe(true);
    expect(combinaComBusca("Peneira Palmeiras Sub-17", "sub 17")).toBe(true);
  });

  it("não inventa resultado", () => {
    expect(combinaComBusca("Leandro Sousa", "silas")).toBe(false);
    expect(combinaComBusca("Leandro Sousa", "xyz")).toBe(false);
    // Com menos de 4 letras não há tolerância: "lea" acha, "lex" não.
    expect(combinaComBusca("Leandro Sousa", "lea")).toBe(true);
    expect(combinaComBusca("Leandro Sousa", "lex")).toBe(false);
  });
});
