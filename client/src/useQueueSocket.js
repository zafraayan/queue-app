import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useQueueSocket(mode, onEvent) {
  const [connected,setConnected] = useState(false);
  useEffect(() => {
    // WebSocket handshakes include Origin even through the same-origin Vite proxy.
    const socket = io('/', { transports:['websocket','polling'], withCredentials:true, auth: {mode}, reconnection:true });
    socket.on('connect', () => {setConnected(true);onEvent?.('refresh');});
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', error => {
      console.error('Queue connection failed:', error.message);
      setConnected(false);
    });
    socket.on('queue:changed', e => onEvent?.('queue:changed',e));
    socket.on('queue:summary-changed', () => onEvent?.('refresh'));
    socket.on('display:changed', () => onEvent?.('refresh'));
    socket.on('display:announce', e => onEvent?.('announce',e));
    return () => socket.disconnect();
  },[mode,onEvent]);
  return connected;
}
