import { type RequestHandler, Router } from "express";
import { z } from "zod";
import { Categoria, Posicao, TipoAvaliacao } from "../../../generated/prisma/enums.ts";
import { UFS } from "../../../shared/domain/uf.ts";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import type { CadastrarAvaliacao } from "../application/cadastrar-avaliacao.ts";
import type { ListarAvaliacoes } from "../application/listar-avaliacoes.ts";
import type {
  CancelarAvaliacao,
  ListarMinhasAvaliacoes,
} from "../application/minhas-avaliacoes.ts";

// Avaliações (Endpoints v2.0, seção 5.6)
// GET    /avaliacoes              Atleta                     RF-18, RF-19, RF-23, RF-24
// GET    /avaliacoes/:id          Autenticado                RF-20 (endereço só após confirmação, RN-08)
// POST   /avaliacoes              Olheiro verificado         RF-41
// PATCH  /avaliacoes/:id          Olheiro verificado (dono)  RF-43
// DELETE /avaliacoes/:id          Olheiro verificado (dono)  RF-43
// GET    /perfil/avaliacoes       Olheiro                    RF-39, RF-42

export interface AvaliacoesCasosDeUso {
  listarAvaliacoes: ListarAvaliacoes;
  cadastrarAvaliacao: CadastrarAvaliacao;
  listarMinhasAvaliacoes: ListarMinhasAvaliacoes;
  cancelarAvaliacao: CancelarAvaliacao;
}

const minhasAvaliacoesSchema = paginacaoSchema.extend({
  situacao: z.enum(["proximas", "anteriores"]).default("proximas"),
});

const idSchema = z.object({ id: z.uuid("Avaliação não encontrada.") });

// RF-41. dataHora em ISO 8601 com fuso: 2026-11-29T15:00:00-03:00.
const novaAvaliacaoSchema = z.object({
  nome: z.string().trim().min(3).max(80),
  tipo: z.enum(TipoAvaliacao),
  categoria: z.enum(Categoria),
  posicoes: z.array(z.enum(Posicao)).min(1, "Escolha ao menos uma posição."),
  requisitos: z.string().trim().min(3).max(500),
  // RN-13: a taxa só informa; o pagamento acontece fora do app.
  taxaCentavos: z.int().min(0).max(100_000),
  vagas: z.int().min(1).max(500),
  dataHora: z.iso.datetime({ offset: true }).transform((data) => new Date(data)),
  local: z.string().trim().min(2).max(100),
  endereco: z.string().trim().min(5).max(200),
  cidade: z.string().trim().min(2).max(80),
  uf: z.string().trim().toUpperCase().pipe(z.enum(UFS, "Informe a sigla do estado (ex.: SP).")),
});

// Ex.: ?busca=palmeiras&categoria=SUB_17&posicoes=MEI,ATA&precoMax=50&dias=7&comVagas=true
const listarSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(80).optional(),
  categoria: z.enum(Categoria).optional(),
  tipo: z.enum(TipoAvaliacao).optional(),
  cidade: z.string().trim().max(80).optional(),
  posicoes: z
    .string()
    .transform((lista) => lista.split(",").filter(Boolean))
    .pipe(z.array(z.enum(Posicao)))
    .optional(),
  precoMax: z.coerce.number().min(0).optional(),
  dias: z.coerce.number().int().min(1).max(365).optional(),
  comVagas: z.stringbool().optional(),
  ordenar: z.enum(["proximas", "recentes", "menorPreco"]).default("proximas"),
});

export function criarAvaliacoesRoutes(
  casos: AvaliacoesCasosDeUso,
  exigirOlheiroVerificado: RequestHandler,
) {
  const rotas = Router();

  rotas.get("/perfil/avaliacoes", authenticate, authorize("OLHEIRO"), async (req, res) => {
    const { situacao, ...paginacao } = minhasAvaliacoesSchema.parse(req.query);
    res.json(await casos.listarMinhasAvaliacoes(usuarioDaRequisicao(req).id, situacao, paginacao));
  });

  rotas.delete("/avaliacoes/:id", authenticate, exigirOlheiroVerificado, async (req, res) => {
    const { id } = idSchema.parse(req.params);
    await casos.cancelarAvaliacao(usuarioDaRequisicao(req).id, id);
    res.status(204).end();
  });

  rotas.post("/avaliacoes", authenticate, exigirOlheiroVerificado, async (req, res) => {
    const avaliacao = await casos.cadastrarAvaliacao(
      usuarioDaRequisicao(req).id,
      novaAvaliacaoSchema.parse(req.body),
    );
    res.status(201).json(avaliacao);
  });

  rotas.get("/avaliacoes", authenticate, authorize("ATLETA"), async (req, res) => {
    const { pagina, limite, precoMax, comVagas, ordenar, ...filtro } = listarSchema.parse(
      req.query,
    );
    res.json(
      await casos.listarAvaliacoes(
        {
          ...filtro,
          precoMaxCentavos: precoMax === undefined ? undefined : Math.round(precoMax * 100),
          somenteComVagas: comVagas,
          ordem: ordenar,
        },
        { pagina, limite },
      ),
    );
  });

  return rotas;
}
