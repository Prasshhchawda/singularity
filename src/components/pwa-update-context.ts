import { createContext, useContext } from "react";

export type PwaUpdateContextValue = {
  updateAvailable: boolean;
  serviceWorkerReady: boolean;
  serviceWorkerSupported: boolean;
  checking: boolean;
  updating: boolean;
  checkError: string | null;
  updateError: string | null;
  checkForUpdates: () => Promise<void>;
  updateNow: () => Promise<void>;
};

export const EMPTY_UPDATE_STATE: PwaUpdateContextValue = {
  updateAvailable: false,
  serviceWorkerReady: false,
  serviceWorkerSupported: false,
  checking: false,
  updating: false,
  checkError: null,
  updateError: null,
  checkForUpdates: async () => {},
  updateNow: async () => {},
};

export const PwaUpdateContext = createContext(EMPTY_UPDATE_STATE);

export function usePwaUpdate() {
  return useContext(PwaUpdateContext);
}
