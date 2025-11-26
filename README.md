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

