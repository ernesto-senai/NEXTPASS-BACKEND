import { beforeEach, describe, expect, it } from "vitest";
import { type Conta, criarCenario } from "../support/cenario.ts";

let cenario: ReturnType<typeof criarCenario>;
let olheiro: Conta;

const PDF = Buffer.from("%PDF-1.4 documento de teste");

beforeEach(async () => {
  cenario = criarCenario();
  olheiro = await cenario.olheiro("Fabrizio Romano", "fabrizio@exemplo.com");
});

const enviar = (conta: Conta, arquivos: Record<string, { conteudo: Buffer; tipo: string }>) => {
  const envio = cenario.como(conta).post("/perfil/verificacao");
  for (const [campo, { conteudo, tipo }] of Object.entries(arquivos)) {
    envio.attach(campo, conteudo, { filename: `${campo}.pdf`, contentType: tipo });
  }
  return envio;
};

describe("POST /perfil/verificacao (RF-16)", () => {
  it("recebe o documento, guarda em pasta privada e fica em análise", async () => {
    const resposta = await enviar(olheiro, {
      documento: { conteudo: PDF, tipo: "application/pdf" },
    });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ verificado: false, status: "PENDENTE", motivoRecusa: null });
    expect([...cenario.memoria.arquivos.keys()][0]).toMatch(/^\/uploads\/documentos\/.+\.pdf$/);

    const denovo = await enviar(olheiro, { documento: { conteudo: PDF, tipo: "application/pdf" } });
    expect(denovo.body.erro.codigo).toBe("VERIFICACAO_EM_ANALISE");
  });

  it("exige o comprovante de quem atua por clube e recusa outros formatos", async () => {
    const doClube = await cenario.olheiro("Carla Mendes", "carla@exemplo.com", {
      atuacao: "CLUBE",
      clube: "São Paulo",
    });

    const semComprovante = await enviar(doClube, {
      documento: { conteudo: PDF, tipo: "application/pdf" },
    });
    expect(semComprovante.status).toBe(400);

    const texto = await enviar(olheiro, {
      documento: { conteudo: Buffer.from("oi"), tipo: "text/plain" },
    });
    expect(texto.status).toBe(400);

    const completo = await enviar(doClube, {
      documento: { conteudo: PDF, tipo: "application/pdf" },
      comprovante: { conteudo: PDF, tipo: "application/pdf" },
    });
    expect(completo.status).toBe(201);
  });
});

describe("Análise da verificação pelo administrador (RF-57)", () => {
  it("aprova: o olheiro é avisado e passa a buscar atletas (RN-04)", async () => {
    const admin = await cenario.admin();
    await enviar(olheiro, { documento: { conteudo: PDF, tipo: "application/pdf" } });
    expect((await cenario.como(olheiro).get("/atletas")).status).toBe(403);

    const fila = await cenario.como(admin).get("/admin/verificacoes");
    expect(fila.body.dados).toMatchObject([
      { status: "PENDENTE", olheiro: { nome: "Fabrizio Romano", atuacao: "INDEPENDENTE" } },
    ]);

    const id = fila.body.dados[0].id as string;
    expect(
      (await cenario.como(admin).patch(`/admin/verificacoes/${id}`, { status: "APROVADA" })).status,
    ).toBe(204);

    expect((await cenario.como(olheiro).get("/atletas")).status).toBe(200);
    expect(cenario.avisos(olheiro.id)).toEqual(["VERIFICACAO_ANALISADA"]);
    const situacao = await cenario.como(olheiro).get("/perfil/verificacao");
    expect(situacao.body).toMatchObject({ verificado: true, status: "APROVADA" });
  });

  it("recusa com motivo; o olheiro pode enviar de novo", async () => {
    const admin = await cenario.admin();
    await enviar(olheiro, { documento: { conteudo: PDF, tipo: "application/pdf" } });
    const id = (await cenario.como(admin).get("/admin/verificacoes")).body.dados[0].id;

    const semMotivo = await cenario
      .como(admin)
      .patch(`/admin/verificacoes/${id}`, { status: "RECUSADA" });
    expect(semMotivo.status).toBe(400);

    await cenario.como(admin).patch(`/admin/verificacoes/${id}`, {
      status: "RECUSADA",
      motivoRecusa: "Documento ilegível",
    });
    const situacao = await cenario.como(olheiro).get("/perfil/verificacao");
    expect(situacao.body).toEqual({
      verificado: false,
      status: "RECUSADA",
      motivoRecusa: "Documento ilegível",
    });
    expect(cenario.memoria.notificacoes[0]?.texto).toContain("Documento ilegível");

    const reenvio = await enviar(olheiro, {
      documento: { conteudo: PDF, tipo: "application/pdf" },
    });
    expect(reenvio.status).toBe(201);
  });

  it("abre o documento e o comprovante pelo link da fila (RNF-09)", async () => {
    const admin = await cenario.admin();
    const doClube = await cenario.olheiro("Carla Mendes", "carla@exemplo.com", {
      atuacao: "CLUBE",
      clube: "São Paulo",
    });
    const COMPROVANTE = Buffer.from("%PDF-1.4 comprovante do clube");
    await enviar(doClube, {
      documento: { conteudo: PDF, tipo: "application/pdf" },
      comprovante: { conteudo: COMPROVANTE, tipo: "application/pdf" },
    });

    const [pedido] = (await cenario.como(admin).get("/admin/verificacoes")).body.dados;
    expect(pedido.documentoUrl).toBeUndefined();
    expect(pedido.documento).toBe(
      `/api/v1/admin/verificacoes/${pedido.id}/documento?arquivo=documento`,
    );

    const rota = `/admin/verificacoes/${pedido.id}/documento`;
    const documento = await cenario.como(admin).get(rota);
    expect(documento.status).toBe(200);
    expect(documento.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(documento.body).toString()).toBe(PDF.toString());

    const comprovante = await cenario.como(admin).get(`${rota}?arquivo=comprovante`);
    expect(Buffer.from(comprovante.body).toString()).toBe(COMPROVANTE.toString());

    // Só o administrador abre, e o olheiro sem comprovante não tem o segundo arquivo.
    expect((await cenario.como(doClube).get(rota)).status).toBe(403);
    await enviar(olheiro, { documento: { conteudo: PDF, tipo: "application/pdf" } });
    const semComprovante = (await cenario.como(admin).get("/admin/verificacoes")).body.dados.find(
      (v: { olheiro: { nome: string } }) => v.olheiro.nome === "Fabrizio Romano",
    );
    expect(semComprovante.comprovante).toBeNull();
    const inexistente = await cenario
      .como(admin)
      .get(`/admin/verificacoes/${semComprovante.id}/documento?arquivo=comprovante`);
    expect(inexistente.status).toBe(404);
  });

  it("é só do administrador", async () => {
    expect((await cenario.como(olheiro).get("/admin/verificacoes")).status).toBe(403);
  });
});
