/**
 * AlertBus
 *
 * Cola FIFO + event emitter mínimo que conecta el wrapper imperativo
 * `Alert.alert` / `Alert.prompt` (src/utils/alert.ts) con el componente
 * <AlertHost /> que renderiza un Modal cross-platform.
 *
 * Permite:
 *  - Encolar múltiples alerts sin que se pisen (bug Android nativo).
 *  - Mismo flujo en Android, iOS, Web y Electron (sin window.alert).
 */

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButtonSpec {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AlertButtonStyle;
}

export type AlertKind = 'alert' | 'prompt';

export type AlertPromptType = 'default' | 'plain-text' | 'secure-text' | 'login-password';

export interface AlertRequest {
  id: number;
  kind: AlertKind;
  title: string;
  message?: string;
  buttons?: AlertButtonSpec[];
  cancelable?: boolean;
  // prompt-only
  defaultValue?: string;
  promptType?: AlertPromptType;
  keyboardType?: string;
  promptCallback?: (text: string) => void;
}

type Listener = (request: AlertRequest | null) => void;

let nextId = 1;
const queue: AlertRequest[] = [];
let current: AlertRequest | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) {
    try {
      l(current);
    } catch {
      // No-op: un listener no debe romper al resto
    }
  }
}

function advance() {
  current = queue.shift() ?? null;
  emit();
}

export const alertBus = {
  enqueue(req: Omit<AlertRequest, 'id'>): number {
    const id = nextId++;
    const full: AlertRequest = { id, ...req };
    if (current) {
      queue.push(full);
    } else {
      current = full;
      emit();
    }
    return id;
  },

  /**
   * Resuelve el alert actual ejecutando el callback del botón indicado y
   * avanza a la siguiente petición de la cola.
   */
  resolve(id: number, buttonIndex: number | null, value?: string): void {
    if (!current || current.id !== id) return;
    const req = current;
    // Avanzar primero para que el callback pueda encolar otro alert sin estado inconsistente
    advance();
    try {
      if (req.kind === 'prompt' && typeof req.promptCallback === 'function') {
        if (buttonIndex === null) return;
        req.promptCallback(value ?? '');
        return;
      }
      if (!req.buttons || req.buttons.length === 0) return;
      if (buttonIndex === null) return;
      const btn = req.buttons[buttonIndex];
      if (btn?.onPress) {
        btn.onPress(req.kind === 'prompt' ? value : undefined);
      }
    } catch (err) {
      // Silenciar errores del callback para no romper la cola
      if (typeof console !== 'undefined') {
        console.error('[alertBus] callback error:', err);
      }
    }
  },

  /**
   * Cierra el alert actual sin ejecutar callbacks (back-button con cancelable,
   * o desmontaje del host). Si hay un botón con style="cancel", lo dispara.
   */
  dismiss(id: number): void {
    if (!current || current.id !== id) return;
    const req = current;
    advance();
    try {
      if (req.kind === 'prompt') return;
      const cancelIdx = req.buttons?.findIndex((b) => b.style === 'cancel') ?? -1;
      if (cancelIdx >= 0 && req.buttons![cancelIdx].onPress) {
        req.buttons![cancelIdx].onPress!();
      }
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('[alertBus] dismiss callback error:', err);
      }
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    // Emitir estado actual al suscribirse
    try {
      listener(current);
    } catch {
      // No-op
    }
    return () => {
      listeners.delete(listener);
    };
  },

  getCurrent(): AlertRequest | null {
    return current;
  },
};

export default alertBus;
