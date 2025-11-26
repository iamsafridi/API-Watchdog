# 🐕 API Watchdog

A Chrome extension that automatically monitors all API calls made by a website and generates testing analysis, security insights, and quality reports.

## Features

### ✅ Implemented
- **Auto-capture API calls** - Monitors all HTTP requests using Chrome's webRequest API
- **Security analysis** - Detects common security issues:
  - Non-HTTPS endpoints
  - Tokens/secrets in URLs
  - Missing security headers (HSTS, X-Content-Type-Options)
  - CORS misconfigurations
- **Performance monitoring** - Tracks response times and flags slow APIs (>500ms)
- **Page-to-API mapping** - Shows which pages trigger which APIs
- **Health scoring** - Calculates overall API health based on security and performance
- **Export reports** - Download JSON reports with all captured data
- **Test case generation** - Auto-generate test scenarios for each API endpoint

### 🚀 Future Enhancements
- PDF report generation
- Postman collection export
- API dependency tree visualization
- Advanced payload inspection
- Rate limiting detection
- SQL injection pattern detection
- Custom security rules engine

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

1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Navigate to the "API Watchdog" tab
3. Browse any website - API calls will be captured automatically
4. View captured calls in different tabs:
   - **API Calls** - All captured requests with status codes
   - **Security** - Detected security issues
   - **Performance** - Slow API analysis
   - **Page Mapping** - Which pages call which APIs

## Actions

- **Clear** - Reset all captured data
- **Export Report** - Download JSON report with all analysis
- **Generate Tests** - Export test case suggestions for captured APIs

## Technical Details

### Architecture
- `manifest.json` - Extension configuration
- `background.js` - Service worker that captures API calls via webRequest API
- `content.js` - Injected script that intercepts fetch/XHR calls
- `devtools.js` - Creates the DevTools panel
- `panel.html/js` - Main UI and analysis logic
- `styles.css` - Dark theme styling

### Permissions
- `webRequest` - Capture HTTP requests
- `storage` - Save captured data
- `activeTab` - Access current tab info
- `tabs` - Map pages to APIs

## Development

To modify the extension:
1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the API Watchdog card
4. Reload DevTools to see changes

## Security Note

This extension captures sensitive data like API endpoints, headers, and response codes. Use it only in development/testing environments. Never share exported reports containing production data.

## License

MIT
