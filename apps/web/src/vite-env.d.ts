/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCK_CARDS: string;
  readonly VITE_FACEBOOK_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
