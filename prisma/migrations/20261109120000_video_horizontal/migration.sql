-- Vídeo deitado: o feed mostra inteiro, sem cortar. Lido do arquivo no envio.
ALTER TABLE "Video" ADD COLUMN "horizontal" BOOLEAN NOT NULL DEFAULT false;
