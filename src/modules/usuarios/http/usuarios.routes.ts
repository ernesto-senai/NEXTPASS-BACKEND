import { Router } from "express";
import { z } from "zod";
import { emailSchema, senhaSchema, telefoneSchema } from "../../../shared/http/validacao.ts";
import type { Sessao } from "../../auth/domain/sessao.ts";
import type { CadastrarAtleta, CadastrarOlheiro } from "../application/cadastrar-usuario.ts";
import type { UsuarioCriado } from "../domain/usuario-repository.ts";
import { TERMOS_VIGENTES } from "../domain/termos.ts";

// Cadastro e perfil (Endpoints v2.0, seção 5.2)
// POST   /atletas                 Público          RF-08, RF-10, RF-12
// POST   /olheiros                Público          RF-09, RF-10, RF-12
// GET    /termos                  Público          RF-10
// GET    /perfil                  Autenticado      RF-14, RF-28
// PATCH  /perfil                  Autenticado      RF-13, RF-14 (recalcula idade e categoria, RN-01)
// DELETE /perfil                  Autenticado      RF-56 (exclusão prevista na LGPD)
// POST   /dispositivos            Autenticado      RF-53

export interface UsuariosCasosDeUso {
  cadastrarAtleta: CadastrarAtleta;
  cadastrarOlheiro: CadastrarOlheiro;
  // O cadastro já devolve a sessão, para o app entrar direto após criar a conta.
  iniciarSessao: (usuario: UsuarioCriado) => Promise<Sessao>;
}

const cadastroAtletaSchema = z.object({
  nome: z
    .string("Informe o nome completo.")
    .trim()
    .min(3, "Informe o nome completo.")
    .max(120, "O nome pode ter no máximo 120 caracteres."),
  email: emailSchema,
  senha: senhaSchema,
  aceiteTermos: z.literal(true, "Aceite os Termos de Uso e a Política de Privacidade."),
});

const cadastroOlheiroSchema = cadastroAtletaSchema
  .extend({
    telefone: telefoneSchema,
    atuacao: z.enum(["CLUBE", "INDEPENDENTE"], "Selecione sua atuação."),
    clube: z
      .string()
      .trim()
      .max(120, "O nome do clube pode ter no máximo 120 caracteres.")
      .optional(),
  })
  .refine((dados) => dados.atuacao !== "CLUBE" || !!dados.clube, {
    path: ["clube"],
    error: "Informe o clube em que você atua.",
  });

export function criarUsuariosRoutes(casos: UsuariosCasosDeUso) {
  const rotas = Router();

  rotas.post("/atletas", async (req, res) => {
    const usuario = await casos.cadastrarAtleta(cadastroAtletaSchema.parse(req.body));
    res.status(201).json(await casos.iniciarSessao(usuario));
  });

  rotas.post("/olheiros", async (req, res) => {
    const usuario = await casos.cadastrarOlheiro(cadastroOlheiroSchema.parse(req.body));
    res.status(201).json(await casos.iniciarSessao(usuario));
  });

  rotas.get("/termos", (_req, res) => {
    res.json(TERMOS_VIGENTES);
  });

  return rotas;
}
