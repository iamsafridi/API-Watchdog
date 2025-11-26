#API Watchdog

A Chrome extension that automatically monitors all API calls made by a website and generates testing analysis, security insights, and quality reports.

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `api-watchdog` folder
6. The extension icon should appear in your toolbar

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
