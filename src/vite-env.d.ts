/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_SECRET_KEY?: string;
  readonly VITE_AGENT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
