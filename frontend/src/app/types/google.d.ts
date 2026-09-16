declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: GsiIdConfiguration): void;
          renderButton(parent: HTMLElement, options: GsiRenderOptions): void;
          prompt(callback?: (notification: GsiPromptNotification) => void): void;
          disableAutoSelect(): void;
        };
        oauth2: {
          initTokenClient(config: GsiTokenClientConfig): GsiTokenClient;
        };
      };
    };
  }
}

interface GsiCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

interface GsiPromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
  getDismissedReason: () => string;
}

interface GsiIdConfiguration {
  client_id: string;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  callback: (response: GsiCredentialResponse) => void;
  prompt_parent_id?: string;
  itp_support?: boolean;
  login_uri?: string;
  native_callback?: (response: GsiCredentialResponse) => void;
  nonce?: string;
  ux_mode?: 'popup' | 'redirect';
}

interface GsiRenderOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin' | 'signup_with' | 'continue_with' | 'signin_with';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
  click_listener?: () => void;
}

interface GsiTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GsiTokenClientResponse) => void;
  error_callback?: (error: Error) => void;
  prompt?: '' | 'consent' | 'select_account';
  hint?: string;
  ux_mode?: 'popup' | 'redirect';
  redirect_uri?: string;
}

interface GsiTokenClientResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface GsiTokenClient {
  requestAccessToken(intermediate?: GsiIntermediateValue): void;
}

interface GsiIntermediateValue {
  hint?: string;
  prompt?: string;
}

export {};