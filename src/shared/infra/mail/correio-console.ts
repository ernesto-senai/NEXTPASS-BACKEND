import type { Correio } from "../../domain/correio.ts";

// Com EMAIL_DRIVER=console, o e-mail (código de nova senha, link do responsável)
// aparece no terminal da API, para testar sem conta de e-mail.
export function criarCorreioConsole(): Correio {
  return {
    enviar: async ({ para, assunto, texto }) => {
      console.info(`\nE-mail para ${para}\nAssunto: ${assunto}\n\n${texto}\n`);
    },
  };
}
