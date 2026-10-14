import { type RequestHandler, Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type {
  ListarConvitesRecebidos,
  ResponderConvite,
} from "../application/convites-recebidos.ts";
import type { EnviarConvite } from "../application/enviar-convite.ts";
import { TAMANHO_MAXIMO_MENSAGEM } from "../domain/convite.ts";

// Convites (Endpoints v2.0, seção 5.8)
// POST   /convites                Olheiro verificado  RF-34, RF-39, RF-40 (até 300 caracteres, RN-10)
// GET    /convites                Autenticado         RF-26, RF-49
// PATCH  /convites/:id            Atleta              RF-27 (o aceite cria a inscrição)

export interface ConvitesCasosDeUso {
  enviarConvite: EnviarConvite;
  listarConvitesRecebidos: ListarConvitesRecebidos;
  responderConvite: ResponderConvite;
}

const novoConviteSchema = z.object({
  atletaId: z.uuid("Atleta não encontrado."),
  avaliacaoId: z.uuid("Avaliação não encontrada."),
  mensagem: z
    .string()
    .trim()
    .min(1, "Escreva uma mensagem para o atleta.")
    .max(TAMANHO_MAXIMO_MENSAGEM, `A mensagem pode ter até ${TAMANHO_MAXIMO_MENSAGEM} caracteres.`),
});

const idSchema = z.object({ id: z.uuid("Convite não encontrado.") });
const respostaSchema = z.object({ status: z.enum(["ACEITO", "RECUSADO"]) });

export function criarConvitesRoutes(
  casos: ConvitesCasosDeUso,
  exigirOlheiroVerificado: RequestHandler,
) {
  const rotas = Router();

  rotas.post("/convites", authenticate, exigirOlheiroVerificado, async (req, res) => {
    const convite = await casos.enviarConvite({
      olheiroId: usuarioDaRequisicao(req).id,
      ...novoConviteSchema.parse(req.body),
    });
    res.status(201).json(convite);
  });

  // Por enquanto só a caixa do atleta; olheiro e responsável vêm com as telas deles.
  rotas.get("/convites", authenticate, authorize("ATLETA"), async (req, res) => {
    res.json(
      await casos.listarConvitesRecebidos(
        usuarioDaRequisicao(req).id,
        paginacaoSchema.parse(req.query),
      ),
    );
  });

  rotas.patch("/convites/:id", authenticate, authorize("ATLETA"), async (req, res) => {
    const { id } = idSchema.parse(req.params);
    const { status } = respostaSchema.parse(req.body);
    res.json(await casos.responderConvite(usuarioDaRequisicao(req).id, id, status));
  });

  return rotas;
}
