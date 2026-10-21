import { Router } from "express";
import { z } from "zod";
import { AlvoDenuncia, StatusDenuncia } from "../../../generated/prisma/enums.ts";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { AnalisarDenuncia, Denunciar, ListarDenuncias } from "../application/denuncias.ts";

// Denúncias e moderação (Endpoints v2.0, seções 5.10 e 5.11)
// POST   /denuncias               Autenticado      RF-54 (ECA Digital, art. 28)
// GET    /admin/denuncias         Administrador    RF-58
// PATCH  /admin/denuncias/:id     Administrador    RF-58

export interface DenunciasCasosDeUso {
  denunciar: Denunciar;
  listarDenuncias: ListarDenuncias;
  analisarDenuncia: AnalisarDenuncia;
}

const denunciaSchema = z.object({
  alvoTipo: z.enum(AlvoDenuncia),
  alvoId: z.uuid("Não encontramos o que você quer denunciar."),
  motivo: z
    .string()
    .trim()
    .min(10, "Conte em poucas palavras o que aconteceu (mínimo de 10 caracteres).")
    .max(500, "O motivo pode ter até 500 caracteres."),
});

const filaSchema = paginacaoSchema.extend({
  status: z.enum(StatusDenuncia).default("ABERTA"),
});

const idSchema = z.object({ id: z.uuid("Denúncia não encontrada.") });

const decisaoSchema = z.object({
  status: z.enum(["EM_ANALISE", "PROCEDENTE", "IMPROCEDENTE"]),
  decisao: z.string().trim().max(500).optional(),
  suspenderConta: z.boolean().optional(),
});

export function criarDenunciasRoutes(casos: DenunciasCasosDeUso) {
  const rotas = Router();

  rotas.post("/denuncias", authenticate, async (req, res) => {
    const denuncia = await casos.denunciar({
      autorId: usuarioDaRequisicao(req).id,
      ...denunciaSchema.parse(req.body),
    });
    res.status(201).json(denuncia);
  });

  rotas.get("/admin/denuncias", authenticate, authorize("ADMIN"), async (req, res) => {
    const { status, ...paginacao } = filaSchema.parse(req.query);
    res.json(await casos.listarDenuncias(status, paginacao));
  });

  rotas.patch("/admin/denuncias/:id", authenticate, authorize("ADMIN"), async (req, res) => {
    const { id } = idSchema.parse(req.params);
    await casos.analisarDenuncia(usuarioDaRequisicao(req).id, id, decisaoSchema.parse(req.body));
    res.status(204).end();
  });

  return rotas;
}
