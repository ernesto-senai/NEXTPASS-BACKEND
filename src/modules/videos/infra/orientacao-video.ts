import { acharCaixa } from "./duracao-video.ts";

// Diz se o vídeo aparece deitado, lendo o cabeçalho de arquivos MP4 e MOV. Cada
// faixa guarda a matriz de rotação, a largura e a altura em moov > trak > tkhd.
// O que vale é como ele aparece: celulares costumam salvar o vídeo em pé como
// 1920x1080 com "gire 90°". Quadrado conta como deitado, porque cortar as
// laterais esconderia a jogada do mesmo jeito. Sem esses dados, fica como em pé.
export function videoEhHorizontal(arquivo: Buffer): boolean {
  try {
    const moov = acharCaixa(arquivo, "moov", 0, arquivo.length);
    let trak = moov && acharCaixa(arquivo, "trak", moov.inicio, moov.fim);

    while (moov && trak) {
      const tkhd = acharCaixa(arquivo, "tkhd", trak.inicio, trak.fim);
      if (tkhd) {
        // Versão 0 usa campos de 32 bits; a versão 1, datas e duração de 64 bits.
        const matriz = tkhd.inicio + (arquivo.readUInt8(tkhd.inicio) === 1 ? 52 : 40);
        const largura = arquivo.readUInt32BE(matriz + 36);
        const altura = arquivo.readUInt32BE(matriz + 40);

        // Faixas de áudio têm tamanho zero; vale a primeira com imagem.
        if (largura > 0 && altura > 0) {
          const girado =
            Math.abs(arquivo.readInt32BE(matriz + 4)) > Math.abs(arquivo.readInt32BE(matriz));
          return girado ? altura >= largura : largura >= altura;
        }
      }
      trak = acharCaixa(arquivo, "trak", trak.fim, moov.fim);
    }

    return false;
  } catch {
    // Cabeçalho cortado ou corrompido.
    return false;
  }
}
