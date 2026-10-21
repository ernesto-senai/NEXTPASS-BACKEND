import { Router } from "express";
import { z } from "zod";
import { PePreferencial, Posicao } from "../../../generated/prisma/enums.ts";
import { calcularIdade } from "../../../shared/domain/idade-categoria.ts";
import { UFS } from "../../../shared/domain/uf.ts";
import {
  authenticate,
  usuarioDaRequisicao,
} from "../../../shared/http/middlewares/authenticate.ts";
import { authorize } from "../../../shared/http/middlewares/authorize.ts";
import { receberArquivo } from "../../../shared/http/upload.ts";
import { emailSchema, senhaSchema, telefoneSchema } from "../../../shared/http/validacao.ts";
import type { Sessao } from "../../auth/domain/sessao.ts";
import type { CadastrarAtleta, CadastrarOlheiro } from "../application/cadastrar-usuario.ts";
import type { ExcluirConta, TrocarFoto } from "../application/conta.ts";
import type { AtualizarPerfilAtleta, ConsultarPerfil } from "../application/perfil.ts";
import { FORMATOS_FOTO, type FormatoFoto, TAMANHO_MAXIMO_FOTO_MB } from "../domain/perfil.ts";
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
  consultarPerfil: ConsultarPerfil;
  atualizarPerfilAtleta: AtualizarPerfilAtleta;
  trocarFoto: TrocarFoto;
  excluirConta: ExcluirConta;
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

// RF-13: dados técnicos do atleta. A data vem como "2009-05-10".
const perfilAtletaSchema = z.object({
  nome: cadastroAtletaSchema.shape.nome,
  dataNascimento: z.iso
    .date("Informe a data de nascimento.")
    .transform((data) => new Date(data))
    .refine((data) => {
      const idade = calcularIdade(data);
      return idade >= 6 && idade <= 60;
    }, "Confira a data de nascimento."),
  posicoes: z
    .array(z.enum(Posicao))
    .min(1, "Escolha ao menos uma posição.")
    .max(3, "Escolha até 3 posições."),
  alturaCm: z.int().min(100, "Informe a altura em centímetros.").max(230, "Confira a altura."),
  pesoKg: z.int().min(20, "Informe o peso em quilos.").max(150, "Confira o peso."),
  pePreferencial: z.enum(PePreferencial, "Escolha o pé preferencial."),
  cidade: z.string().trim().min(2, "Informe a cidade.").max(80),
  uf: z.string().trim().toUpperCase().pipe(z.enum(UFS, "Informe a sigla do estado (ex.: SP).")),
  nacionalidade: z.string().trim().min(2, "Informe a nacionalidade.").max(60),
});

const receberFoto = receberArquivo({
  campo: "foto",
  tipos: Object.keys(FORMATOS_FOTO),
  tamanhoMaximoMb: TAMANHO_MAXIMO_FOTO_MB,
  descricao: "uma foto em JPG, PNG ou WebP",
});

const exclusaoSchema = z.object({ senha: z.string("Informe a senha.").min(1, "Informe a senha.") });

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

  rotas.get("/perfil", authenticate, async (req, res) => {
    res.json(await casos.consultarPerfil(usuarioDaRequisicao(req).id));
  });

  // Por enquanto só o atleta edita o perfil; o olheiro vem com a tela dele.
  rotas.patch("/perfil", authenticate, authorize("ATLETA"), async (req, res) => {
    res.json(
      await casos.atualizarPerfilAtleta(
        usuarioDaRequisicao(req).id,
        perfilAtletaSchema.parse(req.body),
      ),
    );
  });

  rotas.post("/perfil/foto", authenticate, receberFoto, async (req, res) => {
    // receberFoto só segue adiante com a foto válida em req.file.
    const foto = req.file!;
    res.json(
      await casos.trocarFoto(usuarioDaRequisicao(req).id, {
        conteudo: foto.buffer,
        formato: foto.mimetype as FormatoFoto,
      }),
    );
  });

  rotas.delete("/perfil", authenticate, async (req, res) => {
    const { senha } = exclusaoSchema.parse(req.body);
    await casos.excluirConta(usuarioDaRequisicao(req).id, senha);
    res.status(204).end();
  });

  return rotas;
}
