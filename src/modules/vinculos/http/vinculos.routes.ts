import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { emailSchema, senhaSchema } from "../../../shared/http/validacao.ts";
import type { Sessao, UsuarioAutenticado } from "../../auth/domain/sessao.ts";
import type {
  AceitarVinculo,
  ConsultarPedidoDeVinculo,
  ListarAtletasDoResponsavel,
  ListarVinculosDoAtleta,
  PedirVinculo,
} from "../application/vinculos.ts";

// Vínculo com o responsável (Endpoints v2.0, seção 5.3)
// POST   /vinculos                Atleta           RF-15
// GET    /vinculos                Atleta ou Responsável  RF-15, RF-49
// GET    /vinculos/pedido         Público (token)  RF-48 (o que a tela de confirmação mostra)
// POST   /responsaveis            Público (token)  RF-48

export interface VinculosCasosDeUso {
  pedirVinculo: PedirVinculo;
  listarVinculosDoAtleta: ListarVinculosDoAtleta;
  listarAtletasDoResponsavel: ListarAtletasDoResponsavel;
  consultarPedidoDeVinculo: ConsultarPedidoDeVinculo;
  aceitarVinculo: AceitarVinculo;
  // A confirmação já entra no app, como o cadastro.
  iniciarSessao: (usuario: UsuarioAutenticado) => Promise<Sessao>;
}

const pedidoSchema = z.object({ emailResponsavel: emailSchema });
const tokenSchema = z.object({ token: z.string("Link inválido.").min(10, "Link inválido.") });

const aceiteSchema = tokenSchema.extend({
  nome: z.string().trim().min(3, "Informe o nome completo.").max(120).optional(),
  senha: senhaSchema,
  aceiteTermos: z.boolean().optional(),
});

export function criarVinculosRoutes(casos: VinculosCasosDeUso) {
  const rotas = Router();

  rotas.post("/vinculos", authenticate, authorize("ATLETA"), async (req, res) => {
    const { emailResponsavel } = pedidoSchema.parse(req.body);
    res.status(201).json(await casos.pedirVinculo(usuarioDaRequisicao(req).id, emailResponsavel));
  });

  rotas.get("/vinculos", authenticate, authorize("ATLETA", "RESPONSAVEL"), async (req, res) => {
    const usuario = usuarioDaRequisicao(req);
    res.json(
      usuario.tipo === "RESPONSAVEL"
        ? await casos.listarAtletasDoResponsavel(usuario.id)
        : await casos.listarVinculosDoAtleta(usuario.id),
    );
  });

  rotas.get("/vinculos/pedido", async (req, res) => {
    const { token } = tokenSchema.parse(req.query);
    res.json(await casos.consultarPedidoDeVinculo(token));
  });

  rotas.post("/responsaveis", async (req, res) => {
    const responsavel = await casos.aceitarVinculo(aceiteSchema.parse(req.body));
    res.status(201).json(await casos.iniciarSessao(responsavel));
  });

  return rotas;
}
