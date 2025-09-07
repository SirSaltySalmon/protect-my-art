// Popup script for Protect My Art extension
'use strict';

// DOM elements
let elements = {};

// Status messages and explanations
const STATUS_MESSAGES = {
  fullyProtected: {
    title: 'Fully Protected',
    subtitle: 'This site has comprehensive AI protection',
    explanation: 'This website includes both general AI and image AI protection tags, providing comprehensive protection against AI training usage.'
  },
  partiallyProtected: {
    title: 'Partially Protected',
    subtitle: 'This site has some AI protection',
    explanation: 'This website has partial AI protection. Some types of AI training are restricted, but not all.'
  },
  notProtected: {
    title: 'Not Protected',
    subtitle: 'No AI protection tags found',
    explanation: 'This website does not include AI protection tags. Content may be used for AI training purposes.'
  },
  checking: {
    title: 'Checking...',
    subtitle: 'Scanning for AI protection tags',
    explanation: 'Please wait while we check this page for AI protection tags.'
  },
  error: {
    title: 'Unable to Check',
    subtitle: 'This page cannot be analyzed',
    explanation: 'This page cannot be checked for AI protection tags. This may be a special browser page or restricted content. If you have only just installed the extension, refreshing might fix it.'
  }
};

const TAG_EXPLANATIONS = {
  noai: 'Requests that AI systems do not use this content for training purposes',
  noimageai: 'Specifically requests that AI systems do not use images from this site for training'
};

// Initialize popup with timeout and better error handling
async function initializePopup() {
  // Get DOM elements
  elements = {
    statusIndicator: document.getElementById('status-indicator'),
    statusIcon: document.getElementById('status-icon'),
    statusTitle: document.getElementById('status-title'),
    statusSubtitle: document.getElementById('status-subtitle'),
    tagsSection: document.getElementById('tags-section'),
    noaiStatus: document.getElementById('noai-status'),
    noimageaiStatus: document.getElementById('noimageai-status'),
    explanationSection: document.getElementById('explanation-section'),
    explanationText: document.getElementById('explanation-text'),
    loadingSection: document.getElementById('loading-section'),
    errorSection: document.getElementById('error-section'),
    learnMoreLink: document.getElementById('learn-more-link'),
    contactLink: document.getElementById('contact-link'),
    privacyLink: document.getElementById('privacy-link')
  };

  // Set up event listeners
  setupEventListeners();

  // Initial status fetch with timeout
  showLoadingState();
  console.log("Popup opened, checking active tab");
  
  try {
    // Add timeout to prevent hanging
    const tabQuery = new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    });

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tab query timeout')), 3000);
    });

    const tabs = await Promise.race([tabQuery, timeout]);
    const tab = tabs[0];

    if (!tab) {
      console.log("No active tab found");
      showErrorState();
      return;
    }

    console.log("Found active tab:", tab.url, "Status:", tab.status);

    // Check if tab is still loading
    if (tab.status === 'loading') {
      console.log("Tab is still loading, setting up tab update listener");
      handleLoadingTab(tab);
      return;
    }

    if (isRestrictedPage(tab.url)) {
      console.log("Restricted page detected:", tab.url);
      showRestrictedPageState();
      return;
    }

    // Tab is complete, proceed normally
    await checkContentScriptAndGetStatus(tab.id);

  } catch (error) {
    console.error("Error in initializePopup:", error);
    showErrorState();
  }
}

// Handle tabs that are still loading
function handleLoadingTab(tab) {
  console.log("Setting up listener for loading tab:", tab.id);

  let timeoutId;

  // Set up listener for tab updates
  const tabUpdateListener = (updatedTabId, changeInfo) => {
    if (updatedTabId === tab.id && changeInfo.status === 'complete') {
      console.log("Tab finished loading:", tab.url);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);

      // Clear the timeout since we've handled the tab load
      clearTimeout(timeoutId);

      if (isRestrictedPage(tab.url)) {
        console.log("Loaded tab is restricted:", tab.url);
        showRestrictedPageState();
        return;
      }

      checkContentScriptAndGetStatus(tab.id);
    }
  };

  chrome.tabs.onUpdated.addListener(tabUpdateListener);

  // Set up a fallback timeout in case the tab never finishes loading
  timeoutId = setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
    console.log("Timeout waiting for tab to load, attempting to get status anyway");
    checkContentScriptAndGetStatus(tabId);
  }, 10000); // 10 second timeout
}

