// API Watchdog - Background Service Worker
const apiCallsByTab = new Map();
const pageApiMapByTab = new Map();
let currentInspectedTabId = null;
const pageUrlByTab = new Map(); // Track page URL to detect reloads

console.log('Background: Service worker started');

// Keep service worker alive
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(() => {
    console.log('Background: Keep-alive ping');
  }, 20000); // Ping every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive immediately
startKeepAlive();

// Listen for connections from DevTools to keep service worker alive
chrome.runtime.onConnect.addListener((port) => {
  console.log('Background: DevTools connected');
  
  port.onDisconnect.addListener(() => {
    console.log('Background: DevTools disconnected');
  });
  
  // Keep the port alive
  port.onMessage.addListener((msg) => {
    if (msg.type === 'KEEP_ALIVE') {
      port.postMessage({ type: 'ALIVE' });
    }
  });
});

// Listen for page navigation/reload to clear API calls
// Only clear on full page reloads, not on SPA route changes
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0 && details.transitionType === 'reload') {
    const tabId = details.tabId;
    console.log('Background: Page reload detected on tab', tabId);
    console.log('Background: Clearing API calls due to page reload');
    apiCallsByTab.set(tabId, []);
    pageApiMapByTab.set(tabId, new Map());
    chrome.storage.local.remove([`tab_${tabId}_calls`, `tab_${tabId}_map`]);
  }
});

