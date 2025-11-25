// DevTools Panel Registration
console.log('DevTools: Initializing');

// Establish connection to keep service worker alive
let backgroundPort = null;
let keepAliveInterval = null;

function connectToBackground() {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'devtools' });
    console.log('DevTools: Connected to background');
    
    backgroundPort.onDisconnect.addListener(() => {
      console.log('DevTools: Disconnected from background');
      backgroundPort = null;
      // Try to reconnect after 1 second
      setTimeout(connectToBackground, 1000);
    });
    
    // Send keep-alive messages
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
      if (backgroundPort) {
        try {
          backgroundPort.postMessage({ type: 'KEEP_ALIVE' });
        } catch (e) {
          console.log('DevTools: Keep-alive failed, reconnecting...');
          connectToBackground();
        }
      }
    }, 15000); // Every 15 seconds
  } catch (e) {
    console.error('DevTools: Connection error:', e);
    setTimeout(connectToBackground, 1000);
  }
}

// Connect immediately
connectToBackground();

chrome.devtools.panels.create(
  "API Watchdog",
  "icons/icon48.png",
  "panel.html",
  (panel) => {
    console.log("API Watchdog panel created");
    
    // Register this tab with background
    chrome.runtime.sendMessage({
      type: 'DEVTOOLS_INIT',
      tabId: chrome.devtools.inspectedWindow.tabId
    }, (response) => {
      console.log("DevTools registered for tab:", chrome.devtools.inspectedWindow.tabId);
    });
  }
);

// Network listener - capture all API calls
console.log('DevTools: Setting up network listener');

chrome.devtools.network.onRequestFinished.addListener((request) => {
  const url = request.request?.url;
  const method = request.request?.method;
  
  if (!url || !method) return;
  
  // Only capture API calls
  if (!url.includes('/api/')) return;
  
  console.log('DevTools: Captured', method, url);
  
  // Get response content
  request.getContent((content) => {
    try {
      let responseBody = null;
      if (content) {
        try {
          responseBody = JSON.parse(content);
        } catch (e) {
          responseBody = null;
        }
      }
      
      // Send to background
      try {
        chrome.runtime.sendMessage({
          type: 'API_CAPTURED',
          data: {
            url: url,
            method: method,
            statusCode: request.response?.status || 0,
            duration: Math.round((request.timings?.wait || 0) + (request.timings?.receive || 0)),
            timestamp: Date.now(),
            responseHeaders: (request.response?.headers || []).map(h => ({
              name: h.name,
              value: h.value
            })),
            responseBody: responseBody
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Silently ignore - extension may have been reloaded
            return;
          }
        });
      } catch (e) {
        // Silently ignore - extension context invalidated
      }
    } catch (e) {
      console.error('DevTools: Error:', e);
    }
  });
});

console.log('DevTools: Network listener registered');