// Check content script status and get tab status
async function checkContentScriptAndGetStatus(tabId) {
  try {
    const isContentActive = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'IS_CONTENT_SCRIPT_ACTIVE' }, (response) => {
        // If there's an error, assume content script is not active
        if (chrome.runtime.lastError) {
          console.log("Content script check error:", chrome.runtime.lastError.message);
          resolve(false);
        } else {
          resolve(response);
        }
      });
    });
    
    console.log("Content script active status:", isContentActive);

    if (!isContentActive) {
      console.log("Content script not active, setting up listener for activation");
      
      // Set up listener for content script activation
      const messageListener = (message, sender, sendResponse) => {
        if (message.type === 'INITIAL_SCAN_COMPLETE') {
          console.log("Content script activated, getting status");
          chrome.runtime.onMessage.removeListener(messageListener);
          getCurrentTabStatus();
          sendResponse({ received: true });
        }
      };
      
      chrome.runtime.onMessage.addListener(messageListener);
      
      // Set up a fallback timeout
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.log("Timeout waiting for content script, getting status anyway");
        getCurrentTabStatus();
      }, 5000); // 5 second timeout
      
    } else {
      console.log("Content script ready, getting status immediately");
      getCurrentTabStatus();
    }
  } catch (error) {
    console.error("Error checking content script:", error);
    getCurrentTabStatus(); // Try anyway
  }
}

function getCurrentTabStatus(force_get_new_status = false) {
  showLoadingState();
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error('No active tab found');
      showErrorState();
      return;
    }
    
    const tabId = tabs[0].id;
    chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS', force_get_new_status, tabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting tab status:', chrome.runtime.lastError);
        showErrorState();
        return;
      }
      
      if (response) {
        updatePopupDisplay(response);
      } else {
        showErrorState();
      }
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  // Contact link
  if (elements.contactLink) {
    elements.contactLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'https://www.instagram.com/protect_my_art/'
      });
    });
  }
}

// Update popup display based on tab status
function updatePopupDisplay(status) {
  hideAllSections();
  
  if (status.error || status.noData) {
    console.log("Status indicates error or no data:", status);
    if (isRestrictedPage(status.url)) {
      console.log("Restricted page detected:", status.url);
      showRestrictedPageState();
    } else {
      showLoadingState();
      // Retry after a short delay
      setTimeout(() => {
        getCurrentTabStatus();
      }, 1000);
    }
    return;
  }
  
  // Show main content
  elements.tagsSection.style.display = 'block';
  elements.explanationSection.style.display = 'block';
  
  // Determine protection status
  let statusKey;
  if (status.hasNoAI && status.hasNoImageAI) {
    statusKey = 'fullyProtected';
  } else if (status.hasNoAI || status.hasNoImageAI) {
    statusKey = 'partiallyProtected';
  } else {
    statusKey = 'notProtected';
  }
  
  // Update status indicator
  updateStatusIndicator(statusKey, status);
  
  // Update tag statuses
  updateTagStatus('noai', status.hasNoAI);
  updateTagStatus('noimageai', status.hasNoImageAI);
  
  // Update explanation text
  updateExplanationText(statusKey, status);
}

