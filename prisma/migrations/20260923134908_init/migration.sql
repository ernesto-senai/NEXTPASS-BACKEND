-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ATLETA', 'OLHEIRO', 'RESPONSAVEL', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "PePreferencial" AS ENUM ('DESTRO', 'CANHOTO', 'AMBIDESTRO');

-- CreateEnum
CREATE TYPE "Posicao" AS ENUM ('GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MEI', 'PD', 'PE', 'ATA');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('SUB_9', 'SUB_11', 'SUB_13', 'SUB_15', 'SUB_17', 'SUB_20', 'PROFISSIONAL');

-- CreateEnum
CREATE TYPE "AtuacaoOlheiro" AS ENUM ('CLUBE', 'INDEPENDENTE');

-- CreateEnum
CREATE TYPE "StatusVerificacao" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');

-- CreateEnum
CREATE TYPE "StatusVinculo" AS ENUM ('PENDENTE', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "TipoAvaliacao" AS ENUM ('PENEIRA', 'TESTE');

-- CreateEnum
CREATE TYPE "StatusAvaliacao" AS ENUM ('ABERTA', 'ESGOTADA', 'CANCELADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('AGUARDANDO_RESPONSAVEL', 'CONFIRMADA', 'CANCELADA', 'RECUSADA', 'REMOVIDA');

-- CreateEnum
CREATE TYPE "StatusConvite" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('NOVO_CONVITE', 'COPIA_CONVITE', 'CONVITE_RESPONDIDO', 'APROVAR_INSCRICAO', 'NOVA_INSCRICAO', 'INSCRICAO_ATUALIZADA', 'AVALIACAO_ALTERADA', 'VERIFICACAO_ANALISADA');

-- CreateEnum
CREATE TYPE "AlvoDenuncia" AS ENUM ('PERFIL', 'VIDEO', 'CONVITE', 'AVALIACAO');

-- CreateEnum
CREATE TYPE "StatusDenuncia" AS ENUM ('ABERTA', 'EM_ANALISE', 'PROCEDENTE', 'IMPROCEDENTE');

-- CreateEnum
CREATE TYPE "TipoToken" AS ENUM ('REFRESH', 'REDEFINIR_SENHA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "fotoUrl" TEXT,
    "tipo" "TipoUsuario" NOT NULL,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "termosAceitosEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atleta" (
    "usuarioId" UUID NOT NULL,
    "dataNascimento" DATE,
    "posicoes" "Posicao"[],
    "alturaCm" INTEGER,
    "pesoKg" INTEGER,
    "pePreferencial" "PePreferencial",
    "cidade" TEXT,
    "uf" CHAR(2),
    "nacionalidade" TEXT,

    CONSTRAINT "Atleta_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Olheiro" (
    "usuarioId" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "atuacao" "AtuacaoOlheiro" NOT NULL,
    "clube" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Olheiro_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Verificacao" (
    "id" UUID NOT NULL,
    "olheiroId" UUID NOT NULL,
    "documentoUrl" TEXT NOT NULL,
    "comprovanteUrl" TEXT,
    "status" "StatusVerificacao" NOT NULL DEFAULT 'PENDENTE',
    "motivoRecusa" TEXT,
    "analisadaPorId" UUID,
    "analisadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vinculo" (
    "id" UUID NOT NULL,
    "atletaId" UUID NOT NULL,
    "responsavelId" UUID,
    "emailResponsavel" TEXT NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'PENDENTE',
    "tokenHash" TEXT,
    "tokenExpiraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" UUID NOT NULL,
    "atletaId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "duracaoSeg" INTEGER NOT NULL,
    "legenda" TEXT,
    "localizacao" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visualizacao" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "olheiroId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visualizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" UUID NOT NULL,
    "olheiroId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoAvaliacao" NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "posicoes" "Posicao"[],
    "requisitos" TEXT NOT NULL,
    "taxaCentavos" INTEGER NOT NULL DEFAULT 0,
    "vagas" INTEGER NOT NULL,
    "vagasOcupadas" INTEGER NOT NULL DEFAULT 0,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "status" "StatusAvaliacao" NOT NULL DEFAULT 'ABERTA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscricao" (
    "id" UUID NOT NULL,
    "avaliacaoId" UUID NOT NULL,
    "atletaId" UUID NOT NULL,
    "conviteId" UUID,
    "status" "StatusInscricao" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" UUID NOT NULL,
    "olheiroId" UUID NOT NULL,
    "atletaId" UUID NOT NULL,
    "avaliacaoId" UUID NOT NULL,
    "mensagem" VARCHAR(300) NOT NULL,
    "status" "StatusConvite" NOT NULL DEFAULT 'PENDENTE',
    "respondidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "texto" TEXT NOT NULL,
    "dados" JSONB,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tokenPush" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Denuncia" (
    "id" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "alvoTipo" "AlvoDenuncia" NOT NULL,
    "alvoId" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusDenuncia" NOT NULL DEFAULT 'ABERTA',
    "decisao" TEXT,
    "analisadaPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoToken" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");

-- CreateIndex
CREATE INDEX "Atleta_uf_cidade_idx" ON "Atleta"("uf", "cidade");

-- CreateIndex
CREATE INDEX "Atleta_dataNascimento_idx" ON "Atleta"("dataNascimento");

-- CreateIndex
CREATE INDEX "Verificacao_status_idx" ON "Verificacao"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Vinculo_tokenHash_key" ON "Vinculo"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Vinculo_atletaId_emailResponsavel_key" ON "Vinculo"("atletaId", "emailResponsavel");

-- CreateIndex
CREATE INDEX "Video_atletaId_idx" ON "Video"("atletaId");

-- CreateIndex
CREATE INDEX "Video_criadoEm_idx" ON "Video"("criadoEm");

-- CreateIndex
CREATE INDEX "Visualizacao_videoId_idx" ON "Visualizacao"("videoId");

-- CreateIndex
CREATE INDEX "Avaliacao_status_dataHora_idx" ON "Avaliacao"("status", "dataHora");

-- CreateIndex
CREATE INDEX "Avaliacao_uf_cidade_idx" ON "Avaliacao"("uf", "cidade");

-- CreateIndex
CREATE INDEX "Avaliacao_olheiroId_idx" ON "Avaliacao"("olheiroId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscricao_conviteId_key" ON "Inscricao"("conviteId");

-- CreateIndex
CREATE INDEX "Inscricao_atletaId_status_idx" ON "Inscricao"("atletaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Inscricao_avaliacaoId_atletaId_key" ON "Inscricao"("avaliacaoId", "atletaId");

-- CreateIndex
CREATE INDEX "Convite_atletaId_status_idx" ON "Convite"("atletaId", "status");

-- CreateIndex
CREATE INDEX "Convite_avaliacaoId_status_idx" ON "Convite"("avaliacaoId", "status");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lida_idx" ON "Notificacao"("usuarioId", "lida");

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_tokenPush_key" ON "Dispositivo"("tokenPush");

-- CreateIndex
CREATE INDEX "Denuncia_status_idx" ON "Denuncia"("status");

-- CreateIndex
CREATE INDEX "Denuncia_alvoTipo_alvoId_idx" ON "Denuncia"("alvoTipo", "alvoId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_tokenHash_key" ON "Token"("tokenHash");

-- CreateIndex
CREATE INDEX "Token_usuarioId_tipo_idx" ON "Token"("usuarioId", "tipo");

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olheiro" ADD CONSTRAINT "Olheiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verificacao" ADD CONSTRAINT "Verificacao_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "Olheiro"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verificacao" ADD CONSTRAINT "Verificacao_analisadaPorId_fkey" FOREIGN KEY ("analisadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visualizacao" ADD CONSTRAINT "Visualizacao_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visualizacao" ADD CONSTRAINT "Visualizacao_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "Olheiro"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "Olheiro"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "Convite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_olheiroId_fkey" FOREIGN KEY ("olheiroId") REFERENCES "Olheiro"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_analisadaPorId_fkey" FOREIGN KEY ("analisadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
