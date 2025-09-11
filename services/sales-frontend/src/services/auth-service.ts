// Simplified Authentication Service - Single Source of Truth
class AuthService {
  private token: string | null = null;
  private user: any = null;
  private baseUrl = 'http://localhost:3007/api';

  constructor() {
    // Initialize from localStorage on creation
    this.token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch {}
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async checkAuth(): Promise<boolean> {
    // Quick check - if no token, not authenticated
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    
    if (!this.token || this.token === 'null' || this.token === 'undefined') {
      return false;
    }

    // Verify token with backend
    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this.user = data.user;
          localStorage.setItem('user', JSON.stringify(data.user));
          return true;
        }
      }
      
      // Token invalid, clear it
      this.logout();
      return false;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  logout(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): any {
    return this.user;
  }

  isLoggedIn(): boolean {
    return !!this.token && this.token !== 'null' && this.token !== 'undefined';
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;