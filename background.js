// Background service worker for Protect My Art extension
'use strict';

// Store tab statuses
const tabStatuses = new Map();

// Update extension icon based on protection status
async function updateIcon(tabId, hasProtection) {
  try {
    // Update badge text for additional visual feedback
    const badgeText = hasProtection ? '✓' : '✗';
    const badgeColor = hasProtection ? '#4CAF50' : '#F44336';
    
    await chrome.action.setBadgeText({
      tabId: tabId,
      text: badgeText
    });

    await chrome.action.setBadgeBackgroundColor({
      tabId: tabId,
      color: badgeColor
    });

  } catch (error) {
    console.error('Error updating icon:', error);
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AI_PROTECTION_STATUS' && sender.tab) {
    const tabId = sender.tab.id;
    const { hasNoAI, hasNoImageAI, url, timestamp } = message.data;

    // Determine if site has any protection
    const hasProtection = hasNoAI || hasNoImageAI;

    console.log("Received tab status, ", message.data, "for tab:", tabId);
    // Store status for this tab
    tabStatuses.set(tabId, {
      hasNoAI,
      hasNoImageAI,
      hasProtection,
      url,
      timestamp,
      tabId
    });

    // Update icon
    updateIcon(tabId, hasProtection);

    // Send acknowledgment
    sendResponse({ success: true });

    if (message.isInitial) {
      chrome.runtime.sendMessage({
        type: 'INITIAL_SCAN_COMPLETE',
      });
    }
    return;
  }

  if (message.type === 'GET_TAB_STATUS') {
    handleGetTabStatus(message, sender, sendResponse);
    return true; // Indicate async response
  }
});

async function handleGetTabStatus(message, sender, sendResponse) {
  const tabId = message.tabId;
  var status = tabStatuses.get(tabId);
  if (status) {
    if (!message.force_get_new_status && !status.noData && !status.error) {
      console.log("Sending existing tab status to popup:", status);
      sendResponse(status);
      return;
    }
  }

  console.log("Had to request new scan from content script for tab:", tabId);
  console.log("Existing status:", status, "force_get_new_status:", message.force_get_new_status);

  // Request content script to scan and wait for results
  const results = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'REQUEST_TAB_SCAN' }, (response) => {
      resolve(response);
    });
  });

  // Defensive fallback if results is undefined
  const safeResults = results || {
    hasNoAI: false,
    hasNoImageAI: false,
    url: null,
    timestamp: Date.now(),
    tabId: tabId,
    noData: true
  };

  // Update tabStatuses immediately
  tabStatuses.set(tabId, {
    ...safeResults,
    hasProtection: safeResults.hasNoAI || safeResults.hasNoImageAI,
    tabId: tabId
  });

  status = tabStatuses.get(tabId);

  console.log("Got tab status, sending to popup:", status);
  sendResponse(status);

  return true; // Keep message channel open for async response
}

// Handle tab updates (navigation, refresh, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    updateIcon(tabId, false);
    // Rescanning is already handled by content script on page load
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStatuses.delete(tabId);
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  tabStatuses.clear();
});

// Handle extension installation/enable
chrome.runtime.onInstalled.addListener(() => {
  tabStatuses.clear();
});

// Handle tab activation (switching between tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  const status = tabStatuses.get(tabId);
  
  if (status) {
    // Update icon for the newly active tab
    updateIcon(tabId, status.hasProtection);
  } else {
    // No status yet, default to negative
    updateIcon(tabId, false);
  }
});

// Periodic cleanup of old tab statuses
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [tabId, status] of tabStatuses.entries()) {
    if (now - status.timestamp > maxAge) {
      tabStatuses.delete(tabId);
    }
  }
}, 60 * 60 * 1000); // Run cleanup every hour