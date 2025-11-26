// API Watchdog Panel Logic
let apiCalls = [];
let pageMapping = {};
let pollInterval = null;

// Suppress extension context errors
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Extension context invalidated')) {
    event.preventDefault();
  }
}, true);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Panel loaded');
  setupEventListeners();
  
  // Setup modal close button
  const closeBtn = document.getElementById('closeModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeApiModal);
  }
  
  // Setup modal outside click
  const modal = document.getElementById('apiModal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeApiModal();
      }
    });
  }
  
  // Listen for page navigation to clear API calls
  try {
    chrome.devtools.network.onNavigated.addListener(() => {
      console.log('Panel: Page navigation detected');
      apiCalls = [];
      pageMapping = {};
      updateUI();
    });
  } catch (e) {
    // Silently ignore
  }
  
  // Start polling for data from storage
  startPolling();
});

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });
  
  // Action buttons
  document.getElementById('clearBtn').addEventListener('click', clearData);
  document.getElementById('exportBtn').addEventListener('click', exportReport);
  document.getElementById('generateTestsBtn').addEventListener('click', generateTests);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

function startPolling() {
  // Poll storage every 500ms for updates
  pollInterval = setInterval(() => {
    loadDataFromStorage();
  }, 500);
}

function loadDataFromStorage() {
  try {
    if (!chrome || !chrome.storage || !chrome.devtools) {
      if (pollInterval) clearInterval(pollInterval);
      return;
    }
    
    let tabId;
    try {
      tabId = chrome.devtools.inspectedWindow.tabId;
    } catch (e) {
      // Extension context invalidated - stop polling
      if (pollInterval) clearInterval(pollInterval);
      return;
    }
    
    if (!tabId) return;
    
    chrome.storage.local.get([`tab_${tabId}_calls`], (result) => {
      try {
        if (!result || !result[`tab_${tabId}_calls`]) return;
        
        const newCalls = result[`tab_${tabId}_calls`];
        
        // Only update if data changed
        if (JSON.stringify(newCalls) !== JSON.stringify(apiCalls)) {
          apiCalls = newCalls;
          updateUI();
        }
      } catch (e) {
        // Silently ignore
      }
    });
  } catch (e) {
    // Extension context invalidated - stop polling
    if (pollInterval) clearInterval(pollInterval);
  }
}

function updateUI() {
  console.log('Panel: updateUI called with', apiCalls.length, 'calls');
  updateStats();
  renderApiCalls();
  renderSecurityIssues();
  renderPerformance();
  renderPageMapping();
  renderTools();
}

function updateStats() {
  const securityIssues = apiCalls.reduce((sum, call) => 
    sum + (call.securityIssues?.length || 0), 0);
  const slowApis = apiCalls.filter(call => call.duration > 500).length;
  const healthScore = calculateHealthScore();
  
  document.getElementById('totalCalls').textContent = apiCalls.length;
  document.getElementById('securityIssues').textContent = securityIssues;
  document.getElementById('slowApis').textContent = slowApis;
  document.getElementById('healthScore').textContent = healthScore;
}

function calculateHealthScore() {
  if (apiCalls.length === 0) return 100;
  
  let score = 100;
  const securityIssues = apiCalls.reduce((sum, call) => 
    sum + (call.securityIssues?.length || 0), 0);
  const slowApis = apiCalls.filter(call => call.duration > 500).length;
  
  score -= securityIssues * 5;
  score -= slowApis * 2;
  
  return Math.max(0, Math.min(100, score));
}

