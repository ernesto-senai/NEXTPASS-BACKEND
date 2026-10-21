import type { Correio } from "../../../shared/domain/correio.ts";
import type { Hasher } from "../../../shared/domain/hasher.ts";
import { calcularIdade } from "../../../shared/domain/idade-categoria.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  type ContaRepository,
  type EmissorTokens,
  paraUsuarioAutenticado,
  type UsuarioAutenticado,
} from "../../auth/domain/sessao.ts";
import type { PerfilRepository } from "../../usuarios/domain/perfil.ts";
import type { UsuarioRepository } from "../../usuarios/domain/usuario-repository.ts";
import {
  VALIDADE_PEDIDO_MS,
  type VinculoDoAtleta,
  type VinculoRepository,
} from "../domain/vinculo.ts";

export type PedirVinculo = (
  atletaId: string,
  emailResponsavel: string,
) => Promise<{ id: string; emailResponsavel: string; status: string }>;

export type ListarVinculosDoAtleta = (atletaId: string) => Promise<VinculoDoAtleta[]>;

export interface AtletaDoResponsavel {
  vinculoId: string;
  atleta: { id: string; nome: string; fotoUrl: string | null; idade: number | null };
}
export type ListarAtletasDoResponsavel = (responsavelId: string) => Promise<AtletaDoResponsavel[]>;

export type ConsultarPedidoDeVinculo = (token: string) => Promise<{
  atleta: { nome: string };
  emailResponsavel: string;
  // Com conta, o responsável só confirma a senha; sem conta, cria uma.
  contaExistente: boolean;
}>;

export type AceitarVinculo = (dados: {
  token: string;
  nome?: string | undefined;
  senha: string;
  aceiteTermos?: boolean | undefined;
}) => Promise<UsuarioAutenticado>;

interface Deps {
  vinculos: VinculoRepository;
  contas: ContaRepository;
  perfis: PerfilRepository;
  usuarios: UsuarioRepository;
  tokens: EmissorTokens;
  hasher: Hasher;
  correio: Correio;
  urlDoApp: string;
  agora?: () => Date;
}

const linkInvalido = () =>
  new AppError(
    "LINK_INVALIDO",
    "Este link é inválido ou expirou. Peça ao atleta para enviar outro.",
  );

// O link do e-mail traz o token; só o hash dele fica no banco (como na sessão).
async function pedidoValido(deps: Deps, token: string) {
  const pedido = await deps.vinculos.buscarPorToken(deps.tokens.hashRefreshToken(token));
  const agora = (deps.agora ?? (() => new Date()))();
  if (!pedido || pedido.status !== "PENDENTE" || !pedido.expiraEm || pedido.expiraEm <= agora) {
    throw linkInvalido();
  }
  return pedido;
}

// RF-15 e RN-03: o atleta menor indica o responsável, que recebe por e-mail
// um link para criar a conta (ou entrar) e confirmar o vínculo. Pedir de novo
// envia um link novo.
export function criarPedirVinculo(deps: Deps): PedirVinculo {
  const agora = deps.agora ?? (() => new Date());

  return async (atletaId, emailResponsavel) => {
    const atleta = await deps.perfis.buscar(atletaId);
    if (!atleta) throw new AppError("NAO_ENCONTRADO", "Conta não encontrada.");
    if (atleta.email === emailResponsavel) {
      throw new AppError("DADOS_INVALIDOS", "Informe o e-mail do seu responsável, não o seu.");
    }

    const { token, hash } = deps.tokens.gerarRefreshToken();
    const pedido = await deps.vinculos.salvarPedido({
      atletaId,
      emailResponsavel,
      tokenHash: hash,
      expiraEm: new Date(agora().getTime() + VALIDADE_PEDIDO_MS),
    });
    if (pedido.status === "CONFIRMADO") {
      throw new AppError("VINCULO_EXISTENTE", "Este responsável já está vinculado à sua conta.");
    }

    await deps.correio.enviar({
      para: emailResponsavel,
      assunto: `Confirme o vínculo com ${atleta.nome} no NextPass`,
      texto: [
        "Olá!",
        "",
        `${atleta.nome} indicou você como responsável no NextPass, o app que conecta jovens atletas a olheiros verificados.`,
        "Como o atleta tem menos de 18 anos, você aprova as inscrições em avaliações e recebe uma cópia dos convites.",
        "",
        "Para confirmar, crie sua conta ou entre por este link (vale por 7 dias):",
        `${deps.urlDoApp}/confirmar-vinculo?token=${token}`,
        "",
        `Se você não conhece ${atleta.nome}, ignore este e-mail.`,
      ].join("\n"),
    });

    return { id: pedido.id, emailResponsavel, status: pedido.status };
  };
}

