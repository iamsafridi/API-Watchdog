# API Watchdog

A Chrome DevTools extension for monitoring API calls, detecting security vulnerabilities, and analyzing API performance in real-time.

## Installation

### Option 1: Install from Source

1. **Download the Extension**
   ```bash
   git clone https://github.com/iamsafridi/API-Watchdog.git
   cd API-Watchdog
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `API-Watchdog` folder

3. **Verify Installation**
   - You should see "API Watchdog" in your extensions list
   - The extension icon will appear in your Chrome toolbar

## Usage

### Opening API Watchdog

1. Navigate to any website (e.g., `localhost:3000`, `example.com`)
2. Open Chrome DevTools:
   - Press `F12`, or
   - Right-click → "Inspect", or
   - `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
3. Click on the **"API Watchdog"** tab in DevTools

### Monitoring API Calls

API Watchdog automatically captures API requests that match these patterns:
- URLs containing `/api/`, `/v1/`, `/v2/`, `/v3/`
- GraphQL endpoints (`/graphql`)
- REST APIs (`/rest/`)
- Any request with `Content-Type: application/json`

**The extension works on:**
- ✅ Any website (Google, Facebook, Twitter, etc.)
- ✅ Localhost development servers
- ✅ Production APIs
- ✅ Both HTTP and HTTPS

### Dashboard Overview

The main dashboard shows four key metrics:

- **Total API Calls**: Number of API requests captured
- **Security Issues**: Total security vulnerabilities detected
- **Slow APIs**: APIs taking longer than 500ms
- **Health Score**: Overall API health (0-100)

### Tabs

#### 1. API Calls Tab
View all captured API requests with:
- HTTP method (GET, POST, PUT, DELETE, PATCH)
- Full URL
- Status code
- Response time
- Security issue count

**Click on any API call** to see detailed information including:
- Request/response details
- Security issues (sorted by severity)
- Request replay functionality

#### 2. Security Tab
View all security issues sorted by severity:
- 🔴 **Critical** - Immediate attention required
- 🔴 **High** - Important security concerns
- 🟡 **Medium** - Moderate security issues
- ⚪ **Low** - Minor security improvements

Each issue includes:
- Severity level
- Issue type
- OWASP category
- Detailed description
- Recommendation for fixing

#### 3. Performance Tab
Monitor API performance:
- Lists all APIs slower than 500ms
- Sorted by response time (slowest first)
- Color-coded warnings (yellow: >500ms, red: >1000ms)

#### 4. Page Mapping Tab
See which APIs are called on each route:
- Groups APIs by page URL/route
- Shows frequency count for repeated calls
- Displays status codes and response times
- Helps understand API dependencies per page

#### 5. Tools Tab
Additional utilities:
- Export reports
- Generate Swagger documentation

## Features

### Request Replay
Edit and resend API requests:
1. Click on any API call
2. Scroll to "Replay Request" section
3. Modify URL, method, headers, or body
4. Add authorization token if needed
5. Click "Send Request" to replay
6. View the response in real-time

**Copy as cURL**: Export the request as a cURL command for terminal use

### Export Reports
Generate professional HTML reports:
1. Click the **"Export Report"** button
2. HTML file downloads automatically
3. Open in browser to view the report
4. Print to PDF using `Ctrl+P` / `Cmd+P`

**Report includes:**
- Executive summary with statistics
- Security issues breakdown by severity
- Detailed security findings (expandable cards)
- Complete API calls table
- Performance analysis

**Interactive Features:**
- Click on security issue cards to expand
- View request payload and response details
- See response headers
- Print-friendly layout

### Clear Data
Click the **"Clear"** button to remove all captured API calls and start fresh.

## Security Checks

API Watchdog performs comprehensive security analysis based on OWASP Top 10:

- **A01: Broken Access Control** - 401/403 errors, IDOR vulnerabilities
- **A02: Cryptographic Failures** - HTTP usage, sensitive data exposure
- **A03: Injection** - SQL injection, command injection patterns
- **A04: Insecure Design** - Missing rate limiting
- **A05: Security Misconfiguration** - Missing security headers, CORS issues
- **A06: Vulnerable Components** - Deprecated API versions
- **A07: Authentication Failures** - Weak authentication, missing auth
- **A08: Data Integrity Failures** - Missing integrity checks
- **A09: Logging Failures** - Error details exposure
- **A10: SSRF** - Server-side request forgery patterns

## Tips

- **Reload Extension**: If you don't see API calls, reload the extension at `chrome://extensions/`
- **Page Navigation**: API calls are cleared on full page reload (not on SPA route changes)
- **Multiple Tabs**: Each browser tab has its own isolated API monitoring
- **Performance**: Extension keeps only the last 100 API calls per tab

## Troubleshooting

**No API calls showing?**
- Ensure the website is making API requests
- Check that URLs contain `/api/` or other supported patterns
- Reload the extension and refresh the page

**Extension not appearing?**
- Verify it's enabled at `chrome://extensions/`
- Restart Chrome browser
- Reload the extension

**Security issues not showing?**
- Some APIs may not return response headers
- HTTPS APIs will have fewer issues than HTTP
- Check browser console for any errors

## Support

For issues, feature requests, or contributions, visit:
https://github.com/iamsafridi/API-Watchdog

---

**Version**: 1.0.0  
**License**: MIT  
**Author**: Safridi
