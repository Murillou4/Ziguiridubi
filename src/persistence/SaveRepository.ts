export class SaveRepository {
  private readonly storageKey = 'oficina_do_vale_save_v2';

  saveRaw(jsonString: string): boolean {
    try {
      localStorage.setItem(this.storageKey, jsonString);
      return true;
    } catch (e) {
      console.warn('Não foi possível gravar no localStorage (modo privado ou cota esgotada):', e);
      return false;
    }
  }

  loadRaw(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch (e) {
      console.warn('Não foi possível ler do localStorage:', e);
      return null;
    }
  }

  clear(): boolean {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (e) {
      console.warn('Não foi possível limpar o localStorage:', e);
      return false;
    }
  }
}
