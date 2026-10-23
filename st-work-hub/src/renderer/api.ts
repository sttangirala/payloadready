import type { Bridge } from '../shared/ipc';

declare global {
  interface Window {
    stWorkHub?: Bridge;
  }
}

export const bridge = (): Bridge => {
  if (!window.stWorkHub) throw new Error('ST Work Hub must run inside its desktop window.');
  return window.stWorkHub;
};
export const api = () => bridge().api;
