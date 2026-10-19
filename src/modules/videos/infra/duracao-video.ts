// Lê a duração, em segundos, gravada no cabeçalho de arquivos MP4 e MOV, sem
// depender de ffmpeg. Os dois formatos guardam os dados em "caixas"; a duração
// fica na caixa moov > mvhd, que pode vir antes ou depois do vídeo em si.
// Devolve null se o arquivo não tiver esse cabeçalho (não é um vídeo válido).
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

// Procura uma caixa entre as posições inicio e fim. Cada caixa começa com o
// tamanho (4 bytes) e o tipo (4 letras); tamanho 1 indica um tamanho de 64 bits
// logo depois, e 0 indica que a caixa vai até o fim.
function acharCaixa(arquivo: Buffer, tipo: string, inicio: number, fim: number) {
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
