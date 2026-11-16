import type { Correio } from "../../domain/correio.ts";

const ENDERECO_BREVO = "https://api.brevo.com/v3/smtp/email";

export interface ConfiguracaoBrevo {
  chave: string;
  // E-mail do remetente, confirmado no painel do Brevo.
  remetente: string;
  nomeRemetente: string;
  // Endereço da API do Brevo; os testes usam um servidor local.
  endereco?: string;
}

// E-mails de verdade pelo Brevo (300 por dia no plano grátis), pela API HTTPS. O Render
// grátis bloqueia as portas de SMTP, por isso o envio não usa SMTP.
export function criarCorreioBrevo(config: ConfiguracaoBrevo): Correio {
  return {
    enviar: async ({ para, assunto, texto }) => {
      const resposta = await fetch(config.endereco ?? ENDERECO_BREVO, {
        method: "POST",
        headers: {
          "api-key": config.chave,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: config.nomeRemetente, email: config.remetente },
          to: [{ email: para }],
          subject: assunto,
          textContent: texto,
          htmlContent: paraHtml(texto),
        }),
      });
      if (!resposta.ok) {
        throw new Error(`O Brevo recusou o e-mail (${resposta.status}): ${await resposta.text()}`);
      }
    },
  };
}

// O mesmo texto em HTML: cada linha em branco separa um parágrafo, e o código de
// 6 números aparece grande.
function paraHtml(texto: string) {
  const escapar = (trecho: string) =>
    trecho.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragrafos = texto
    .trim()
    .split(/\n{2,}/)
    .map((paragrafo) =>
      /^\d{6}$/.test(paragrafo)
        ? `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2e6b2f">${paragrafo}</p>`
        : `<p>${escapar(paragrafo).replace(/\n/g, "<br>")}</p>`,
    );
  return `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1b231d">${paragrafos.join("")}</div>`;
}
