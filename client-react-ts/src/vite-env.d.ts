/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Public Stripe Payment Link URL (buy.stripe.com / donate.stripe.com). */
  readonly VITE_STRIPE_DONATE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
