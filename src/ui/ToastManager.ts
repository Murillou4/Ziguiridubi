export class ToastManager {
  private container: HTMLElement | null = null;

  init(containerId: string = 'toastContainer'): void {
    this.container = document.getElementById(containerId);
  }

  show(message: string): void {
    if (!this.container) {
      this.init();
      if (!this.container) return;
    }

    const toast = document.createElement('div');
    toast.className =
      'vale-panel rounded-2xl px-3.5 py-2.5 text-xs font-medium ui-ink-honey border ui-edge-honey shadow-lg transition-all duration-300 modal-enter';
    toast.textContent = message;
    this.container.appendChild(toast);

    while (this.container.children.length > 4) {
      this.container.removeChild(this.container.firstChild!);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  }
}
