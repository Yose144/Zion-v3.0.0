// ─── ZION Dashboard v2 — WebSocket Manager ──────────────────────────────────
import type { WsMessage } from '../types/api';

type MessageHandler = (msg: WsMessage) => void;
type StatusHandler  = (connected: boolean) => void;

const WS_URL = `ws://${location.host}/ws`;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS  = 30_000;

class WsManager {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  connect() {
    this.intentionallyClosed = false;
    this._open();
  }

  disconnect() {
    this.intentionallyClosed = true;
    this._clearReconnect();
    this.ws?.close();
    this.ws = null;
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _open() {
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this._notifyStatus(true);
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as WsMessage;
        this.handlers.forEach(h => h(msg));
      } catch {
        // malformed frame — ignore
      }
    };

    this.ws.onerror = () => {
      // onclose will fire too and handle reconnect
    };

    this.ws.onclose = () => {
      this._notifyStatus(false);
      if (!this.intentionallyClosed) this._scheduleReconnect();
    };
  }

  private _scheduleReconnect() {
    this._clearReconnect();
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this._open(), delay);
  }

  private _clearReconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _notifyStatus(connected: boolean) {
    this.statusHandlers.forEach(h => h(connected));
  }
}

// Singleton
export const wsManager = new WsManager();
export default wsManager;
