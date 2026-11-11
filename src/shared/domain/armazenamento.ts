// Onde ficam os arquivos enviados pelo app: a pasta uploads ou um serviço na internet.
export interface Armazenamento {
  // Guarda o arquivo com um nome único e devolve a URL para acessá-lo. O tipo (MIME)
  // faz o navegador tocar o vídeo e mostrar a foto direito.
  salvar(arquivo: {
    pasta: string;
    extensao: string;
    tipo: string;
    conteudo: Buffer;
  }): Promise<string>;
  remover(url: string): Promise<void>;
  // Conteúdo de um arquivo guardado (ex.: documento privado para o
  // administrador); null se ele não existe mais.
  ler(url: string): Promise<Buffer | null>;
}