// Update status indicator
function updateStatusIndicator(statusKey, status) {
  const statusInfo = STATUS_MESSAGES[statusKey];
  
  // Remove existing status classes
  elements.statusIndicator.className = 'status-indicator';
  elements.statusIcon.className = 'status-icon';
  
  // Add appropriate status class
  if (status.hasProtection) {
    elements.statusIndicator.classList.add('protected');
    elements.statusIcon.classList.add('protected');
    elements.statusIcon.textContent = '✓';
  } else {
    elements.statusIndicator.classList.add('unprotected');
    elements.statusIcon.classList.add('unprotected');
    elements.statusIcon.textContent = '✗';
  }
  
  // Update text
  elements.statusTitle.textContent = statusInfo.title;
  elements.statusSubtitle.textContent = statusInfo.subtitle;
}

// Update individual tag status
function updateTagStatus(tagName, isPresent) {
  const element = elements[tagName + 'Status'];
  if (!element) return;
  
  // Remove existing classes
  element.className = 'tag-item';
  
  // Add status class
  if (isPresent) {
    element.classList.add('present');
  } else {
    element.classList.add('absent');
  }
}

// Update explanation text
function updateExplanationText(statusKey, status) {
  const statusInfo = STATUS_MESSAGES[statusKey];
  elements.explanationText.textContent = statusInfo.explanation;
}

// Show loading state
function showLoadingState() {
  hideAllSections();
  elements.loadingSection.style.display = 'block';
  
  // Update status indicator for loading
  elements.statusIndicator.className = 'status-indicator';
  elements.statusIcon.className = 'status-icon checking';
  elements.statusIcon.textContent = '?';
  elements.statusTitle.textContent = STATUS_MESSAGES.checking.title;
  elements.statusSubtitle.textContent = STATUS_MESSAGES.checking.subtitle;
}

// Show error state
function showErrorState() {
  hideAllSections();
  elements.errorSection.style.display = 'block';
  
  // Update status indicator for error
  elements.statusIndicator.className = 'status-indicator';
  elements.statusIcon.className = 'status-icon unprotected';
  elements.statusIcon.textContent = '!';
  elements.statusTitle.textContent = STATUS_MESSAGES.error.title;
  elements.statusSubtitle.textContent = STATUS_MESSAGES.error.subtitle;
}

// Show restricted page state (chrome://, moz-extension://, etc.)
function showRestrictedPageState() {
  hideAllSections();
  elements.errorSection.style.display = 'block';
  
  // Update error section content for restricted pages
  const errorIcon = elements.errorSection.querySelector('.error-icon');
  const errorText = elements.errorSection.querySelector('p');
  
  if (errorIcon) errorIcon.textContent = '🔒';
  if (errorText) {
    errorText.textContent = 'This extension cannot analyze special browser pages like settings, new tab, or other extensions for security reasons. If you have only just installed the extension, refreshing the webpage might fix it. Or, if timeout (10s) have occured, try the refresh icon on this popup.';
  }
  
  // Update status indicator
  elements.statusIndicator.className = 'status-indicator';
  elements.statusIcon.className = 'status-icon unprotected';
  elements.statusIcon.textContent = '🔒';
  elements.statusTitle.textContent = 'Restricted Page';
  elements.statusSubtitle.textContent = 'Cannot analyze this page';
}

// Hide all content sections
function hideAllSections() {
  elements.tagsSection.style.display = 'none';
  elements.explanationSection.style.display = 'none';
  elements.loadingSection.style.display = 'none';
  elements.errorSection.style.display = 'none';
}

// Check if URL is a restricted page
function isRestrictedPage(url) {
  if (!url) {
    return true;
  }
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://',
    'view-source:',
    'opera://',
    'vivaldi://'
  ];
  
  return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

// Format URL for display
function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url || 'Unknown';
  }
}

// Add refresh capability
function addRefreshButton() {
  const header = document.querySelector('.header .logo');
  if (header) {
    const refreshButton = document.createElement('button');
    refreshButton.innerHTML = '↻';
    refreshButton.title = 'Refresh status';
    refreshButton.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      margin-left: auto;
    `;
    refreshButton.addEventListener('click', () => getCurrentTabStatus(true));
    header.appendChild(refreshButton);
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

// Add refresh button after initialization
setTimeout(() => {
  addRefreshButton();
}, 100);