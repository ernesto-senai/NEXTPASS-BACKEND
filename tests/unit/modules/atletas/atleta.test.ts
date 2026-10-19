import { describe, expect, it } from "vitest";
import { intervaloDeNascimento } from "../../../../src/modules/atletas/domain/atleta.ts";

const hoje = new Date("2026-10-14T12:00:00Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("intervaloDeNascimento", () => {
  it("converte a categoria nos anos de nascimento (Sub-17 em 2026 = 2009 e 2010)", () => {
    expect(intervaloDeNascimento({ categoria: "SUB_17", ordem: "nome" }, hoje)).toEqual({
      nascidoDe: dia("2009-01-01"),
      nascidoAte: dia("2010-12-31"),
    });
  });

  it("idade máxima 17 exclui quem completa 18 hoje", () => {
    const { nascidoDe } = intervaloDeNascimento({ idadeMax: 17, ordem: "nome" }, hoje);

    expect(nascidoDe).toEqual(dia("2008-10-15"));
  });

  it("combina categoria e idade no intervalo mais restrito", () => {
    expect(
      intervaloDeNascimento({ categoria: "SUB_17", idadeMin: 17, ordem: "nome" }, hoje),
    ).toEqual({ nascidoDe: dia("2009-01-01"), nascidoAte: dia("2009-10-14") });
  });
});
