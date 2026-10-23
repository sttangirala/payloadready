// Preload: exposes a fixed, typed API to the sandboxed renderer. No Node or Electron objects leak.

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { API_METHODS } from '../shared/ipc';
import type { Api, ApiEvent, Bridge } from '../shared/ipc';

const api = Object.fromEntries(
  API_METHODS.map((name) => [
    name,
    async (...args: unknown[]) => {
      const res = await ipcRenderer.invoke(`st:${name}`, ...args);
      if (res && typeof res === 'object' && '__error' in res) {
        const err = new Error((res as { __error: string }).__error);
        err.name = (res as { name?: string }).name ?? 'Error';
        throw err;
      }
      return res;
    },
  ]),
) as unknown as Api;

const EVENTS: ApiEvent[] = ['changed', 'quick-capture', 'open-task'];

const bridge: Bridge = {
  api,
  on(event, cb) {
    if (!EVENTS.includes(event)) return () => {};
    const listener = (_e: IpcRendererEvent, payload?: unknown) => cb(payload);
    ipcRenderer.on(`st:event:${event}`, listener);
    return () => ipcRenderer.removeListener(`st:event:${event}`, listener);
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('stWorkHub', bridge);
