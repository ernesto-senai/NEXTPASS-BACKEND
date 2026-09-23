import { describe, expect, it } from "vitest";
import {
  calcularCategoria,
  calcularIdade,
  ehMenorDeIdade,
} from "../../../../src/shared/domain/idade-categoria.ts";

const data = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("calcularIdade (RN-01)", () => {
  it("desconta um ano antes do aniversário", () => {
    expect(calcularIdade(data("2009-10-10"), data("2026-10-09"))).toBe(16);
    expect(calcularIdade(data("2009-10-10"), data("2026-10-10"))).toBe(17);
  });
});

describe("calcularCategoria (RN-01)", () => {
  it("em 2026, a Sub-17 reúne nascidos em 2009 e 2010", () => {
    expect(calcularCategoria(data("2009-01-01"), 2026)).toBe("SUB_17");
    expect(calcularCategoria(data("2010-12-31"), 2026)).toBe("SUB_17");
    expect(calcularCategoria(data("2011-01-01"), 2026)).toBe("SUB_15");
    expect(calcularCategoria(data("2008-12-31"), 2026)).toBe("SUB_20");
  });
});

describe("ehMenorDeIdade (RN-03)", () => {
  it("considera menor quem ainda não fez 18 anos", () => {
    expect(ehMenorDeIdade(data("2008-10-10"), data("2026-10-09"))).toBe(true);
    expect(ehMenorDeIdade(data("2008-10-10"), data("2026-10-10"))).toBe(false);
  });
});