function renderApiCalls() {
  const container = document.getElementById('apiList');
  if (apiCalls.length === 0) {
    container.innerHTML = '<p class="empty">No API calls captured yet.</p>';
    return;
  }
  
  container.innerHTML = apiCalls.map((call, index) => `
    <div class="api-card" data-api-index="${index}" style="cursor: pointer;">
      <div class="api-header">
        <span class="method ${call.method}">${call.method}</span>
        <span class="url">${call.url}</span>
        <span class="status status-${Math.floor(call.statusCode / 100)}xx">${call.statusCode}</span>
      </div>
      <div class="api-details">
        <span class="duration">${call.duration}ms</span>
        ${call.securityIssues?.length ? `<span class="security-badge">${call.securityIssues.length} issues</span>` : ''}
      </div>
    </div>
  `).join('');
  
  document.querySelectorAll('.api-card').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.getAttribute('data-api-index'));
      showApiDetails(index);
    });
  });
}

function showApiDetails(index) {
  const call = apiCalls[index];
  if (!call) return;
  
  const modal = document.getElementById('apiModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  
  modalTitle.textContent = `${call.method} ${call.url}`;
  
  let responseDisplay = '<p style="color: #999;">No response body</p>';
  if (call.responseBody) {
    responseDisplay = `<pre style="background: #0d1117; color: #c9d1d9; padding: 10px; border-radius: 4px; overflow: auto; max-height: 400px;">${JSON.stringify(call.responseBody, null, 2)}</pre>`;
  }
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3 style="color: #fff;">📊 Request Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding: 8px; font-weight: bold; color: #aaa;">Method:</td>
          <td style="padding: 8px;"><span class="method ${call.method}">${call.method}</span></td>
        </tr>
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding: 8px; font-weight: bold; color: #aaa;">URL:</td>
          <td style="padding: 8px; word-break: break-all; color: #e0e0e0;">${call.url}</td>
        </tr>
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding: 8px; font-weight: bold; color: #aaa;">Status:</td>
          <td style="padding: 8px;"><span class="status status-${Math.floor(call.statusCode / 100)}xx">${call.statusCode}</span></td>
        </tr>
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding: 8px; font-weight: bold; color: #aaa;">Duration:</td>
          <td style="padding: 8px; color: #e0e0e0;">${call.duration}ms</td>
        </tr>
      </table>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #fff;">📤 Response Body</h3>
      ${responseDisplay}
    </div>
    
    ${call.securityIssues?.length ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #fff;">🔒 Security Issues (${call.securityIssues.length})</h3>
        ${(() => {
          // Sort by severity
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const sortedIssues = [...call.securityIssues].sort((a, b) => {
            const aSev = (a.severity || '').toLowerCase();
            const bSev = (b.severity || '').toLowerCase();
            return (severityOrder[aSev] || 99) - (severityOrder[bSev] || 99);
          });
          
          // Color mapping
          const severityColors = {
            critical: { bg: '#3d1a1a', border: '#c82333', text: '#ff6b6b' },
            high: { bg: '#4a2020', border: '#e74c3c', text: '#ff9999' },
            medium: { bg: '#4a4a1a', border: '#ffc107', text: '#ffd43b' },
            low: { bg: '#2a2a2a', border: '#6c757d', text: '#adb5bd' }
          };
          
          return sortedIssues.map(issue => {
            const colors = severityColors[issue.severity] || severityColors.low;
            return `
              <div style="background: ${colors.bg}; padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid ${colors.border}; color: #e0e0e0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  <strong style="color: ${colors.text}; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">${issue.severity}</strong>
                  <span style="color: #999; font-size: 11px;">${issue.type}</span>
                  ${issue.owasp ? `<span style="color: #666; font-size: 10px; margin-left: auto;">${issue.owasp}</span>` : ''}
                </div>
                <p style="margin: 0 0 8px 0; color: #e0e0e0; font-size: 13px;">${issue.message}</p>
                ${issue.recommendation ? `<p style="font-size: 12px; color: #4ec9b0; margin: 0;">💡 ${issue.recommendation}</p>` : ''}
              </div>
            `;
          }).join('');
        })()}
      </div>
    ` : ''}
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #fff;">🔄 Replay Request</h3>
      <p style="color: #aaa; font-size: 12px; margin-bottom: 10px;">Edit and resend this API request</p>
      
      <div style="margin-bottom: 10px;">
        <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 5px;">URL:</label>
        <input type="text" id="replayUrl" value="${call.url}" style="width: 100%; padding: 8px; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; font-family: monospace; font-size: 12px;">
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 5px;">Method:</label>
        <select id="replayMethod" style="padding: 8px; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px;">
          <option value="GET" ${call.method === 'GET' ? 'selected' : ''}>GET</option>
          <option value="POST" ${call.method === 'POST' ? 'selected' : ''}>POST</option>
          <option value="PUT" ${call.method === 'PUT' ? 'selected' : ''}>PUT</option>
          <option value="DELETE" ${call.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
          <option value="PATCH" ${call.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
        </select>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 5px;">🔑 Authorization Token (Bearer):</label>
        <input type="text" id="replayToken" placeholder="Paste your token here (will be added as Bearer token)" style="width: 100%; padding: 8px; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; font-family: monospace; font-size: 12px;">
        <small style="color: #666; font-size: 11px;">Optional - Leave empty if not needed</small>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 5px;">Headers (JSON):</label>
        <textarea id="replayHeaders" style="width: 100%; height: 100px; padding: 8px; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; font-family: monospace; font-size: 12px;">${JSON.stringify(call.responseHeaders?.reduce((acc, h) => ({ ...acc, [h.name]: h.value }), {}) || {}, null, 2)}</textarea>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label style="color: #aaa; font-size: 12px; display: block; margin-bottom: 5px;">Body (JSON):</label>
        <textarea id="replayBody" style="width: 100%; height: 150px; padding: 8px; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; font-family: monospace; font-size: 12px;">${call.requestBody ? JSON.stringify(call.requestBody, null, 2) : ''}</textarea>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button id="replayBtn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🚀 Send Request</button>
      </div>
      
      <div id="replayResult" style="margin-top: 15px; padding: 10px; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; display: none;">
        <h4 style="color: #fff; margin: 0 0 10px 0;">Response:</h4>
        <div id="replayResultContent"></div>
      </div>
    </div>
  `;
  
  modal.style.display = 'block';
  
  // Setup replay button
  document.getElementById('replayBtn').addEventListener('click', () => replayRequest(call));
}

function replayRequest(originalCall) {
  const url = document.getElementById('replayUrl').value;
  const method = document.getElementById('replayMethod').value;
  const token = document.getElementById('replayToken').value;
  const headersText = document.getElementById('replayHeaders').value;
  const bodyText = document.getElementById('replayBody').value;
  
  const resultDiv = document.getElementById('replayResult');
  const resultContent = document.getElementById('replayResultContent');
  
  resultDiv.style.display = 'block';
  resultContent.innerHTML = '<p style="color: #aaa;">⏳ Sending request...</p>';
  
  try {
    // Parse headers
    let headers = {};
    if (headersText.trim()) {
      try {
        headers = JSON.parse(headersText);
      } catch (e) {
        resultContent.innerHTML = '<p style="color: #f85149;">❌ Invalid JSON in headers</p>';
        return;
      }
    }
    
    // Add Authorization token if provided
    if (token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    
    // Parse body
    let body = null;
    if (bodyText.trim() && method !== 'GET') {
      try {
        body = JSON.parse(bodyText);
      } catch (e) {
        resultContent.innerHTML = '<p style="color: #f85149;">❌ Invalid JSON in body</p>';
        return;
      }
    }
    
    // Make request
    const startTime = performance.now();
    const options = {
      method: method,
      headers: headers,
      credentials: 'include'
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
    }
    
    fetch(url, options)
      .then(response => {
        const duration = Math.round(performance.now() - startTime);
        const statusClass = Math.floor(response.status / 100);
        const statusColor = statusClass === 2 ? '#3fb950' : statusClass === 4 ? '#f85149' : '#d29922';
        
        return response.text().then(text => {
          let jsonData = null;
          try {
            jsonData = JSON.parse(text);
          } catch (e) {
            jsonData = text;
          }
          
          resultContent.innerHTML = `
            <div style="margin-bottom: 10px;">
              <span style="color: ${statusColor}; font-weight: bold;">Status: ${response.status}</span>
              <span style="color: #aaa; margin-left: 15px;">Duration: ${duration}ms</span>
            </div>
            <pre style="background: #161b22; color: #c9d1d9; padding: 10px; border-radius: 4px; overflow: auto; max-height: 300px; margin: 0;">${typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2)}</pre>
          `;
        });
      })
      .catch(error => {
        resultContent.innerHTML = `<p style="color: #f85149;">❌ Error: ${error.message}</p>`;
      });
  } catch (e) {
    resultContent.innerHTML = `<p style="color: #f85149;">❌ Error: ${e.message}</p>`;
  }
}


function renderSecurityIssues() {
  const container = document.getElementById('securityList');
  const issues = [];
  
  apiCalls.forEach(call => {
    if (call.securityIssues && Array.isArray(call.securityIssues)) {
      call.securityIssues.forEach(issue => {
        issues.push({ ...issue, url: call.url, method: call.method });
      });
    }
  });
  
  if (issues.length === 0) {
    container.innerHTML = '<p class="empty success">✅ No security issues detected!</p>';
    return;
  }
  
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => {
    const aSev = (a.severity || '').toLowerCase();
    const bSev = (b.severity || '').toLowerCase();
    return (severityOrder[aSev] || 99) - (severityOrder[bSev] || 99);
  });
  
  // Debug: Log sorted issues
  console.log('Sorted issues:', issues.map(i => i.severity));
  
  container.innerHTML = issues.map(issue => `
    <div class="issue-card severity-${issue.severity}">
      <div class="issue-header">
        <span class="severity">${issue.severity.toUpperCase()}</span>
        <span class="issue-type">${issue.type}</span>
        <span style="font-size: 11px; color: #999; margin-left: auto;">${issue.owasp || 'N/A'}</span>
      </div>
      <p class="issue-message">${issue.message}</p>
      <p class="issue-url">${issue.method} ${issue.url}</p>
      ${issue.recommendation ? `<p style="font-size: 12px; color: #4ec9b0; margin: 0;">💡 ${issue.recommendation}</p>` : ''}
    </div>
  `).join('');
}

function renderPerformance() {
  const container = document.getElementById('performanceList');
  const slowCalls = apiCalls.filter(call => call.duration > 500)
    .sort((a, b) => b.duration - a.duration);
  
  if (slowCalls.length === 0) {
    container.innerHTML = '<p class="empty success">✅ All APIs performing well!</p>';
    return;
  }
  
  container.innerHTML = slowCalls.map(call => `
    <div class="perf-card">
      <div class="perf-header">
        <span class="method ${call.method}">${call.method}</span>
        <span class="url">${call.url}</span>
      </div>
      <div class="perf-time ${call.duration > 1000 ? 'critical' : 'warning'}">
        ${call.duration}ms
      </div>
    </div>
  `).join('');
}

function renderPageMapping() {
  const container = document.getElementById('mappingList');
  
  // Group API calls by page URL
  const pageMap = {};
  
  apiCalls.forEach(call => {
    try {
      const url = new URL(call.url);
      const pageKey = call.pageUrl || url.origin;
      
      // Extract route from page URL
      let route = '/';
      if (call.pageUrl) {
        try {
          const pageUrlObj = new URL(call.pageUrl);
          route = pageUrlObj.pathname || '/';
        } catch (e) {
          route = call.pageUrl;
        }
      }
      
      if (!pageMap[route]) {
        pageMap[route] = [];
      }
      
      // Check if this API is already in the list for this route
      const exists = pageMap[route].some(api => 
        api.url === call.url && api.method === call.method
      );
      
      if (!exists) {
        pageMap[route].push({
          url: call.url,
          method: call.method,
          statusCode: call.statusCode,
          duration: call.duration,
          count: 1
        });
      } else {
        // Increment count
        const api = pageMap[route].find(api => 
          api.url === call.url && api.method === call.method
        );
        if (api) api.count++;
      }
    } catch (e) {
      console.error('Error mapping page:', e);
    }
  });
  
  if (Object.keys(pageMap).length === 0) {
    container.innerHTML = '<p class="empty">No page mapping available yet. Navigate different routes to see mapping.</p>';
    return;
  }
  
  // Sort routes alphabetically
  const sortedRoutes = Object.keys(pageMap).sort();
  
  container.innerHTML = sortedRoutes.map(route => {
    const apis = pageMap[route];
    
    return `
      <div class="mapping-card" style="margin-bottom: 15px;">
        <h3 class="page-url" style="color: #4ec9b0; margin-bottom: 10px;">📄 ${route}</h3>
        <div class="api-count" style="color: #858585; font-size: 12px; margin-bottom: 10px;">
          🔗 ${apis.length} unique API endpoint${apis.length !== 1 ? 's' : ''}
        </div>
        <ul class="api-endpoints" style="list-style: none; padding: 0;">
          ${apis.map(api => {
            const urlObj = new URL(api.url);
            const endpoint = urlObj.pathname + urlObj.search;
            const statusClass = Math.floor(api.statusCode / 100);
            
            return `
              <li style="padding: 8px; margin-bottom: 5px; background: #252526; border-radius: 4px; display: flex; align-items: center; gap: 10px;">
                <span class="method ${api.method}" style="flex-shrink: 0;">${api.method}</span>
                <span style="flex: 1; font-family: monospace; font-size: 11px; color: #c9d1d9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${endpoint}">${endpoint}</span>
                <span class="status status-${statusClass}xx" style="flex-shrink: 0;">${api.statusCode}</span>
                <span style="color: #858585; font-size: 11px; flex-shrink: 0;">${api.duration}ms</span>
                ${api.count > 1 ? `<span style="background: #007acc; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; flex-shrink: 0;">×${api.count}</span>` : ''}
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }).join('');
}

function renderTools() {
  const container = document.getElementById('toolsList');
  
  if (apiCalls.length === 0) {
    container.innerHTML = '<p class="empty">No API calls available.</p>';
    return;
  }
  
  container.innerHTML = `
    <div style="padding: 20px;">
      <button id="exportBtn2" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">Export Report</button>
      <button id="swaggerBtn" style="padding: 10px 20px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">Generate Swagger</button>
    </div>
  `;
  
  document.getElementById('swaggerBtn').addEventListener('click', generateSwagger);
}

function closeApiModal() {
  document.getElementById('apiModal').style.display = 'none';
}

function clearData() {
  if (confirm('Clear all API data?')) {
    apiCalls = [];
    try {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      chrome.runtime.sendMessage({
        type: 'CLEAR_TAB_DATA',
        tabId: tabId
      });
      chrome.storage.local.remove([`tab_${tabId}_calls`, `tab_${tabId}_map`]);
    } catch (e) {
      // Silently ignore
    }
    updateUI();
  }
}

function exportReport() {
  if (apiCalls.length === 0) {
    alert('No API calls to export');
    return;
  }
  
  // Calculate statistics
  const totalCalls = apiCalls.length;
  const allIssues = [];
  apiCalls.forEach(call => {
    if (call.securityIssues && Array.isArray(call.securityIssues)) {
      call.securityIssues.forEach(issue => {
        allIssues.push({ 
          ...issue, 
          url: call.url, 
          method: call.method,
          statusCode: call.statusCode,
          duration: call.duration,
          requestBody: call.requestBody,
          responseBody: call.responseBody,
          responseHeaders: call.responseHeaders
        });
      });
    }
  });
  
  const criticalIssues = allIssues.filter(i => i.severity === 'critical').length;
  const highIssues = allIssues.filter(i => i.severity === 'high').length;
  const mediumIssues = allIssues.filter(i => i.severity === 'medium').length;
  const lowIssues = allIssues.filter(i => i.severity === 'low').length;
  const slowApis = apiCalls.filter(call => call.duration > 500).length;
  const healthScore = calculateHealthScore();
  
  // Sort issues by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => {
    const aSev = (a.severity || '').toLowerCase();
    const bSev = (b.severity || '').toLowerCase();
    return (severityOrder[aSev] || 99) - (severityOrder[bSev] || 99);
  });
  
  // Generate HTML report
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Watchdog Report - ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #007acc; padding-bottom: 20px; }
    .header h1 { color: #007acc; font-size: 32px; margin-bottom: 10px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: #f8f9fa; color: #333; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #e0e0e0; }
    .stat-card.primary { background: #007acc; color: white; border-color: #005a9e; }
    .stat-card.success { background: #28a745; color: white; border-color: #1e7e34; }
    .stat-card.danger { background: #dc3545; color: white; border-color: #bd2130; }
    .stat-card.warning { background: #ffc107; color: #000; border-color: #d39e00; }
    .stat-card.critical { background: #c82333; color: white; border-color: #a71d2a; }
    .stat-card.high { background: #e74c3c; color: white; border-color: #c0392b; }
    .stat-card.medium { background: #ffc107; color: #000; border-color: #d39e00; }
    .stat-card.low { background: #6c757d; color: white; border-color: #545b62; }
    .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 24px; color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; }
    .issue-card { background: #fff; border-left: 4px solid #ccc; padding: 15px; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.3s ease; }
    .issue-card:hover { box-shadow: 0 3px 8px rgba(0,0,0,0.15); transform: translateY(-2px); }
    .issue-card.critical { border-left-color: #c82333; background: #ffe5e5; }
    .issue-card.high { border-left-color: #e74c3c; background: #ffebeb; }
    .issue-card.medium { border-left-color: #ffc107; background: #fffbf0; }
    .issue-card.low { border-left-color: #6c757d; background: #f8f9fa; }
    .issue-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
    .expand-icon { margin-left: auto; font-size: 18px; transition: transform 0.3s ease; }
    .issue-card.expanded .expand-icon { transform: rotate(180deg); }
    .issue-details { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
    .issue-card.expanded .issue-details { max-height: 2000px; }
    .response-section { margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; }
    .response-label { font-weight: bold; color: #666; font-size: 12px; margin-bottom: 5px; }
    .response-content { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px; overflow-x: auto; max-height: 300px; overflow-y: auto; }
    .response-meta { display: flex; gap: 15px; margin-bottom: 10px; font-size: 12px; }
    .severity-badge { padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .severity-badge.critical { background: #c82333; color: white; }
    .severity-badge.high { background: #e74c3c; color: white; }
    .severity-badge.medium { background: #ffc107; color: #000; }
    .severity-badge.low { background: #6c757d; color: white; }
    .status-badge { padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; margin-left: 5px; }
    .status-badge.success { background: #28a745; color: white; }
    .status-badge.redirect { background: #17a2b8; color: white; }
    .status-badge.client-error { background: #ffc107; color: #000; }
    .status-badge.server-error { background: #dc3545; color: white; }
    .issue-type { font-size: 12px; color: #666; font-family: monospace; }
    .owasp-tag { font-size: 11px; color: #999; margin-left: auto; }
    .issue-message { color: #333; margin-bottom: 8px; font-size: 14px; }
    .issue-url { font-size: 12px; color: #666; font-family: monospace; background: #f5f5f5; padding: 5px 8px; border-radius: 3px; display: inline-block; }
    .recommendation { font-size: 13px; color: #0066cc; margin-top: 8px; padding: 8px; background: #e7f3ff; border-radius: 4px; }
    .api-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .api-table th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    .api-table td { padding: 12px; border-bottom: 1px solid #eee; }
    .api-table tr:hover { background: #f9f9f9; }
    .method { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; display: inline-block; }
    .method.GET { background: #4ec9b0; color: #000; }
    .method.POST { background: #ce9178; color: #000; }
    .method.PUT { background: #dcdcaa; color: #000; }
    .method.DELETE { background: #f48771; color: #000; }
    .method.PATCH { background: #c586c0; color: #000; }
    .status { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; display: inline-block; }
    .status.success { background: #4ec9b0; color: #000; }
    .status.redirect { background: #dcdcaa; color: #000; }
    .status.client-error { background: #ce9178; color: #000; }
    .status.server-error { background: #f48771; color: #000; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
      .issue-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>API Watchdog Security Report</h1>
      <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
    </div>

    <div class="stats">
      <div class="stat-card primary">
        <div class="stat-value">${totalCalls}</div>
        <div class="stat-label">Total API Calls</div>
      </div>
      <div class="stat-card ${allIssues.length === 0 ? 'success' : 'danger'}">
        <div class="stat-value">${allIssues.length}</div>
        <div class="stat-label">Security Issues</div>
      </div>
      <div class="stat-card ${slowApis === 0 ? 'success' : 'warning'}">
        <div class="stat-value">${slowApis}</div>
        <div class="stat-label">Slow APIs (&gt;500ms)</div>
      </div>
      <div class="stat-card ${healthScore >= 80 ? 'success' : healthScore >= 50 ? 'warning' : 'danger'}">
        <div class="stat-value">${healthScore}</div>
        <div class="stat-label">Health Score</div>
      </div>
    </div>

    ${allIssues.length > 0 ? `
    <div class="section">
      <h2 class="section-title">🔒 Security Issues Summary</h2>
      <div class="stats">
        ${criticalIssues > 0 ? `<div class="stat-card critical"><div class="stat-value">${criticalIssues}</div><div class="stat-label">Critical</div></div>` : ''}
        ${highIssues > 0 ? `<div class="stat-card high"><div class="stat-value">${highIssues}</div><div class="stat-label">High</div></div>` : ''}
        ${mediumIssues > 0 ? `<div class="stat-card medium"><div class="stat-value">${mediumIssues}</div><div class="stat-label">Medium</div></div>` : ''}
        ${lowIssues > 0 ? `<div class="stat-card low"><div class="stat-value">${lowIssues}</div><div class="stat-label">Low</div></div>` : ''}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">🚨 Detailed Security Issues</h2>
      ${allIssues.map((issue, index) => {
        const statusClass = issue.statusCode >= 200 && issue.statusCode < 300 ? 'success' :
                           issue.statusCode >= 300 && issue.statusCode < 400 ? 'redirect' :
                           issue.statusCode >= 400 && issue.statusCode < 500 ? 'client-error' : 'server-error';
        return `
        <div class="issue-card ${issue.severity}" onclick="toggleIssue(${index})">
          <div class="issue-header">
            <span class="severity-badge ${issue.severity}">${issue.severity}</span>
            <span class="status-badge ${statusClass}">${issue.statusCode}</span>
            <span class="issue-type">${issue.type}</span>
            ${issue.owasp ? `<span class="owasp-tag">${issue.owasp}</span>` : ''}
            <span class="expand-icon">▼</span>
          </div>
          <div class="issue-message">${issue.message}</div>
          <div class="issue-url">${issue.method} ${issue.url}</div>
          ${issue.recommendation ? `<div class="recommendation">💡 <strong>Recommendation:</strong> ${issue.recommendation}</div>` : ''}
          
          <div class="issue-details">
            <div class="response-section">
              <div class="response-meta">
                <div><strong>Status Code:</strong> ${issue.statusCode}</div>
                <div><strong>Duration:</strong> ${issue.duration}ms</div>
                <div><strong>Method:</strong> ${issue.method}</div>
              </div>
              
              ${issue.requestBody ? `
                <div class="response-label" style="margin-top: 15px;">📤 Request Payload:</div>
                <pre class="response-content">${JSON.stringify(issue.requestBody, null, 2)}</pre>
              ` : ''}
              
              ${issue.responseBody ? `
                <div class="response-label" style="margin-top: 15px;">📥 Response Body:</div>
                <pre class="response-content">${JSON.stringify(issue.responseBody, null, 2)}</pre>
              ` : '<div class="response-label" style="margin-top: 15px;">No response body available</div>'}
              
              ${issue.responseHeaders && issue.responseHeaders.length > 0 ? `
                <div class="response-label" style="margin-top: 15px;">📋 Response Headers:</div>
                <pre class="response-content">${issue.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\n')}</pre>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      }).join('')}
    </div>
    ` : '<div class="section"><h2 class="section-title">✅ No Security Issues Detected</h2><p style="color: #28a745; font-size: 18px;">All API calls passed security checks!</p></div>'}

    <div class="section">
      <h2 class="section-title">📊 API Calls Overview</h2>
      <table class="api-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          ${apiCalls.map(call => {
            const statusClass = call.statusCode >= 200 && call.statusCode < 300 ? 'success' :
                               call.statusCode >= 300 && call.statusCode < 400 ? 'redirect' :
                               call.statusCode >= 400 && call.statusCode < 500 ? 'client-error' : 'server-error';
            return `
              <tr>
                <td><span class="method ${call.method}">${call.method}</span></td>
                <td style="font-family: monospace; font-size: 12px; word-break: break-all;">${call.url}</td>
                <td><span class="status ${statusClass}">${call.statusCode}</span></td>
                <td>${call.duration}ms</td>
                <td>${call.securityIssues?.length || 0}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    ${slowApis > 0 ? `
    <div class="section">
      <h2 class="section-title">⚠️ Performance Issues</h2>
      <table class="api-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${apiCalls.filter(call => call.duration > 500).sort((a, b) => b.duration - a.duration).map(call => `
            <tr>
              <td><span class="method ${call.method}">${call.method}</span></td>
              <td style="font-family: monospace; font-size: 12px; word-break: break-all;">${call.url}</td>
              <td style="color: ${call.duration > 1000 ? '#dc3545' : '#fd7e14'}; font-weight: bold;">${call.duration}ms</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>Generated by API Watchdog Chrome Extension</p>
      <p>This report can be printed to PDF using your browser's print function (Ctrl+P / Cmd+P)</p>
      <p style="margin-top: 10px; color: #007acc;">💡 Click on any security issue card to expand and view API response details</p>
    </div>
  </div>
  
  <script>
    function toggleIssue(index) {
      const cards = document.querySelectorAll('.issue-card');
      const card = cards[index];
      if (card) {
        card.classList.toggle('expanded');
      }
    }
  </script>
</body>
</html>`;

  // Create and download HTML file
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-watchdog-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
  
  alert('✅ Report generated! Open the HTML file in your browser.\n\nTip: Use Ctrl+P (Cmd+P) to save as PDF.');
}

function generateSwagger() {
  if (apiCalls.length === 0) {
    alert('No API calls');
    return;
  }
  
  const firstUrl = new URL(apiCalls[0].url);
  const swagger = {
    openapi: '3.0.0',
    info: { title: 'API Watchdog', version: '1.0.0' },
    servers: [{ url: `${firstUrl.protocol}//${firstUrl.host}` }],
    paths: {}
  };
  
  apiCalls.forEach(call => {
    const url = new URL(call.url);
    const path = url.pathname;
    const method = call.method.toLowerCase();
    
    if (!swagger.paths[path]) swagger.paths[path] = {};
    swagger.paths[path][method] = {
      summary: `${call.method} ${path}`,
      responses: { [call.statusCode]: { description: 'Response' } }
    };
  });
  
  const blob = new Blob([JSON.stringify(swagger, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swagger-${Date.now()}.json`;
  a.click();
}

function generateTests() {
  alert('Feature coming soon');
}
