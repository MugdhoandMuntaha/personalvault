export interface ToastMessage {
  id: string;
  type: "success" | "info" | "error" | "warning";
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;

class ToastManager {
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(message: string, type: ToastMessage["type"] = "info", title?: string, duration: number = 3000) {
    const toast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      duration,
    };
    this.listeners.forEach((listener) => listener(toast));
  }

  success(message: string, title?: string) {
    this.show(message, "success", title);
  }

  info(message: string, title?: string) {
    this.show(message, "info", title);
  }

  error(message: string, title?: string) {
    this.show(message, "error", title);
  }

  warning(message: string, title?: string) {
    this.show(message, "warning", title);
  }
}

export const toast = new ToastManager();
