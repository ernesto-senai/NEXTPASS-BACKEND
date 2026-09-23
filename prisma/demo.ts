// Dados de demonstração para testar os feeds enquanto upload de lances,
// verificação e criação de avaliações não estão prontos.
// Recria tudo a cada execução (as datas são relativas a hoje) e só mexe nas
// contas @demo.nextpass.app. Senha de todas as contas: demo12345.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("Defina DATABASE_URL no .env.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

const DOMINIO = "@demo.nextpass.app";
const SENHA = "demo12345";

// Vídeos de domínio público (CC0) do MDN, só para o feed tocar algo até o
// upload de lances existir. Não são de futebol e duram poucos segundos.
const VIDEOS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
];

function emDias(dias: number, hora: number, minuto = 0) {
  const data = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  data.setHours(hora, minuto, 0, 0);
  return data;
}

async function main() {
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

  const fabrizio = await olheiro("olheiro", "Fabrizio Romano", "Palmeiras");
  const carla = await olheiro("carla.olheira", "Carla Mendes", "São Paulo");
  const joao = await olheiro("joao.olheiro", "João Silva", null);

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
  const matheus = await atleta("matheus", "Matheus Lima", "2010-02-03", ["MEI"]);

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
    vagasOcupadas: 9,
    local: "Centro de Treinamento Zona Oeste",
  });
  await avaliacao({
    olheiroId: carla.id,
    nome: "Peneira São Paulo Sub-15",
    categoria: "SUB_15",
    dataHora: emDias(5, 8),
    vagas: 30,
    vagasOcupadas: 12,
    local: "Centro de Treinamento Barra Funda",
  });
  await avaliacao({
    olheiroId: carla.id,
    nome: "Peneira São Paulo Sub-20",
    categoria: "SUB_20",
    dataHora: emDias(7, 9),
    vagas: 20,
    vagasOcupadas: 20,
    status: "ESGOTADA",
    local: "Centro de Treinamento Barra Funda",
  });
  await avaliacao({
    olheiroId: joao.id,
    nome: "Peneira aberta Zona Leste Sub-17",
    categoria: "SUB_17",
    dataHora: emDias(10, 8),
    vagas: 40,
    vagasOcupadas: 3,
    taxaCentavos: 0,
    local: "Campo do Parque do Carmo",
  });
  await avaliacao({
    olheiroId: fabrizio.id,
    nome: "Avaliação técnica Sub-17",
    tipo: "TESTE",
    categoria: "SUB_17",
    dataHora: emDias(14, 15),
    vagas: 5,
    vagasOcupadas: 1,
    local: "Academia de Futebol",
  });
  const passada = await avaliacao({
    olheiroId: joao.id,
    nome: "Peneira de verão Sub-17",
    categoria: "SUB_17",
    dataHora: emDias(-20, 8),
    vagas: 30,
    vagasOcupadas: 18,
    status: "ENCERRADA",
    local: "Campo do Parque do Carmo",
  });

  // Silas tem 17 anos: a inscrição futura aguarda o responsável (RN-03), e a
  // passada já tinha sido aprovada.
  await prisma.inscricao.createMany({
    data: [
      { avaliacaoId: palmeiras.id, atletaId: silas.id, status: "AGUARDANDO_RESPONSAVEL" },
      { avaliacaoId: passada.id, atletaId: silas.id, status: "CONFIRMADA" },
    ],
  });

  const lances = [
    { atleta: leandro, legenda: "Gol de falta na semifinal", dias: -1 },
    { atleta: matheus, legenda: "Drible e finalização de fora da área", dias: -2 },
    { atleta: silas, legenda: "Jogada individual pela ponta esquerda", dias: -3 },
    { atleta: leandro, legenda: "Desarme e contra-ataque rápido", dias: -5 },
  ];
  for (const [i, lance] of lances.entries()) {
    const video = await prisma.video.create({
      data: {
        atletaId: lance.atleta.id,
        url: VIDEOS[i % VIDEOS.length]!,
        duracaoSeg: 30 + i * 5,
        legenda: lance.legenda,
        localizacao: "São Paulo, SP",
        destaque: i === 0,
        criadoEm: emDias(lance.dias, 18),
      },
    });
    await prisma.visualizacao.createMany({
      data: [fabrizio, carla, joao].slice(0, 3 - (i % 3)).map((o) => ({
        videoId: video.id,
        olheiroId: o.id,
      })),
    });
  }

  console.log("Dados de demonstração prontos. Senha de todas as contas:", SENHA);
  console.log(`  Atleta:  atleta${DOMINIO}`);
  console.log(`  Olheiro: olheiro${DOMINIO} (verificado)`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
