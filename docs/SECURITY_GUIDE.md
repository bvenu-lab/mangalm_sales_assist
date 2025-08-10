# Mangalm Security Guide

## Security Overview

The Mangalm Sales Assistant implements enterprise-grade security using defense-in-depth principles with multiple security layers, secure coding practices, and comprehensive monitoring.

## Authentication & Authorization

### JWT Implementation
- Secure token generation with HS256 algorithm
- Short-lived access tokens (1 hour)
- Refresh token rotation
- Token revocation support

### Role-Based Access Control (RBAC)
- Admin: Full system access
- Manager: Store and agent management
- Agent: Limited store access
- Viewer: Read-only permissions

### Password Security
- Minimum 8 characters with complexity requirements
- bcrypt hashing with salt rounds = 12
- Password history tracking
- Account lockout after 5 failed attempts

## Data Security

### Encryption
- **At Rest**: AES-256 encryption for sensitive data
- **In Transit**: TLS 1.3 for all communications
- **Database**: Transparent data encryption (TDE)

### Data Classification
- **Public**: Store names, product names
- **Internal**: Order details, predictions
- **Confidential**: User credentials, API keys
- **Restricted**: Payment information, personal data

## API Security

### Input Validation
- Joi schema validation for all inputs
- XSS protection with input sanitization
- SQL injection prevention with parameterized queries
- File upload restrictions and scanning

### Rate Limiting
- 100 requests per minute per IP
- Sliding window algorithm
- Different limits for different endpoints
- User-based rate limiting for authenticated requests

### Security Headers
```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
})
```

## Infrastructure Security

### Network Security
- Firewall rules restricting unnecessary ports
- Network segmentation between services
- VPN access for remote administration
- Regular security scanning

### Container Security
- Non-root user execution
- Minimal base images (Alpine Linux)
- Regular security updates
- Container image scanning

## Monitoring & Incident Response

### Security Monitoring
- Failed authentication attempts
- Unusual access patterns
- Privilege escalation attempts
- Data exfiltration indicators

### Incident Response
1. **Detection**: Automated monitoring alerts
2. **Containment**: Immediate threat isolation
3. **Investigation**: Log analysis and forensics
4. **Recovery**: System restoration procedures
5. **Lessons Learned**: Security improvements

## Compliance & Best Practices

### Data Protection
- GDPR compliance for EU users
- Data retention policies
- Right to deletion implementation
- Privacy by design principles

### Security Testing
- Regular penetration testing
- Automated security scanning
- Code security reviews
- Vulnerability assessments

---

*Security Guide Version: 1.0.0*  
*Last Updated: 2025-08-10*