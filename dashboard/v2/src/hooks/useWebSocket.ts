// ─── useWebSocket — connects the WS manager to Zustand stores ────────────────
import { useEffect } from 'react';
import wsManager from '../ws/manager';
import { useStatusStore } from '../stores/statusStore';
import { useLogStore }    from '../stores/logStore';
import { useAlertStore }  from '../stores/alertStore';
import type { WsMessage } from '../types/api';

export function useWebSocket() {
  const applyStatus  = useStatusStore((s) => s.applyWsStatus);
  const applyHealth  = useStatusStore((s) => s.applyWsHealth);
  const setConnected = useStatusStore((s) => s.setConnected);
  const appendLine   = useLogStore((s) => s.appendLine);
  const appendAlert  = useAlertStore((s) => s.appendAlert);

  useEffect(() => {
    wsManager.connect();

    const unsubMsg    = wsManager.onMessage((msg: WsMessage) => {
      switch (msg.type) {
        case 'status': applyStatus(msg.data); break;
        case 'health': applyHealth(msg.data); break;
        case 'log':    appendLine(msg.service, msg.line, msg.ts); break;
        case 'alert':  appendAlert(msg.data); break;
      }
    });

    const unsubStatus = wsManager.onStatus(setConnected);

    return () => {
      unsubMsg();
      unsubStatus();
      wsManager.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
