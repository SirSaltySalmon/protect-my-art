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
  }
  
  return true; // Keep message channel open for async response
});

// Handle tab updates (navigation, refresh, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    // Reset to negative icon while page loads
    updateIcon(tabId, false);
    
    // Clear old status
    tabStatuses.delete(tabId);
    
    // Set temporary status
    tabStatuses.set(tabId, {
      hasNoAI: false,
      hasNoImageAI: false,
      hasProtection: false,
      url: tab.url,
      timestamp: Date.now(),
      tabId,
      loading: true
    });
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

// Provide status to popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_STATUS') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]) {
          const status = tabStatuses.get(tabs[0].id) || {
            hasNoAI: false,
            hasNoImageAI: false,
            hasProtection: false,
            url: tabs[0].url,
            timestamp: Date.now(),
            tabId: tabs[0].id,
            noData: true
          };
          sendResponse(status);
        } else {
          sendResponse({
            hasNoAI: false,
            hasNoImageAI: false,
            hasProtection: false,
            url: '',
            timestamp: Date.now(),
            tabId: null,
            error: true
          });
        }
      })
      .catch(error => {
        console.error('Error getting tab status:', error);
        sendResponse({
          hasNoAI: false,
          hasNoImageAI: false,
          hasProtection: false,
          url: '',
          timestamp: Date.now(),
          tabId: null,
          error: true
        });
      });
    
    return true; // Keep message channel open for async response
  }
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