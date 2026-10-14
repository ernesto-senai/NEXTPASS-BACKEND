// Onde ficam os arquivos enviados pelo app (no desenvolvimento, uma pasta local).
export interface Armazenamento {
  // Guarda o arquivo com um nome único e devolve a URL para acessá-lo.
  salvar(arquivo: { pasta: string; extensao: string; conteudo: Buffer }): Promise<string>;
  remover(url: string): Promise<void>;
}
