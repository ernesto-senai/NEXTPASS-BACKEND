import { type RequestHandler, Router } from "express";
import { z } from "zod";
import { Categoria, PePreferencial, Posicao } from "../../../generated/prisma/enums.ts";
import { authenticate } from "../../../shared/http/middlewares/authenticate.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { BuscarAtletas } from "../application/buscar-atletas.ts";
import type { ConsultarAtleta } from "../application/consultar-atleta.ts";

// Atletas (Endpoints v2.0, seção 5.5)
// GET    /atletas                 Olheiro verificado  RF-35, RF-36, RF-37 (só perfis completos, RN-02)
// GET    /atletas/:id             Olheiro verificado  RF-38, RF-45

export interface AtletasCasosDeUso {
  buscarAtletas: BuscarAtletas;
  consultarAtleta: ConsultarAtleta;
}

const idSchema = z.object({ id: z.uuid("Atleta não encontrado.") });

const numero = z.coerce.number().min(0).optional();

// Ex.: ?busca=matheus&categoria=SUB_17&posicoes=MEI,ATA&idadeMax=17&pe=DESTRO&ordenar=maisAltos
const buscarSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(80).optional(),
  categoria: z.enum(Categoria).optional(),
  idadeMin: numero,
  idadeMax: numero,
  cidade: z.string().trim().max(80).optional(),
  nacionalidade: z.string().trim().max(80).optional(),
  pe: z.enum(PePreferencial).optional(),
  pesoMin: numero,
  pesoMax: numero,
  alturaMin: numero,
  alturaMax: numero,
  posicoes: z
    .string()
    .transform((lista) => lista.split(",").filter(Boolean))
    .pipe(z.array(z.enum(Posicao)))
    .optional(),
  ordenar: z.enum(["nome", "maisNovos", "maisAltos"]).default("nome"),
});

export function criarAtletasRoutes(
  casos: AtletasCasosDeUso,
  exigirOlheiroVerificado: RequestHandler,
) {
  const rotas = Router();

  // RN-04 e RNF-11: só olheiro verificado busca atletas e vê os dados do perfil.
  rotas.get("/atletas", authenticate, exigirOlheiroVerificado, async (req, res) => {
    const { pagina, limite, pe, ordenar, ...filtro } = buscarSchema.parse(req.query);
    res.json(
      await casos.buscarAtletas(
        { ...filtro, pePreferencial: pe, ordem: ordenar },
        { pagina, limite },
      ),
    );
  });

  rotas.get("/atletas/:id", authenticate, exigirOlheiroVerificado, async (req, res) => {
    const { id } = idSchema.parse(req.params);
    res.json(await casos.consultarAtleta(id));
  });

  return rotas;
}
