import type { Armazenamento } from "../../../shared/domain/armazenamento.ts";
import { AppError } from "../../../shared/errors/app-error.ts";
import {
  DURACAO_LANCE,
  FORMATOS_LANCE,
  type FormatoLance,
  type Lance,
  type LanceRepository,
} from "../domain/lance.ts";

export interface DadosDoLance {
  atletaId: string;
  video: { conteudo: Buffer; formato: FormatoLance };
  legenda?: string | undefined;
  localizacao?: string | undefined;
}

export type PublicarLance = (dados: DadosDoLance) => Promise<Lance>;

// RF-25 e RF-29: publicar lance. A duração (RN-09) e a orientação são lidas do
// próprio arquivo, não do que o app manda.
export function criarPublicarLance(deps: {
  lances: LanceRepository;
  armazenamento: Armazenamento;
  lerDuracao: (video: Buffer) => number | null;
  ehHorizontal: (video: Buffer) => boolean;
}): PublicarLance {
  return async ({ atletaId, video, legenda, localizacao }) => {
    const duracao = deps.lerDuracao(video.conteudo);
    if (duracao === null) {
      throw new AppError("DADOS_INVALIDOS", "Não foi possível ler o vídeo. Envie um MP4 ou MOV.");
    }

    const duracaoSeg = Math.round(duracao);
    if (duracaoSeg < DURACAO_LANCE.min || duracaoSeg > DURACAO_LANCE.max) {
      throw new AppError(
        "DURACAO_VIDEO_INVALIDA",
        `O lance precisa ter de ${DURACAO_LANCE.min} a ${DURACAO_LANCE.max} segundos.`,
      );
    }

    const url = await deps.armazenamento.salvar({
      pasta: "videos",
      extensao: FORMATOS_LANCE[video.formato],
      tipo: video.formato,
      conteudo: video.conteudo,
    });

    try {
      return await deps.lances.criar({
        atletaId,
        url,
        duracaoSeg,
        horizontal: deps.ehHorizontal(video.conteudo),
        legenda: legenda || null,
        localizacao: localizacao || null,
      });
    } catch (erro) {
      // Sem o registro no banco, o arquivo ficaria órfão.
      await deps.armazenamento.remover(url);
      throw erro;
    }
  };
}
