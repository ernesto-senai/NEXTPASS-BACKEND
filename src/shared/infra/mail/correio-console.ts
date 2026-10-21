import type { Correio } from "../../domain/correio.ts";

// O NextPass não envia e-mails de verdade: o e-mail (ex.: link de vínculo
// com o responsável) aparece no terminal da API, para copiar e abrir no app.
export function criarCorreioConsole(): Correio {
  return {
    enviar: async ({ para, assunto, texto }) => {
      console.info(`\n✉️  E-mail para ${para}\nAssunto: ${assunto}\n\n${texto}\n`);
    },
  };
}
