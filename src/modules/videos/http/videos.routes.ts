import { type RequestHandler, Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import { receberArquivo } from "../../../shared/http/upload.ts";
import type { ListarFeedDeLances, RegistrarVisualizacao } from "../application/feed-de-lances.ts";
import type { EditarLance, ExcluirLance, ListarMeusLances } from "../application/meus-lances.ts";
import type { PublicarLance } from "../application/publicar-lance.ts";
import { FORMATOS_LANCE, type FormatoLance, TAMANHO_MAXIMO_LANCE_MB } from "../domain/lance.ts";

// Lances (Endpoints v2.0, seção 5.4)
// GET    /videos                  Olheiro verificado  RF-32
// POST   /videos                  Atleta              RF-25, RF-29 (MP4/MOV até 50 MB, 30 a 60 s, RN-09)
// GET    /perfil/videos           Atleta              RF-28
// PATCH  /videos/:id              Atleta (dono)       RF-31
// DELETE /videos/:id              Atleta (dono)       RF-30
// POST   /videos/:id/visualizacoes  Olheiro verificado  RF-33

export interface VideosCasosDeUso {
  listarFeedDeLances: ListarFeedDeLances;
  publicarLance: PublicarLance;
  listarMeusLances: ListarMeusLances;
  editarLance: EditarLance;
  excluirLance: ExcluirLance;
  registrarVisualizacao: RegistrarVisualizacao;
}

const idSchema = z.object({ id: z.uuid("Lance não encontrado.") });

// Campos de texto que acompanham o vídeo no multipart/form-data.
const novoLanceSchema = z.object({
  legenda: z.string().trim().max(200).optional(),
  localizacao: z.string().trim().max(100).optional(),
});

// RF-31: legenda vazia apaga a legenda.
const edicaoSchema = z
  .object({
    legenda: z
      .string()
      .trim()
      .max(200)
      .transform((legenda) => legenda || null)
      .nullable()
      .optional(),
    destaque: z.boolean().optional(),
  })
  .refine(
    (dados) => dados.legenda !== undefined || dados.destaque !== undefined,
    "Envie a legenda ou o destaque.",
  );

const receberVideo = receberArquivo({
  campo: "video",
  tipos: Object.keys(FORMATOS_LANCE),
  tamanhoMaximoMb: TAMANHO_MAXIMO_LANCE_MB,
  descricao: "um vídeo MP4 ou MOV",
});

export function criarVideosRoutes(
  casos: VideosCasosDeUso,
  exigirOlheiroVerificado: RequestHandler,
) {
  const rotas = Router();

  rotas.get("/videos", authenticate, exigirOlheiroVerificado, async (req, res) => {
    res.json(await casos.listarFeedDeLances(paginacaoSchema.parse(req.query)));
  });

  rotas.post("/videos", authenticate, authorize("ATLETA"), receberVideo, async (req, res) => {
    // receberVideo só segue adiante com o arquivo válido em req.file.
    const arquivo = req.file!;
    const lance = await casos.publicarLance({
      atletaId: usuarioDaRequisicao(req).id,
      video: { conteudo: arquivo.buffer, formato: arquivo.mimetype as FormatoLance },
      ...novoLanceSchema.parse(req.body),
    });
    res.status(201).json(lance);
  });

  rotas.get("/perfil/videos", authenticate, authorize("ATLETA"), async (req, res) => {
    res.json(
      await casos.listarMeusLances(usuarioDaRequisicao(req).id, paginacaoSchema.parse(req.query)),
    );
  });

  rotas.patch("/videos/:id", authenticate, authorize("ATLETA"), async (req, res) => {
    const { id } = idSchema.parse(req.params);
    res.json(
      await casos.editarLance(usuarioDaRequisicao(req).id, id, edicaoSchema.parse(req.body)),
    );
  });

  rotas.delete("/videos/:id", authenticate, authorize("ATLETA"), async (req, res) => {
    const { id } = idSchema.parse(req.params);
    await casos.excluirLance(usuarioDaRequisicao(req).id, id);
    res.status(204).end();
  });

  rotas.post(
    "/videos/:id/visualizacoes",
    authenticate,
    exigirOlheiroVerificado,
    async (req, res) => {
      const { id } = idSchema.parse(req.params);
      await casos.registrarVisualizacao(id, usuarioDaRequisicao(req).id);
      res.status(204).end();
    },
  );

  return rotas;
}