// Listen for DevTools panel to register which tab it's inspecting
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background: Received message type:', request.type);
  
  if (request.type === 'DEVTOOLS_INIT') {
    currentInspectedTabId = request.tabId;
    console.log('Background: DevTools registered for tab:', currentInspectedTabId);
    
    // Load persisted data for this tab from storage
    chrome.storage.local.get([`tab_${request.tabId}_calls`, `tab_${request.tabId}_map`], (result) => {
      const tabId = request.tabId;
      const tabCallsKey = `tab_${tabId}_calls`;
      const tabMapKey = `tab_${tabId}_map`;
      
      if (result[tabCallsKey]?.length) {
        apiCallsByTab.set(tabId, result[tabCallsKey]);
        console.log('Background: Loaded', result[tabCallsKey].length, 'persisted calls');
      } else {
        apiCallsByTab.set(tabId, []);
      }
      
      if (result[tabMapKey]?.length) {
        pageApiMapByTab.set(tabId, new Map(result[tabMapKey]));
        console.log('Background: Loaded persisted page map');
      } else {
        pageApiMapByTab.set(tabId, new Map());
      }
      
      sendResponse({ success: true });
    });
    
    return true;
  } 
  
  if (request.type === 'API_CAPTURED') {
    // Handle both content script (sender.tab) and DevTools (no sender.tab)
    const tabId = sender.tab?.id || currentInspectedTabId;
    console.log('Background: API_CAPTURED from tab', tabId, 'current inspected:', currentInspectedTabId, 'sender:', sender.url ? 'content-script' : 'devtools');
    
    // If no tabId, we can't process this
    if (!tabId) {
      console.log('Background: No tab ID available');
      sendResponse({ success: false });
      return true;
    }
    
    // Accept from DevTools (no sender.tab) or from the inspected tab
    const isFromDevTools = !sender.tab;
    const isFromInspectedTab = tabId === currentInspectedTabId;
    
    if (!isFromDevTools && !isFromInspectedTab) {
      console.log('Background: Ignoring API from non-inspected tab');
      sendResponse({ success: false });
      return true;
    }
    
    if (!apiCallsByTab.has(tabId)) {
      console.log('Background: Initializing data for tab', tabId);
      apiCallsByTab.set(tabId, []);
      pageApiMapByTab.set(tabId, new Map());
    }
    
    const call = {
      ...request.data,
      tabId: tabId,
      pageUrl: sender.url || request.data.url, // Use request URL if no sender URL
      securityIssues: [] // Initialize empty array
    };
    
    // Analyze security - always run this
    try {
      const issues = analyzeSecurityIssues(call);
      call.securityIssues = Array.isArray(issues) ? issues : [];
      console.log('Background: Found', call.securityIssues.length, 'security issues for', call.method, call.url);
    } catch (e) {
      console.error('Background: Error analyzing security:', e);
      call.securityIssues = [];
    }
    
    // Map page to API
    mapPageToApi(tabId, call.pageUrl, call);
    
    // Store call
    const tabCalls = apiCallsByTab.get(tabId);
    tabCalls.push(call);
    console.log('Background: Total calls for tab', tabId, ':', tabCalls.length);
    
    // Keep only last 100 calls
    if (tabCalls.length > 100) {
      tabCalls.shift();
    }
    
    // Save to storage
    const pageMap = pageApiMapByTab.get(tabId);
    chrome.storage.local.set({
      [`tab_${tabId}_calls`]: tabCalls,
      [`tab_${tabId}_map`]: Array.from(pageMap.entries())
    }, () => {
      console.log('Background: Saved to storage, total calls:', tabCalls.length);
    });
    
    // Send response immediately (don't wait for storage)
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'GET_ALL_CALLS') {
    const tabId = currentInspectedTabId;
    const tabCalls = apiCallsByTab.get(tabId) || [];
    const tabPageMap = pageApiMapByTab.get(tabId) || new Map();
    
    sendResponse({
      calls: tabCalls,
      pageMap: Object.fromEntries(tabPageMap)
    });
    return true;
  }
  
  if (request.type === 'CLEAR_TAB_DATA') {
    const tabId = request.tabId;
    // Reset to empty arrays instead of deleting
    apiCallsByTab.set(tabId, []);
    pageApiMapByTab.set(tabId, new Map());
    chrome.storage.local.remove([`tab_${tabId}_calls`, `tab_${tabId}_map`]);
    console.log('Background: Cleared data for tab', tabId);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'PAGE_NAVIGATED') {
    const tabId = request.tabId;
    console.log('Background: Page navigated on tab', tabId, '- clearing API calls');
    apiCallsByTab.set(tabId, []);
    pageApiMapByTab.set(tabId, new Map());
    chrome.storage.local.remove([`tab_${tabId}_calls`, `tab_${tabId}_map`]);
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

// Map page URL to API calls
function mapPageToApi(tabId, pageUrl, call) {
  try {
    const url = new URL(pageUrl);
    const pathname = url.pathname || '/';
    const pageKey = `${url.hostname}${pathname}`;
    
    const pageMap = pageApiMapByTab.get(tabId);
    if (!pageMap.has(pageKey)) {
      pageMap.set(pageKey, []);
    }
    
    const apis = pageMap.get(pageKey);
    const isDuplicate = apis.some(api => 
      api.endpoint === call.url && 
      api.method === call.method &&
      api.timestamp > Date.now() - 1000
    );
    
    if (!isDuplicate) {
      apis.push({
        endpoint: call.url,
        method: call.method,
        timestamp: call.timestamp,
        statusCode: call.statusCode,
        duration: call.duration
      });
    }
  } catch (e) {
    console.error('Error mapping page to API:', e);
  }
}

// Comprehensive Security analysis - OWASP Top 10 + Additional Checks
function analyzeSecurityIssues(call) {
  const issues = [];
  
  try {
    if (!call.url || typeof call.url !== 'string') {
      console.log('Background: No URL in call');
      return issues;
    }
    
    let url;
    try {
      url = new URL(call.url);
    } catch (e) {
      console.log('Background: Invalid URL:', call.url);
      return issues;
    }
    
    // Parse headers - handle both array and object formats
    const headers = call.responseHeaders || [];
    const headerMap = {};
    
    if (Array.isArray(headers)) {
      headers.forEach(h => {
        if (h && h.name) {
          headerMap[h.name.toLowerCase()] = h.value;
        }
      });
    } else if (typeof headers === 'object') {
      Object.keys(headers).forEach(key => {
        headerMap[key.toLowerCase()] = headers[key];
      });
    }
    
    console.log('Background: Analyzing security for', call.method, call.url);
    console.log('Background: Headers found:', Object.keys(headerMap).length);
    
    // ===== A01:2021 - Broken Access Control =====
    if (call.statusCode === 401) {
      issues.push({
        severity: 'high',
        type: 'authentication_required',
        message: '401 Unauthorized - Authentication required but not provided',
        owasp: 'A01:2021',
        recommendation: 'Ensure proper authentication tokens/credentials are sent'
      });
    }
    
    if (call.statusCode === 403) {
      issues.push({
        severity: 'high',
        type: 'authorization_failed',
        message: '403 Forbidden - User lacks required permissions',
        owasp: 'A01:2021',
        recommendation: 'Verify user has proper authorization for this resource'
      });
    }
    
    // Check for IDOR patterns (predictable IDs in URL)
    if (/\/\d+($|\/|\?)/i.test(url.pathname)) {
      issues.push({
        severity: 'medium',
        type: 'potential_idor',
        message: 'Potential IDOR vulnerability - numeric ID in URL path',
        owasp: 'A01:2021',
        recommendation: 'Verify that users cannot access other users\' resources by changing IDs'
      });
    }
    
    // ===== A02:2021 - Cryptographic Failures =====
    if (url.protocol !== 'https:') {
      issues.push({
        severity: 'critical',
        type: 'insecure_protocol',
        message: 'API using HTTP instead of HTTPS - data transmitted in plaintext',
        owasp: 'A02:2021',
        recommendation: 'Use HTTPS/TLS for all API endpoints'
      });
    }
    
    // Check for sensitive data in URL
    if (url.search.match(/token|key|secret|password|auth|api[_-]?key|bearer|jwt/i)) {
      issues.push({
        severity: 'critical',
        type: 'sensitive_data_in_url',
        message: 'Sensitive data (token/key/password) exposed in URL parameters',
        owasp: 'A02:2021',
        recommendation: 'Move sensitive data to Authorization header or request body'
      });
    }
    
    // Check for sensitive data in response
    if (call.responseBody) {
      const responseStr = JSON.stringify(call.responseBody);
      if (responseStr.match(/password|secret|token|api[_-]?key|credit[_-]?card|ssn|social[_-]?security/i)) {
        issues.push({
          severity: 'high',
          type: 'sensitive_data_in_response',
          message: 'Sensitive data (passwords/tokens/credit cards) exposed in response',
          owasp: 'A02:2021',
          recommendation: 'Never return sensitive data in API responses'
        });
      }
    }
    
    // ===== A03:2021 - Injection =====
    // Check for SQL injection patterns in URL
    if (url.search.match(/('|"|;|--|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|union|or\s+1\s*=\s*1)/i)) {
      issues.push({
        severity: 'critical',
        type: 'sql_injection_pattern',
        message: 'Potential SQL injection pattern detected in URL parameters',
        owasp: 'A03:2021',
        recommendation: 'Use parameterized queries and input validation'
      });
    }
    
    // Check for command injection patterns
    if (url.search.match(/[;&|`$(){}[\]<>]/)) {
      issues.push({
        severity: 'high',
        type: 'command_injection_pattern',
        message: 'Potential command injection pattern in URL parameters',
        owasp: 'A03:2021',
        recommendation: 'Sanitize and validate all user inputs'
      });
    }
    
    // ===== A04:2021 - Insecure Design =====
    // Check for missing rate limiting headers
    if (!headerMap['x-ratelimit-limit'] && !headerMap['ratelimit-limit']) {
      issues.push({
        severity: 'medium',
        type: 'no_rate_limiting',
        message: 'No rate limiting headers detected - API may be vulnerable to brute force attacks',
        owasp: 'A04:2021',
        recommendation: 'Implement rate limiting and return X-RateLimit-* headers'
      });
    }
    
    // Check for missing request size limits
    if (!headerMap['content-length'] && call.requestBody) {
      issues.push({
        severity: 'low',
        type: 'no_request_size_limit',
        message: 'No Content-Length header - potential for large payload attacks',
        owasp: 'A04:2021',
        recommendation: 'Implement request size limits'
      });
    }
    
    // ===== A05:2021 - Broken Access Control (Security Misconfiguration) =====
    // Check for missing security headers - ALWAYS check these
    const hasHeaders = Object.keys(headerMap).length > 0;
    
    // Only check headers if we actually have them
    if (hasHeaders) {
      if (!headerMap['strict-transport-security']) {
        issues.push({
          severity: 'high',
          type: 'missing_hsts',
          message: 'Missing HSTS header - vulnerable to SSL stripping attacks',
          owasp: 'A05:2021',
          recommendation: 'Add Strict-Transport-Security header (e.g., max-age=31536000)'
        });
      }
      
      if (!headerMap['x-content-type-options']) {
        issues.push({
          severity: 'medium',
          type: 'missing_x_content_type_options',
          message: 'Missing X-Content-Type-Options header - vulnerable to MIME type sniffing',
          owasp: 'A05:2021',
          recommendation: 'Add X-Content-Type-Options: nosniff header'
        });
      }
      
      if (!headerMap['x-frame-options']) {
        issues.push({
          severity: 'medium',
          type: 'missing_x_frame_options',
          message: 'Missing X-Frame-Options header - vulnerable to clickjacking',
          owasp: 'A05:2021',
          recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN header'
        });
      }
      
      if (!headerMap['x-xss-protection']) {
        issues.push({
          severity: 'low',
          type: 'missing_x_xss_protection',
          message: 'Missing X-XSS-Protection header',
          owasp: 'A05:2021',
          recommendation: 'Add X-XSS-Protection: 1; mode=block header'
        });
      }
      
      if (!headerMap['content-security-policy']) {
        issues.push({
          severity: 'high',
          type: 'missing_csp',
          message: 'Missing Content-Security-Policy header - vulnerable to XSS attacks',
          owasp: 'A05:2021',
          recommendation: 'Implement a strict Content-Security-Policy'
        });
      }
    }
    
    // Check for overly permissive CORS
    const corsHeader = headerMap['access-control-allow-origin'];
    if (corsHeader === '*') {
      issues.push({
        severity: 'high',
        type: 'cors_allow_all_origins',
        message: 'CORS allows all origins (*) - any website can access this API',
        owasp: 'A05:2021',
        recommendation: 'Restrict CORS to specific trusted origins'
      });
    }
    
    if (corsHeader && corsHeader !== '*' && corsHeader.includes('null')) {
      issues.push({
        severity: 'high',
        type: 'cors_allows_null_origin',
        message: 'CORS allows null origin - vulnerable to attacks from local files',
        owasp: 'A05:2021',
        recommendation: 'Never allow null origin in CORS policy'
      });
    }
    
    // Check for missing CORS credentials restriction
    if (headerMap['access-control-allow-credentials'] === 'true' && corsHeader === '*') {
      issues.push({
        severity: 'critical',
        type: 'cors_credentials_with_wildcard',
        message: 'CORS allows credentials with wildcard origin - critical vulnerability',
        owasp: 'A05:2021',
        recommendation: 'Never use wildcard origin with credentials=true'
      });
    }
    
    // Check for missing Referrer-Policy
    if (!headerMap['referrer-policy']) {
      issues.push({
        severity: 'low',
        type: 'missing_referrer_policy',
        message: 'Missing Referrer-Policy header',
        owasp: 'A05:2021',
        recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin header'
      });
    }
    
    // ===== A06:2021 - Vulnerable and Outdated Components =====
    // Check for deprecated API versions
    if (url.pathname.match(/\/v[0-2]($|\/)/i)) {
      issues.push({
        severity: 'medium',
        type: 'deprecated_api_version',
        message: 'Using deprecated API version - may have known vulnerabilities',
        owasp: 'A06:2021',
        recommendation: 'Upgrade to the latest API version'
      });
    }
    
    // ===== A07:2021 - Identification and Authentication Failures =====
    // Check for weak authentication
    if (headerMap['authorization']) {
      const authHeader = headerMap['authorization'];
      if (authHeader.match(/^Basic\s+/i)) {
        issues.push({
          severity: 'high',
          type: 'basic_auth_over_http',
          message: 'Basic authentication detected - credentials easily decoded',
          owasp: 'A07:2021',
          recommendation: 'Use OAuth 2.0, JWT, or other secure authentication methods'
        });
      }
    }
    
    // Check for missing authentication on sensitive endpoints
    if (url.pathname.match(/\/(admin|user|profile|account|settings|api|data)/i) && call.statusCode === 200) {
      if (!headerMap['authorization'] && !call.requestBody?.token) {
        issues.push({
          severity: 'high',
          type: 'missing_authentication',
          message: 'Sensitive endpoint accessible without authentication',
          owasp: 'A07:2021',
          recommendation: 'Require authentication for all sensitive endpoints'
        });
      }
    }
    
    // ===== A08:2021 - Software and Data Integrity Failures =====
    // Check for missing integrity verification
    if (!headerMap['x-content-digest'] && !headerMap['content-md5'] && !headerMap['etag']) {
      issues.push({
        severity: 'medium',
        type: 'no_integrity_check',
        message: 'No integrity verification headers - response could be tampered with',
        owasp: 'A08:2021',
        recommendation: 'Add ETag or Content-MD5 headers for integrity verification'
      });
    }
    
    // ===== A09:2021 - Logging and Monitoring Failures =====
    // Check for error details in response
    if (call.statusCode >= 500) {
      if (call.responseBody && JSON.stringify(call.responseBody).match(/stack|trace|error|exception|debug/i)) {
        issues.push({
          severity: 'high',
          type: 'error_details_exposed',
          message: 'Detailed error information exposed in 5xx response',
          owasp: 'A09:2021',
          recommendation: 'Return generic error messages to clients, log details server-side'
        });
      }
    }
    
    // ===== A10:2021 - Server-Side Request Forgery (SSRF) =====
    // Check for SSRF patterns
    if (url.search.match(/url|uri|redirect|fetch|load|include|file|path/i)) {
      issues.push({
        severity: 'high',
        type: 'potential_ssrf',
        message: 'Potential SSRF vulnerability - URL parameter detected',
        owasp: 'A10:2021',
        recommendation: 'Validate and whitelist all URLs, prevent access to internal networks'
      });
    }
    
    // ===== Additional Security Checks =====
    // Check for XXE vulnerability patterns
    if (call.requestBody && JSON.stringify(call.requestBody).match(/<!DOCTYPE|<!ENTITY|SYSTEM/i)) {
      issues.push({
        severity: 'critical',
        type: 'xxe_vulnerability',
        message: 'Potential XXE (XML External Entity) vulnerability',
        owasp: 'A03:2021',
        recommendation: 'Disable XML external entity processing'
      });
    }
    
    // Check response time for timing attacks
    if (call.duration > 5000) {
      issues.push({
        severity: 'low',
        type: 'slow_response',
        message: `Slow API response (${call.duration}ms) - potential timing attack vulnerability`,
        owasp: 'A04:2021',
        recommendation: 'Optimize API performance and use constant-time comparisons'
      });
    }
    
    // Check for server information disclosure
    if (headerMap['server']) {
      issues.push({
        severity: 'low',
        type: 'server_info_disclosed',
        message: `Server information disclosed: ${headerMap['server']}`,
        owasp: 'A05:2021',
        recommendation: 'Remove or obfuscate Server header'
      });
    }
    
    // Check for X-Powered-By header
    if (headerMap['x-powered-by']) {
      issues.push({
        severity: 'low',
        type: 'technology_disclosed',
        message: `Technology stack disclosed: ${headerMap['x-powered-by']}`,
        owasp: 'A05:2021',
        recommendation: 'Remove X-Powered-By header'
      });
    }
    
    // Check for cache control on sensitive data
    if (url.pathname.match(/\/(user|profile|account|admin|api)/i)) {
      const cacheControl = headerMap['cache-control'];
      if (!cacheControl || !cacheControl.match(/no-store|no-cache|private/i)) {
        issues.push({
          severity: 'high',
          type: 'sensitive_data_cached',
          message: 'Sensitive data may be cached - vulnerable to unauthorized access',
          owasp: 'A02:2021',
          recommendation: 'Add Cache-Control: no-store, no-cache, private headers'
        });
      }
    }
    
    // ===== Fallback checks if no headers were captured =====
    // These checks run regardless of whether headers are available
    const headerCount = Object.keys(headerMap).length;
    console.log('Background: Header count:', headerCount);
    
    if (headerCount === 0 && call.statusCode >= 200 && call.statusCode < 300) {
      // If we have a successful response but no headers, it's likely a security issue
      console.log('Background: No headers captured, adding fallback security issue');
      issues.push({
        severity: 'medium',
        type: 'no_security_headers',
        message: 'No security headers detected in response',
        owasp: 'A05:2021',
        recommendation: 'Implement security headers (HSTS, CSP, X-Frame-Options, etc.)'
      });
    }
    
    // For HTTPS APIs, if we have headers, check for common missing headers
    if (url.protocol === 'https:' && headerCount > 0) {
      const missingHeaders = [];
      if (!headerMap['strict-transport-security']) missingHeaders.push('HSTS');
      if (!headerMap['x-content-type-options']) missingHeaders.push('X-Content-Type-Options');
      if (!headerMap['x-frame-options']) missingHeaders.push('X-Frame-Options');
      if (!headerMap['content-security-policy']) missingHeaders.push('CSP');
      
      if (missingHeaders.length > 0) {
        console.log('Background: Missing headers:', missingHeaders);
      }
    }
    
    // Always check for HTTP usage
    if (url.protocol === 'http:' && !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
      // Already added above, but ensure it's there
      const hasHttpIssue = issues.some(i => i.type === 'insecure_protocol');
      if (!hasHttpIssue) {
        console.log('Background: Adding HTTP insecure protocol issue');
        issues.push({
          severity: 'critical',
          type: 'insecure_protocol',
          message: 'API using HTTP instead of HTTPS - data transmitted in plaintext',
          owasp: 'A02:2021',
          recommendation: 'Use HTTPS/TLS for all API endpoints'
        });
      }
    }
    
    console.log('Background: Security analysis complete. Found', issues.length, 'issues for', call.method, call.url);
    
  } catch (e) {
    console.error('Error analyzing security:', e);
  }
  
  return issues;
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  apiCallsByTab.delete(tabId);
  pageApiMapByTab.delete(tabId);
  if (currentInspectedTabId === tabId) {
    currentInspectedTabId = null;
  }
});
