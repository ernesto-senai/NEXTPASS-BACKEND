// Caixa do formato MP4/MOV: tamanho (4 bytes) + tipo (4 letras) + conteúdo.
const caixa = (tipo: string, conteudo: Buffer) => {
  const cabecalho = Buffer.alloc(8);
  cabecalho.writeUInt32BE(8 + conteudo.length);
  cabecalho.write(tipo, 4, "latin1");
  return Buffer.concat([cabecalho, conteudo]);
};

// Faixa do vídeo (trak > tkhd), com a matriz de rotação e o tamanho em ponto fixo
// (0x10000 vale 1). Girar 90° troca a diagonal da matriz pela outra.
const faixa = (versao: 0 | 1, largura: number, altura: number, girado = false) => {
  const matriz = versao === 1 ? 52 : 40;
  const tkhd = Buffer.alloc(matriz + 44);
  tkhd.writeUInt8(versao, 0);
  tkhd.writeInt32BE(girado ? 0 : 0x10000, matriz);
  tkhd.writeInt32BE(girado ? 0x10000 : 0, matriz + 4);
  tkhd.writeInt32BE(girado ? -0x10000 : 0, matriz + 12);
  tkhd.writeInt32BE(girado ? 0 : 0x10000, matriz + 16);
  tkhd.writeUInt32BE(largura * 0x10000, matriz + 36);
  tkhd.writeUInt32BE(altura * 0x10000, matriz + 40);
  return caixa("trak", caixa("tkhd", tkhd));
};

// MP4 mínimo para os testes: cabeçalho com a duração (moov > mvhd) e, se pedido,
// faixas de áudio e de imagem. O moov vem depois do mdat, como no celular.
export function videoMp4(
  segundos: number,
  {
    versao = 0,
    imagem,
  }: {
    versao?: 0 | 1;
    imagem?: { largura: number; altura: number; girado?: boolean };
  } = {},
): Buffer {
  const mvhd = Buffer.alloc(versao === 1 ? 32 : 20);
  mvhd.writeUInt8(versao, 0);
  if (versao === 1) {
    mvhd.writeUInt32BE(1000, 20);
    mvhd.writeBigUInt64BE(BigInt(Math.round(segundos * 1000)), 24);
  } else {
    mvhd.writeUInt32BE(1000, 12);
    mvhd.writeUInt32BE(Math.round(segundos * 1000), 16);
  }

  return Buffer.concat([
    caixa("ftyp", Buffer.from("isom")),
    caixa("mdat", Buffer.alloc(64)),
    caixa(
      "moov",
      Buffer.concat([
        caixa("mvhd", mvhd),
        ...(imagem
          ? [faixa(versao, 0, 0), faixa(versao, imagem.largura, imagem.altura, imagem.girado)]
          : []),
      ]),
    ),
  ]);
}
