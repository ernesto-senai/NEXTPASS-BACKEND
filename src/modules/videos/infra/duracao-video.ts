// Lê a duração do vídeo (MP4/MOV) no cabeçalho, na caixa moov > mvhd, sem ffmpeg.
// Retorna null se não achar o cabeçalho.
export function lerDuracaoDoVideo(arquivo: Buffer): number | null {
  try {
    const moov = acharCaixa(arquivo, "moov", 0, arquivo.length);
    const mvhd = moov && acharCaixa(arquivo, "mvhd", moov.inicio, moov.fim);
    if (!mvhd) return null;

    // Versão 0 usa campos de 32 bits; a versão 1, datas e duração de 64 bits.
    const versao = arquivo.readUInt8(mvhd.inicio);
    const escala = arquivo.readUInt32BE(mvhd.inicio + (versao === 1 ? 20 : 12));
    const duracao =
      versao === 1
        ? Number(arquivo.readBigUInt64BE(mvhd.inicio + 24))
        : arquivo.readUInt32BE(mvhd.inicio + 16);

    return escala > 0 ? duracao / escala : null;
  } catch {
    // Cabeçalho cortado ou corrompido.
    return null;
  }
}

// Procura uma caixa entre inicio e fim. Cada caixa tem tamanho (4 bytes) e tipo (4 letras).
// Tamanho 1 indica 64 bits logo depois, e 0 indica que vai até o fim.
export function acharCaixa(arquivo: Buffer, tipo: string, inicio: number, fim: number) {
  let posicao = inicio;

  while (posicao + 8 <= fim) {
    let tamanho = arquivo.readUInt32BE(posicao);
    let cabecalho = 8;
    if (tamanho === 1) {
      tamanho = Number(arquivo.readBigUInt64BE(posicao + 8));
      cabecalho = 16;
    } else if (tamanho === 0) {
      tamanho = fim - posicao;
    }
    if (tamanho < cabecalho) return null;

    if (arquivo.toString("latin1", posicao + 4, posicao + 8) === tipo) {
      return { inicio: posicao + cabecalho, fim: Math.min(posicao + tamanho, fim) };
    }
    posicao += tamanho;
  }

  return null;
}
