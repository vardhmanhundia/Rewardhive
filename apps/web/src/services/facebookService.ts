/**
 * Facebook authentication service for handling OAuth flow
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';

export interface FacebookLoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    created_at: string;
    is_active: boolean;
  };
}

class FacebookService {
  private tokenKey = 'auth_token';

  /**
   * Initialize Facebook SDK
   */
  initializeFacebook(): void {
    if (!FACEBOOK_APP_ID) {
      console.error('VITE_FACEBOOK_APP_ID is not configured');
      return;
    }

    if (typeof window.FB === 'undefined') {
      console.error('Facebook SDK not loaded');
      return;
    }

    window.FB.init({
      appId: FACEBOOK_APP_ID,
      xfbml: false,
      version: 'v18.0',
    });
  }

  /**
   * Get Facebook access token
   */
  async getAccessToken(): Promise<string | null> {
    return new Promise((resolve) => {
      if (typeof window.FB === 'undefined') {
        resolve(null);
        return;
      }

      window.FB.login(
        (response) => {
          if (response.authResponse) {
            resolve(response.authResponse.accessToken);
          } else {
            resolve(null);
          }
        },
        { scope: 'public_profile,email' }
      );
    });
  }

  /**
   * Get Facebook user info
   */
  async getFacebookUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null> {
    return new Promise((resolve) => {
      if (typeof window.FB === 'undefined') {
        resolve(null);
        return;
      }

      window.FB.api('/me', { fields: 'id,email,first_name,last_name', access_token: accessToken }, (response) => {
        if (response.error) {
          console.error('Facebook API error:', response.error);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Login with Facebook
   */
  async loginWithFacebook(): Promise<FacebookLoginResponse> {
    // Get access token from Facebook
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Failed to get Facebook access token');
    }

    // Get user info from Facebook
    const userInfo = await this.getFacebookUserInfo(accessToken);
    if (!userInfo) {
      throw new Error('Failed to get Facebook user info');
    }

    // Send to backend for authentication
    const response = await fetch(`${API_URL}/auth/facebook/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        email: userInfo.email,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Facebook login failed');
    }

    const authData: FacebookLoginResponse = await response.json();
    this.setToken(authData.access_token);
    return authData;
  }

  /**
   * Store token
   */
  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
}

export default new FacebookService();

// Extend window to include Facebook SDK types
declare global {
  interface Window {
    FB: any;
  }
}
