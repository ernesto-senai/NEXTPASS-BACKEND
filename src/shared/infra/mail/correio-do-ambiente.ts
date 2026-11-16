import { env } from "../../../config/env.ts";
import type { Correio } from "../../domain/correio.ts";
import { criarCorreioBrevo } from "./correio-brevo.ts";
import { criarCorreioConsole } from "./correio-console.ts";

// E-mail escolhido no .env (EMAIL_DRIVER): no terminal da API ou de verdade, pelo Brevo.
// As variáveis do Brevo já foram conferidas em config/env.ts.
export function criarCorreioDoAmbiente(): Correio {
  if (env.EMAIL_DRIVER === "console") return criarCorreioConsole();

  return criarCorreioBrevo({
    chave: env.BREVO_API_KEY!,
    remetente: env.EMAIL_FROM!,
    nomeRemetente: env.EMAIL_FROM_NAME,
  });
}
