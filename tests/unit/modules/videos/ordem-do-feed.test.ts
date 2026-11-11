import { describe, expect, it } from "vitest";
import { ordenarFeed } from "../../../../src/modules/videos/domain/ordem-do-feed.ts";

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const candidatos = (vistos: string[] = []) => IDS.map((id) => ({ id, visto: vistos.includes(id) }));

describe("ordem do feed (RF-32)", () => {
  it("mostra primeiro os lances que o olheiro ainda não viu", () => {
    const ordem = ordenarFeed(candidatos(["a", "b", "c"]), 42);

    expect(ordem.slice(0, 5).sort()).toEqual(["d", "e", "f", "g", "h"]);
    expect(ordem.slice(5).sort()).toEqual(["a", "b", "c"]);
  });

  it("dá a mesma ordem com a mesma semente, chegue a lista como chegar", () => {
    expect(ordenarFeed(candidatos().reverse(), 7)).toEqual(ordenarFeed(candidatos(), 7));
  });

  it("embaralha de outro jeito com outra semente, sem perder nem repetir lances", () => {
    const primeira = ordenarFeed(candidatos(), 1);
    const segunda = ordenarFeed(candidatos(), 2);

    expect(primeira).not.toEqual(segunda);
    expect([...segunda].sort()).toEqual(IDS);
  });
});
