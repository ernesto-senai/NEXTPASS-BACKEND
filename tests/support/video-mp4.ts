// Caixa do formato MP4/MOV: tamanho (4 bytes) + tipo (4 letras) + conteúdo.
const caixa = (tipo: string, conteudo: Buffer) => {
  const cabecalho = Buffer.alloc(8);
  cabecalho.writeUInt32BE(8 + conteudo.length);
  cabecalho.write(tipo, 4, "latin1");
  return Buffer.concat([cabecalho, conteudo]);
};

// MP4 mínimo para os testes: só o cabeçalho com a duração (moov > mvhd), na
// escala de 1000 unidades por segundo. A caixa moov vem depois do vídeo (mdat),
// como nos arquivos gravados pelo celular.
export function videoMp4(segundos: number, { versao = 0 }: { versao?: 0 | 1 } = {}): Buffer {
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
    caixa("moov", caixa("mvhd", mvhd)),
  ]);
}