// Tela "Responsável" do atleta: para quem pediu e se já foi confirmado.
export function criarListarVinculosDoAtleta(deps: {
  vinculos: VinculoRepository;
}): ListarVinculosDoAtleta {
  return (atletaId) => deps.vinculos.listarDoAtleta(atletaId);
}

// RF-49: atletas que o responsável acompanha.
export function criarListarAtletasDoResponsavel(deps: {
  vinculos: VinculoRepository;
  agora?: () => Date;
}): ListarAtletasDoResponsavel {
  const agora = deps.agora ?? (() => new Date());

  return async (responsavelId) => {
    const hoje = agora();
    return (await deps.vinculos.listarDoResponsavel(responsavelId)).map(
      ({ vinculoId, atleta: { dataNascimento, ...atleta } }) => ({
        vinculoId,
        atleta: { ...atleta, idade: dataNascimento ? calcularIdade(dataNascimento, hoje) : null },
      }),
    );
  };
}

// RF-48: o que a tela "Confirmar vínculo" mostra antes do responsável aceitar.
export function criarConsultarPedidoDeVinculo(deps: Deps): ConsultarPedidoDeVinculo {
  return async (token) => {
    const pedido = await pedidoValido(deps, token);
    return {
      atleta: { nome: pedido.atleta.nome },
      emailResponsavel: pedido.emailResponsavel,
      contaExistente: !!(await deps.contas.buscarPorEmail(pedido.emailResponsavel)),
    };
  };
}

// RF-48: pelo link, o responsável cria a conta (ou entra na que já tem, se
// acompanha outro atleta) e o vínculo fica confirmado.
export function criarAceitarVinculo(deps: Deps): AceitarVinculo {
  const agora = deps.agora ?? (() => new Date());

  return async ({ token, nome, senha, aceiteTermos }) => {
    const pedido = await pedidoValido(deps, token);
    const conta = await deps.contas.buscarPorEmail(pedido.emailResponsavel);

    let responsavel: UsuarioAutenticado;
    if (conta) {
      if (conta.tipo !== "RESPONSAVEL") {
        throw new AppError(
          "EMAIL_JA_CADASTRADO",
          "Este e-mail já é de uma conta de atleta ou olheiro. Peça ao atleta para indicar outro.",
        );
      }
      if (!conta.senhaHash || !(await deps.hasher.comparar(senha, conta.senhaHash))) {
        throw new AppError("CREDENCIAIS_INVALIDAS", "Senha incorreta.");
      }
      if (conta.status === "SUSPENSO") {
        throw new AppError("CONTA_SUSPENSA", "Sua conta está suspensa. Fale com o suporte.");
      }
      responsavel = paraUsuarioAutenticado(conta);
    } else {
      if (!nome) throw new AppError("DADOS_INVALIDOS", "Informe seu nome completo.");
      if (!aceiteTermos) {
        throw new AppError(
          "DADOS_INVALIDOS",
          "Aceite os Termos de Uso e a Política de Privacidade.",
        );
      }
      const criado = await deps.usuarios.criarResponsavel({
        nome,
        email: pedido.emailResponsavel,
        senhaHash: await deps.hasher.gerar(senha),
        termosAceitosEm: agora(),
      });
      if (!criado) throw new AppError("EMAIL_JA_CADASTRADO", "Este e-mail já tem uma conta.");
      responsavel = criado;
    }

    await deps.vinculos.confirmar(pedido.id, responsavel.id);
    return responsavel;
  };
}
