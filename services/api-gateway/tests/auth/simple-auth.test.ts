import { SimpleAuthService } from '../../src/auth/simple-auth';

describe('SimpleAuthService', () => {
  let authService: SimpleAuthService;

  beforeEach(() => {
    authService = new SimpleAuthService();
  });

  describe('login', () => {
    it('should authenticate admin user successfully', async () => {
      const result = await authService.login('admin', 'admin123');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('admin');
      expect(result.user.role).toBe('admin');
    });

    it('should authenticate regular user successfully', async () => {
      const result = await authService.login('user', 'user123');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('user');
      expect(result.user.role).toBe('user');
    });

    it('should reject invalid username', async () => {
      const result = await authService.login('invalid', 'password');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
      expect(result.token).toBeUndefined();
    });

    it('should reject invalid password', async () => {
      const result = await authService.login('admin', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
      expect(result.token).toBeUndefined();
    });

    it('should reject empty credentials', async () => {
      const result = await authService.login('', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const loginResult = await authService.login('admin', 'admin123');
      const token = loginResult.token!;
      
      const validationResult = await authService.validateToken(token);
      
      expect(validationResult).toBeDefined();
      expect(validationResult.valid).toBe(true);
      expect(validationResult.user).toBeDefined();
      expect(validationResult.user.username).toBe('admin');
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      const validationResult = await authService.validateToken(invalidToken);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.user).toBeUndefined();
    });

    it('should reject an expired token', async () => {
      // Create a token with very short expiry
      const expiredToken = authService.generateToken(
        { id: '1', username: 'test', role: 'user' },
        '0s' // Expires immediately
      );
      
      // Wait a moment to ensure expiry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const validationResult = await authService.validateToken(expiredToken);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('expired');
    });

    it('should reject a malformed token', async () => {
      const malformedToken = 'not-a-jwt-token';
      
      const validationResult = await authService.validateToken(malformedToken);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
      const loginResult = await authService.login('admin', 'admin123');
      const originalToken = loginResult.token!;
      
      const refreshResult = await authService.refreshToken(originalToken);
      
      expect(refreshResult).toBeDefined();
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.token).toBeDefined();
      expect(refreshResult.token).not.toBe(originalToken); // Should be a new token
      expect(refreshResult.user).toBeDefined();
      expect(refreshResult.user.username).toBe('admin');
    });

    it('should reject refreshing an invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      const refreshResult = await authService.refreshToken(invalidToken);
      
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBeDefined();
      expect(refreshResult.token).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('should logout a user successfully', async () => {
      const loginResult = await authService.login('admin', 'admin123');
      const token = loginResult.token!;
      
      const logoutResult = await authService.logout(token);
      
      expect(logoutResult).toBeDefined();
      expect(logoutResult.success).toBe(true);
      expect(logoutResult.message).toContain('logged out');
    });

    it('should handle logout with invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      const logoutResult = await authService.logout(invalidToken);
      
      // Should still return success (idempotent operation)
      expect(logoutResult.success).toBe(true);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', () => {
      const user = authService.getUserById('1');
      
      expect(user).toBeDefined();
      expect(user!.id).toBe('1');
      expect(user!.username).toBe('admin');
      expect(user!.role).toBe('admin');
    });

    it('should return null for non-existent user', () => {
      const user = authService.getUserById('999');
      
      expect(user).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', () => {
      const user = authService.getUserByUsername('admin');
      
      expect(user).toBeDefined();
      expect(user!.username).toBe('admin');
      expect(user!.role).toBe('admin');
    });

    it('should return null for non-existent username', () => {
      const user = authService.getUserByUsername('nonexistent');
      
      expect(user).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('should check if user has specific role', () => {
      const adminUser = { id: '1', username: 'admin', role: 'admin' };
      const regularUser = { id: '2', username: 'user', role: 'user' };
      
      expect(authService.hasRole(adminUser, 'admin')).toBe(true);
      expect(authService.hasRole(adminUser, 'user')).toBe(false);
      expect(authService.hasRole(regularUser, 'user')).toBe(true);
      expect(authService.hasRole(regularUser, 'admin')).toBe(false);
    });

    it('should check if user has any of multiple roles', () => {
      const adminUser = { id: '1', username: 'admin', role: 'admin' };
      
      expect(authService.hasRole(adminUser, ['admin', 'user'])).toBe(true);
      expect(authService.hasRole(adminUser, ['user', 'guest'])).toBe(false);
    });
  });

  describe('generateApiKey', () => {
    it('should generate a valid API key', () => {
      const userId = '1';
      const apiKey = authService.generateApiKey(userId);
      
      expect(apiKey).toBeDefined();
      expect(apiKey.length).toBeGreaterThan(20);
      expect(apiKey).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique API keys', () => {
      const key1 = authService.generateApiKey('1');
      const key2 = authService.generateApiKey('1');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateApiKey', () => {
    it('should validate a valid API key', () => {
      const userId = '1';
      const apiKey = authService.generateApiKey(userId);
      authService.storeApiKey(userId, apiKey);
      
      const result = authService.validateApiKey(apiKey);
      
      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(userId);
    });

    it('should reject an invalid API key', () => {
      const result = authService.validateApiKey('invalid-api-key');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.userId).toBeUndefined();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', () => {
      const userId = '1';
      const apiKey = authService.generateApiKey(userId);
      authService.storeApiKey(userId, apiKey);
      
      const revokeResult = authService.revokeApiKey(apiKey);
      expect(revokeResult.success).toBe(true);
      
      const validateResult = authService.validateApiKey(apiKey);
      expect(validateResult.valid).toBe(false);
    });

    it('should handle revoking non-existent API key', () => {
      const result = authService.revokeApiKey('non-existent-key');
      
      // Should still return success (idempotent)
      expect(result.success).toBe(true);
    });
  });
});