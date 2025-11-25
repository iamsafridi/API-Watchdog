/**
 * Tests for security analysis functionality
 */

// Import the security analysis function from the background script
const { analyzeSecurityIssues } = require('../background');

describe('Security Analysis', () => {
  test('should detect insecure HTTP protocol', () => {
    const apiCall = {
      url: 'http://example.com/api/data',
      method: 'GET',
      response: {
        status: 200,
        headers: {}
      }
    };

    const issues = analyzeSecurityIssues(apiCall);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'INSECURE_PROTOCOL',
        severity: 'high'
      })
    );
  });

  test('should not flag localhost as insecure', () => {
    const apiCall = {
      url: 'http://localhost:3000/api/data',
      method: 'GET',
      response: {
        status: 200,
        headers: {}
      }
    };

    const issues = analyzeSecurityIssues(apiCall);
    const insecureProtocol = issues.some(issue => issue.code === 'INSECURE_PROTOCOL');
    expect(insecureProtocol).toBe(false);
  });

  test('should detect sensitive data in URL', () => {
    const apiCall = {
      url: 'https://api.example.com/login?username=test&password=secret123',
      method: 'GET',
      response: {
        status: 200,
        headers: {}
      }
    };

    const issues = analyzeSecurityIssues(apiCall);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'SENSITIVE_DATA_IN_URL',
        severity: 'high'
      })
    );
  });

  test('should detect missing security headers', () => {
    const apiCall = {
      url: 'https://example.com/api/data',
      method: 'GET',
      response: {
        status: 200,
        headers: {
          'content-type': 'application/json'
          // Missing security headers
        }
      }
    };

    const issues = analyzeSecurityIssues(apiCall);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_SECURITY_HEADERS',
        severity: 'medium'
      })
    );
  });

  test('should detect CORS issues', () => {
    const apiCall = {
      url: 'https://api.example.com/data',
      method: 'GET',
      response: {
        status: 200,
        headers: {
          'content-type': 'application/json'
          // Missing CORS headers
        }
      }
    };

    const issues = analyzeSecurityIssues(apiCall);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_CORS_HEADERS',
        severity: 'medium'
      })
    );
  });

  test('should detect sensitive information in response', () => {
    const apiCall = {
      url: 'https://api.example.com/error',
      method: 'GET',
      response: {
        status: 500,
        headers: {
          'content-type': 'text/plain'
        },
        body: 'Error: Database connection failed at /app/db/connect.js:42:15\n    at Connection.<anonymous> (/app/services/db.js:12:5)'
      }
    };

    const issues = analyzeSecurityIssues(apiCall);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'SENSITIVE_INFO_LEAK',
        severity: 'high'
      })
    );
  });
});
