import { Router } from "express";
import { z } from "zod";
import { StatusVerificacao } from "../../../generated/prisma/enums.ts";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { paginacaoSchema } from "../../../shared/http/pagination.ts";
import { arquivoDoCampo, receberArquivos } from "../../../shared/http/upload.ts";
import type { ConsultarVerificacao } from "../application/consultar-verificacao.ts";
import type {
  AbrirDocumento,
  AnalisarVerificacao,
  EnviarDocumentos,
  ListarVerificacoes,
} from "../application/enviar-documentos.ts";
import {
  FORMATOS_DOCUMENTO,
  type FormatoDocumento,
  TAMANHO_MAXIMO_DOCUMENTO_MB,
} from "../domain/verificacao.ts";

// Verificação do olheiro (Endpoints v2.0, seções 5.3 e 5.10)
// POST   /perfil/verificacao      Olheiro          RF-16 (multipart, armazenamento privado, RNF-09)
// GET    /perfil/verificacao      Olheiro          RF-17
// GET    /admin/verificacoes      Administrador    RF-57
// GET    /admin/verificacoes/:id/documento  Administrador  RF-57 (?arquivo=documento|comprovante, RNF-09)
// PATCH  /admin/verificacoes/:id  Administrador    RF-57

export interface VerificacoesCasosDeUso {
  consultarVerificacao: ConsultarVerificacao;
  enviarDocumentos: EnviarDocumentos;
  listarVerificacoes: ListarVerificacoes;
  analisarVerificacao: AnalisarVerificacao;
  abrirDocumento: AbrirDocumento;
}

// Campos "documento" (obrigatório) e "comprovante" (quem atua por clube).
const receberDocumentos = receberArquivos({
  campos: ["documento", "comprovante"],
  obrigatorios: ["documento"],
  tipos: Object.keys(FORMATOS_DOCUMENTO),
  tamanhoMaximoMb: TAMANHO_MAXIMO_DOCUMENTO_MB,
  descricao: "o documento em JPG, PNG ou PDF",
});

const filaSchema = paginacaoSchema.extend({
  status: z.enum(StatusVerificacao).default("PENDENTE"),
});

const idSchema = z.object({ id: z.uuid("Verificação não encontrada.") });
const arquivoSchema = z.object({
  arquivo: z.enum(["documento", "comprovante"]).default("documento"),
});

const decisaoSchema = z
  .object({
    status: z.enum(["APROVADA", "RECUSADA"]),
    motivoRecusa: z.string().trim().min(5).max(300).optional(),
  })
  .refine((decisao) => decisao.status === "APROVADA" || !!decisao.motivoRecusa, {
    path: ["motivoRecusa"],
    error: "Informe o motivo da recusa.",
  });

export function criarVerificacoesRoutes(casos: VerificacoesCasosDeUso) {
  const rotas = Router();

  rotas.get("/perfil/verificacao", authenticate, authorize("OLHEIRO"), async (req, res) => {
    res.json(await casos.consultarVerificacao(usuarioDaRequisicao(req).id));
  });

  rotas.post(
    "/perfil/verificacao",
    authenticate,
    authorize("OLHEIRO"),
    receberDocumentos,
    async (req, res) => {
      const arquivo = (campo: string) => {
        const enviado = arquivoDoCampo(req, campo);
        return enviado
          ? { conteudo: enviado.buffer, formato: enviado.mimetype as FormatoDocumento }
          : undefined;
      };
      res.status(201).json(
        await casos.enviarDocumentos(usuarioDaRequisicao(req).id, {
          // receberDocumentos só segue adiante com o documento.
          documento: arquivo("documento")!,
          comprovante: arquivo("comprovante"),
        }),
      );
    },
  );

  rotas.get("/admin/verificacoes", authenticate, authorize("ADMIN"), async (req, res) => {
    const { status, ...paginacao } = filaSchema.parse(req.query);
    res.json(await casos.listarVerificacoes(status, paginacao));
  });

  rotas.get(
    "/admin/verificacoes/:id/documento",
    authenticate,
    authorize("ADMIN"),
    async (req, res) => {
      const { id } = idSchema.parse(req.params);
      const { arquivo } = arquivoSchema.parse(req.query);
      const { conteudo, tipo } = await casos.abrirDocumento(id, arquivo);
      // Abre no navegador (ou no Thunder Client) e não fica em cache.
      res
        .type(tipo)
        .set("Content-Disposition", "inline")
        .set("Cache-Control", "no-store")
        .send(conteudo);
    },
  );

  rotas.patch("/admin/verificacoes/:id", authenticate, authorize("ADMIN"), async (req, res) => {
    const { id } = idSchema.parse(req.params);
    await casos.analisarVerificacao(usuarioDaRequisicao(req).id, id, decisaoSchema.parse(req.body));
    res.status(204).end();
  });

  return rotas;
}
