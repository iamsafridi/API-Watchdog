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
        <h3 style="color: #fff;">🔒 Security Issues</h3>
        ${call.securityIssues.map(issue => `
          <div style="background: #3d2817; padding: 10px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid #ffc107; color: #e0e0e0;">
            <strong style="color: #ffc107;">${issue.severity}:</strong> ${issue.message}
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
  
  modal.style.display = 'block';
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
  issues.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));
  
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
  container.innerHTML = '<p class="empty">Page mapping data</p>';
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
  
  const report = {
    timestamp: new Date().toISOString(),
    totalCalls: apiCalls.length,
    apiCalls: apiCalls
  };
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-watchdog-${Date.now()}.json`;
  a.click();
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
