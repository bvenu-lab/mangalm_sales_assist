describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  describe('Login', () => {
    it('should display login form', () => {
      cy.get('[data-testid="login-form"]').should('be.visible');
      cy.get('input[name="username"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible').and('contain', 'Login');
    });

    it('should login with valid admin credentials', () => {
      cy.get('input[name="username"]').type('admin');
      cy.get('input[name="password"]').type('admin123');
      cy.get('button[type="submit"]').click();

      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-menu"]').should('contain', 'admin');
      
      // Check localStorage for token
      cy.window().then((win) => {
        expect(win.localStorage.getItem('auth-token')).to.exist;
        expect(JSON.parse(win.localStorage.getItem('user')!)).to.have.property('role', 'admin');
      });
    });

    it('should login with valid user credentials', () => {
      cy.get('input[name="username"]').type('user');
      cy.get('input[name="password"]').type('user123');
      cy.get('button[type="submit"]').click();

      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-menu"]').should('contain', 'user');
    });

    it('should show error with invalid credentials', () => {
      cy.get('input[name="username"]').type('invalid');
      cy.get('input[name="password"]').type('wrong');
      cy.get('button[type="submit"]').click();

      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Invalid credentials');
      
      cy.url().should('include', '/login');
    });

    it('should validate required fields', () => {
      cy.get('button[type="submit"]').click();
      
      cy.get('[data-testid="username-error"]')
        .should('be.visible')
        .and('contain', 'Username is required');
      
      cy.get('[data-testid="password-error"]')
        .should('be.visible')
        .and('contain', 'Password is required');
    });

    it('should handle login with Enter key', () => {
      cy.get('input[name="username"]').type('admin');
      cy.get('input[name="password"]').type('admin123{enter}');
      
      cy.url().should('include', '/dashboard');
    });

    it('should show/hide password visibility', () => {
      cy.get('input[name="password"]').should('have.attr', 'type', 'password');
      cy.get('[data-testid="toggle-password-visibility"]').click();
      cy.get('input[name="password"]').should('have.attr', 'type', 'text');
      cy.get('[data-testid="toggle-password-visibility"]').click();
      cy.get('input[name="password"]').should('have.attr', 'type', 'password');
    });

    it('should remember me functionality', () => {
      cy.get('input[name="username"]').type('admin');
      cy.get('input[name="password"]').type('admin123');
      cy.get('input[name="rememberMe"]').check();
      cy.get('button[type="submit"]').click();

      cy.url().should('include', '/dashboard');
      
      // Check if token persists after page reload
      cy.reload();
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-menu"]').should('contain', 'admin');
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      cy.login();
      cy.visit('/dashboard');
    });

    it('should logout successfully', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();

      cy.url().should('include', '/login');
      
      // Check localStorage is cleared
      cy.window().then((win) => {
        expect(win.localStorage.getItem('auth-token')).to.be.null;
        expect(win.localStorage.getItem('user')).to.be.null;
      });
    });

    it('should redirect to login when accessing protected route after logout', () => {
      cy.logout();
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route without auth', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
      cy.get('[data-testid="redirect-message"]')
        .should('be.visible')
        .and('contain', 'Please login to continue');
    });

    it('should allow access to protected routes with valid auth', () => {
      cy.login();
      
      const protectedRoutes = [
        '/dashboard',
        '/stores',
        '/predictions',
        '/orders',
        '/performance',
      ];

      protectedRoutes.forEach((route) => {
        cy.visit(route);
        cy.url().should('include', route);
      });
    });

    it('should handle role-based access control', () => {
      // Login as regular user
      cy.login('user', 'user123');
      
      // Try to access admin-only route
      cy.visit('/admin/settings');
      
      cy.get('[data-testid="access-denied"]')
        .should('be.visible')
        .and('contain', 'You do not have permission to access this page');
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout', () => {
      cy.login();
      cy.visit('/dashboard');
      
      // Simulate session timeout by clearing token
      cy.window().then((win) => {
        win.localStorage.removeItem('auth-token');
      });
      
      // Try to make an API call
      cy.get('[data-testid="refresh-data"]').click();
      
      cy.get('[data-testid="session-expired"]')
        .should('be.visible')
        .and('contain', 'Session expired. Please login again.');
      
      cy.url().should('include', '/login');
    });

    it('should refresh token automatically', () => {
      cy.login();
      cy.visit('/dashboard');
      
      // Wait for token refresh interval (mock)
      cy.clock();
      cy.tick(3600000); // 1 hour
      
      // Token should be refreshed automatically
      cy.window().then((win) => {
        const token = win.localStorage.getItem('auth-token');
        expect(token).to.exist;
      });
    });
  });

  describe('Password Reset', () => {
    it('should navigate to password reset page', () => {
      cy.get('[data-testid="forgot-password-link"]').click();
      cy.url().should('include', '/forgot-password');
      cy.get('[data-testid="password-reset-form"]').should('be.visible');
    });

    it('should send password reset email', () => {
      cy.visit('/forgot-password');
      cy.get('input[name="email"]').type('admin@example.com');
      cy.get('button[type="submit"]').click();
      
      cy.get('[data-testid="success-message"]')
        .should('be.visible')
        .and('contain', 'Password reset link sent to your email');
    });

    it('should validate email format', () => {
      cy.visit('/forgot-password');
      cy.get('input[name="email"]').type('invalid-email');
      cy.get('button[type="submit"]').click();
      
      cy.get('[data-testid="email-error"]')
        .should('be.visible')
        .and('contain', 'Please enter a valid email address');
    });
  });
});