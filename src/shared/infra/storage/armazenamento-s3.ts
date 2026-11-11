import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Armazenamento } from "../../domain/armazenamento.ts";

// Lances (RF-25) e fotos (RF-14) aparecem para todos. Documentos de verificação
// ficam num bucket privado, que só a API lê (RNF-09).
const PASTAS_PUBLICAS = ["videos", "fotos"];
// Arquivo privado não tem endereço público: o banco guarda "privado:" e a chave.
const PRIVADO = "privado:";

export interface ConfiguracaoS3 {
  endpoint: string;
  regiao: string;
  chaveId: string;
  chaveSecreta: string;
  bucketPublico: string;
  bucketPrivado: string;
  // Endereço de onde o app baixa os arquivos do bucket público.
  urlPublica: string;
}

// Arquivos num serviço compatível com S3 (Supabase Storage, Cloudflare R2 ou AWS S3),
// para todos os aparelhos verem os mesmos lances e fotos.
export function criarArmazenamentoS3(config: ConfiguracaoS3): Armazenamento {
  const cliente = new S3Client({
    endpoint: config.endpoint,
    region: config.regiao,
    credentials: { accessKeyId: config.chaveId, secretAccessKey: config.chaveSecreta },
    // Supabase e R2 usam o bucket no caminho: endpoint/bucket/chave.
    forcePathStyle: true,
    // Soma de verificação só quando a operação exige, porque nem todo serviço aceita as novas.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const urlPublica = config.urlPublica.replace(/\/+$/, "");

  // Bucket e chave pela URL guardada no banco. Null se o arquivo não é deste
  // armazenamento (ex.: lance antigo da pasta uploads).
  const localizar = (url: string) => {
    if (url.startsWith(`${urlPublica}/`)) {
      return { Bucket: config.bucketPublico, Key: url.slice(urlPublica.length + 1) };
    }
    if (url.startsWith(PRIVADO)) {
      return { Bucket: config.bucketPrivado, Key: url.slice(PRIVADO.length) };
    }
    return null;
  };

  return {
    salvar: async ({ pasta, extensao, tipo, conteudo }) => {
      const publico = PASTAS_PUBLICAS.includes(pasta);
      const chave = `${pasta}/${randomUUID()}.${extensao}`;
      await cliente.send(
        new PutObjectCommand({
          Bucket: publico ? config.bucketPublico : config.bucketPrivado,
          Key: chave,
          Body: conteudo,
          ContentType: tipo,
          // O nome é aleatório e o arquivo nunca muda, então o aparelho pode guardar em cache.
          CacheControl: publico ? "public, max-age=31536000, immutable" : "no-store",
        }),
      );
      return publico ? `${urlPublica}/${chave}` : `${PRIVADO}${chave}`;
    },

    remover: async (url) => {
      const alvo = localizar(url);
      if (alvo) await cliente.send(new DeleteObjectCommand(alvo));
    },

    ler: async (url) => {
      const alvo = localizar(url);
      if (!alvo) return null;
      try {
        const resposta = await cliente.send(new GetObjectCommand(alvo));
        return resposta.Body ? Buffer.from(await resposta.Body.transformToByteArray()) : null;
      } catch (erro) {
        if (naoExiste(erro)) return null;
        throw erro;
      }
    },
  };
}

function naoExiste(erro: unknown) {
  const { name, $metadata } = (erro ?? {}) as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return name === "NoSuchKey" || name === "NotFound" || $metadata?.httpStatusCode === 404;
}
