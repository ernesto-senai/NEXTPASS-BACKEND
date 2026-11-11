// Dados de demonstração para a apresentação. Recria tudo a cada execução (datas a
// partir de hoje) e só mexe nas contas @demo.nextpass.app. Senha: demo12345.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env.ts";
import { lerDuracaoDoVideo } from "../src/modules/videos/infra/duracao-video.ts";
import { videoEhHorizontal } from "../src/modules/videos/infra/orientacao-video.ts";
import { prisma } from "../src/shared/infra/database/prisma.ts";
import { criarArmazenamentoDoAmbiente } from "../src/shared/infra/storage/armazenamento-do-ambiente.ts";
import { PASTA_UPLOADS } from "../src/shared/infra/storage/armazenamento-local.ts";

// Com STORAGE_DRIVER=s3, os vídeos da demonstração vão para a internet, como os do app.
const armazenamento = criarArmazenamentoDoAmbiente();

const DOMINIO = "@demo.nextpass.app";
const SENHA = "demo12345";

// Vídeos dos lances: usa os de uploads/demo-lances (lances reais, fora do Git) e,
// se não houver, os exemplos de prisma/demo-lances.
const PASTAS_DE_LANCES = [
  path.join(PASTA_UPLOADS, "demo-lances"),
  path.join(import.meta.dirname, "demo-lances"),
];

async function videosDaDemo() {
  for (const pasta of PASTAS_DE_LANCES) {
    const arquivos = await readdir(pasta).catch(() => [] as string[]);
    const videos = arquivos.filter((nome) => /\.(mp4|mov)$/i.test(nome)).sort();
    if (videos.length === 0) continue;

    const lances = await Promise.all(
      videos.map(async (nome) => {
        const conteudo = await readFile(path.join(pasta, nome));
        const mov = nome.toLowerCase().endsWith(".mov");
        return {
          conteudo,
          extensao: mov ? "mov" : "mp4",
          tipo: mov ? "video/quicktime" : "video/mp4",
          duracaoSeg: Math.round(lerDuracaoDoVideo(conteudo) ?? 45),
          horizontal: videoEhHorizontal(conteudo),
        };
      }),
    );
    return { pasta: path.relative(process.cwd(), pasta), lances };
  }
  throw new Error("Nenhum lance em uploads/demo-lances nem em prisma/demo-lances.");
}

function emDias(dias: number, hora: number, minuto = 0) {
  const data = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  data.setHours(hora, minuto, 0, 0);
  return data;
}

