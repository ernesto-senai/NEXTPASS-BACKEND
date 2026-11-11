// npm run nuvem:testar: confere se o .env está pronto para o projeto publicado.
// Testa o banco e envia, lê e apaga um arquivo pequeno em cada bucket.
import { env } from "../src/config/env.ts";
import { prisma } from "../src/shared/infra/database/prisma.ts";
import { criarArmazenamentoDoAmbiente } from "../src/shared/infra/storage/armazenamento-do-ambiente.ts";

let falhas = 0;

async function conferir(nome: string, teste: () => Promise<string>) {
  try {
    console.log(`ok      ${nome}: ${await teste()}`);
  } catch (erro) {
    falhas++;
    console.log(`FALHOU  ${nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}

await conferir("banco de dados", async () => {
  const extensoes = await prisma.$queryRaw<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm')`;
  if (extensoes.length < 2) throw new Error("faltam as extensões da busca, rode npm run db:deploy");
  const lances = await prisma.video.count();
  return `${new URL(env.DATABASE_URL).hostname}, ${lances} lance(s)`;
});

if (env.STORAGE_DRIVER === "local") {
  console.log(
    "aviso   arquivos: STORAGE_DRIVER=local guarda tudo na pasta uploads deste computador",
  );
} else {
  const armazenamento = criarArmazenamentoDoAmbiente();
  const conteudo = Buffer.from(`teste do NextPass ${new Date().toISOString()}`);
  const urlPublica = env.S3_PUBLIC_URL!.replace(/\/+$/, "");

  await conferir("bucket público (lances e fotos)", async () => {
    const url = await armazenamento.salvar({
      pasta: "videos",
      extensao: "txt",
      tipo: "text/plain",
      conteudo,
    });
    try {
      const resposta = await fetch(url);
      if (!resposta.ok) {
        throw new Error(
          `o endereço público respondeu ${resposta.status}. Marque o bucket ${env.S3_PUBLIC_BUCKET} como público e confira o S3_PUBLIC_URL`,
        );
      }
      if ((await resposta.text()) !== conteudo.toString()) {
        throw new Error("o arquivo voltou diferente");
      }
      return url;
    } finally {
      await armazenamento.remover(url);
    }
  });

  await conferir("bucket privado (documentos)", async () => {
    const url = await armazenamento.salvar({
      pasta: "documentos",
      extensao: "txt",
      tipo: "text/plain",
      conteudo,
    });
    try {
      if ((await armazenamento.ler(url))?.toString() !== conteudo.toString()) {
        throw new Error("não foi possível ler o arquivo de volta");
      }
      // No Supabase, o mesmo arquivo não pode abrir pelo endereço público (RNF-09).
      if (urlPublica.endsWith(`/${env.S3_PUBLIC_BUCKET}`)) {
        const base = urlPublica.slice(0, -env.S3_PUBLIC_BUCKET.length);
        const resposta = await fetch(`${base}${env.S3_PRIVATE_BUCKET}/${url.split(":")[1]}`);
        if (resposta.ok) {
          throw new Error(`o bucket ${env.S3_PRIVATE_BUCKET} está público; deixe ele privado`);
        }
      }
      return `${env.S3_PRIVATE_BUCKET}, sem acesso público`;
    } finally {
      await armazenamento.remover(url);
    }
  });
}

await prisma.$disconnect();
const resumo = falhas
  ? `${falhas} item(ns) com problema.`
  : env.STORAGE_DRIVER === "local"
    ? "Banco ok. Para publicar, use STORAGE_DRIVER=s3."
    : "Tudo certo para publicar.";
console.log(`\n${resumo}`);
process.exitCode = falhas ? 1 : 0;