async function main() {
  // Apaga os arquivos das contas demo antes de recriar tudo, para não sobrar arquivo sem dono.
  const antigas = await prisma.usuario.findMany({
    where: { email: { endsWith: DOMINIO } },
    select: { fotoUrl: true, atleta: { select: { videos: { select: { url: true } } } } },
  });
  for (const { fotoUrl, atleta } of antigas) {
    for (const url of [fotoUrl, ...(atleta?.videos.map((video) => video.url) ?? [])]) {
      if (url) await armazenamento.remover(url);
    }
  }
  await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } });
  const senhaHash = await bcrypt.hash(SENHA, 10);
  const conta = (email: string, nome: string) => ({
    nome,
    email: `${email}${DOMINIO}`,
    senhaHash,
    termosAceitosEm: new Date(),
  });

  // Olheiros já verificados (RN-04), com a verificação aprovada registrada.
  const olheiro = (email: string, nome: string, clube: string | null) =>
    prisma.usuario.create({
      data: {
        ...conta(email, nome),
        tipo: "OLHEIRO",
        olheiro: {
          create: {
            telefone: "+5511900000000",
            atuacao: clube ? "CLUBE" : "INDEPENDENTE",
            clube,
            verificado: true,
            verificacoes: {
              create: {
                documentoUrl: "demo/documento.pdf",
                comprovanteUrl: clube ? "demo/comprovante.pdf" : null,
                status: "APROVADA",
                analisadaEm: new Date(),
              },
            },
          },
        },
      },
    });

  // Poucas contas, só as do roteiro da apresentação: um olheiro verificado,
  // dois atletas menores (um com responsável e outro sem) e a responsável.
  const fabrizio = await olheiro("olheiro", "Fabrizio Romano", "Palmeiras");

  const atleta = (
    email: string,
    nome: string,
    nascimento: string,
    posicoes: ("PE" | "ATA" | "MEI" | "ZAG")[],
  ) =>
    prisma.usuario.create({
      data: {
        ...conta(email, nome),
        tipo: "ATLETA",
        atleta: {
          create: {
            dataNascimento: new Date(nascimento),
            posicoes,
            alturaCm: 174,
            pesoKg: 68,
            pePreferencial: "DESTRO",
            cidade: "São Paulo",
            uf: "SP",
            nacionalidade: "Brasileira",
          },
        },
      },
    });

  const silas = await atleta("atleta", "Silas Rodrigues", "2009-05-10", ["PE", "ATA"]);
  const leandro = await atleta("leandro", "Leandro Sousa", "2009-08-21", ["MEI", "ATA"]);

  const requisitos =
    "Chuteira, caneleira, documento com foto, short preto, camisa branca e garrafa de água.";
  const avaliacao = (dados: {
    olheiroId: string;
    nome: string;
    tipo?: "PENEIRA" | "TESTE";
    categoria: "SUB_15" | "SUB_17" | "SUB_20";
    dataHora: Date;
    vagas: number;
    vagasOcupadas: number;
    taxaCentavos?: number;
    status?: "ABERTA" | "ESGOTADA" | "ENCERRADA";
    local: string;
  }) =>
    prisma.avaliacao.create({
      data: {
        tipo: "PENEIRA",
        posicoes: ["GOL", "ZAG", "MEI", "ATA"],
        requisitos,
        taxaCentavos: 3000,
        endereco: "Endereço de demonstração, 100",
        cidade: "São Paulo",
        uf: "SP",
        ...dados,
      },
    });

  const palmeiras = await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Peneira Palmeiras Sub-17",
    categoria: "SUB_17",
    dataHora: emDias(3, 7, 30),
    vagas: 22,
    vagasOcupadas: 0,
    local: "Centro de Treinamento Zona Oeste",
  });
  await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Peneira Palmeiras Sub-15",
    categoria: "SUB_15",
    dataHora: emDias(5, 8),
    vagas: 30,
    vagasOcupadas: 0,
    local: "Centro de Treinamento Barra Funda",
  });
  // Uma vaga só, já ocupada pelo Silas: mostra "Vagas esgotadas" e, na
  // inscrição confirmada dele, o endereço completo (RN-08).
  const lotada = await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Teste de linha Sub-17",
    tipo: "TESTE",
    categoria: "SUB_17",
    dataHora: emDias(7, 9),
    vagas: 1,
    vagasOcupadas: 1,
    status: "ESGOTADA",
    local: "Centro de Treinamento Barra Funda",
  });
  const zonaLeste = await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Peneira aberta Zona Leste Sub-17",
    categoria: "SUB_17",
    dataHora: emDias(10, 8),
    vagas: 40,
    vagasOcupadas: 0,
    taxaCentavos: 0,
    local: "Campo do Parque do Carmo",
  });
  const tecnica = await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Avaliação técnica Sub-17",
    tipo: "TESTE",
    categoria: "SUB_17",
    dataHora: emDias(14, 15),
    vagas: 5,
    vagasOcupadas: 0,
    local: "Academia de Futebol",
  });
  const passada = await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Peneira de verão Sub-17",
    categoria: "SUB_17",
    dataHora: emDias(-20, 8),
    vagas: 30,
    vagasOcupadas: 1,
    status: "ENCERRADA",
    local: "Campo do Parque do Carmo",
  });

  // Silas tem 17 anos: a inscrição nova aguarda o responsável (RN-03); as
  // outras duas já tinham sido aprovadas.
  await prisma.inscricao.createMany({
    data: [
      { avaliacaoId: palmeiras.id, atletaId: silas.id, status: "AGUARDANDO_RESPONSAVEL" },
      { avaliacaoId: lotada.id, atletaId: silas.id, status: "CONFIRMADA" },
      { avaliacaoId: passada.id, atletaId: silas.id, status: "CONFIRMADA" },
    ],
  });

  // Responsável do Silas, com vínculo confirmado: aprova as inscrições dele (RN-03).
  const responsavel = await prisma.usuario.create({
    data: { ...conta("responsavel", "Ana Rodrigues"), tipo: "RESPONSAVEL" },
  });
  await prisma.vinculo.create({
    data: {
      atletaId: silas.id,
      responsavelId: responsavel.id,
      emailResponsavel: responsavel.email,
      status: "CONFIRMADO",
    },
  });

  // Convites (RF-26): dois pendentes na caixa do Silas; na do Leandro, um
  // recusado e um de avaliação que lotou, já expirado (RN-12).
  await prisma.convite.createMany({
    data: [
      {
        olheiroId: fabrizio.id,
        atletaId: silas.id,
        avaliacaoId: tecnica.id,
        mensagem:
          "Olá, Silas! Gostamos dos seus lances de ponta esquerda e queremos te ver numa avaliação técnica.",
        criadoEm: emDias(-1, 10),
      },
      {
        olheiroId: fabrizio.id,
        atletaId: silas.id,
        avaliacaoId: zonaLeste.id,
        mensagem:
          "Vi sua jogada individual pela ponta. Venha mostrar seu futebol na nossa peneira!",
        criadoEm: emDias(-2, 16),
      },
      {
        olheiroId: fabrizio.id,
        atletaId: leandro.id,
        avaliacaoId: zonaLeste.id,
        mensagem: "Leandro, sua visão de jogo chamou atenção. Venha para a peneira da Zona Leste!",
        status: "RECUSADO",
        criadoEm: emDias(-3, 11),
      },
      {
        olheiroId: fabrizio.id,
        atletaId: leandro.id,
        avaliacaoId: lotada.id,
        mensagem: "Temos um teste individual e achamos que você pode se destacar.",
        status: "EXPIRADO",
        criadoEm: emDias(-4, 9),
      },
    ],
  });

  // Avisos do olheiro Fabrizio (RF-47): respostas a convites e novas inscrições.
  const horasAtras = (horas: number) => new Date(Date.now() - horas * 60 * 60 * 1000);
  await prisma.notificacao.createMany({
    data: [
      {
        usuarioId: fabrizio.id,
        tipo: "CONVITE_RESPONDIDO",
        texto: "Leandro Sousa recusou o convite para Peneira aberta Zona Leste Sub-17.",
        criadoEm: horasAtras(3),
      },
      {
        usuarioId: fabrizio.id,
        tipo: "NOVA_INSCRICAO",
        texto: "Silas Rodrigues se inscreveu em Teste de linha Sub-17.",
        criadoEm: horasAtras(26),
      },
      {
        usuarioId: fabrizio.id,
        tipo: "NOVA_INSCRICAO",
        texto: "Silas Rodrigues se inscreveu em Peneira de verão Sub-17.",
        lida: true,
        criadoEm: horasAtras(50),
      },
    ],
  });

  const lances = [
    { atleta: leandro, legenda: "Gol de falta na semifinal", dias: -1 },
    { atleta: silas, legenda: "Drible e finalização de fora da área", dias: -2 },
    { atleta: silas, legenda: "Jogada individual pela ponta esquerda", dias: -3 },
    { atleta: leandro, legenda: "Desarme e contra-ataque rápido", dias: -5 },
  ];
  const videos = await videosDaDemo();
  for (const [i, lance] of lances.entries()) {
    // Cada lance tem o próprio arquivo: excluir um lance no app não apaga o vídeo de outro.
    const { conteudo, extensao, tipo, duracaoSeg, horizontal } =
      videos.lances[i % videos.lances.length]!;
    const url = await armazenamento.salvar({ pasta: "videos", extensao, tipo, conteudo });
    const video = await prisma.video.create({
      data: {
        atletaId: lance.atleta.id,
        url,
        duracaoSeg,
        horizontal,
        legenda: lance.legenda,
        localizacao: "São Paulo, SP",
        // O primeiro lance de cada atleta fica no carrossel do perfil.
        destaque: i < 2,
        criadoEm: emDias(lance.dias, 18),
      },
    });
    await prisma.visualizacao.createMany({
      data: { videoId: video.id, olheiroId: fabrizio.id },
    });
  }

  console.log("Dados de demonstração prontos. Senha de todas as contas:", SENHA);
  const onde = env.STORAGE_DRIVER === "s3" ? "na internet" : "na pasta uploads";
  console.log(`  Lances: ${videos.lances.length} vídeo(s) de ${videos.pasta}, guardados ${onde}`);
  console.log(`  Atleta com responsável: atleta${DOMINIO}`);
  console.log(`  Atleta sem responsável: leandro${DOMINIO}`);
  console.log(`  Olheiro: olheiro${DOMINIO} (verificado)`);
  console.log(`  Responsável do atleta: responsavel${DOMINIO}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
