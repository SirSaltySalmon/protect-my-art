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
    explanation: 'This page cannot be checked for AI protection tags. This may be a special browser page or restricted content.'
  }
};

const TAG_EXPLANATIONS = {
  noai: 'Requests that AI systems do not use this content for training purposes',
  noimageai: 'Specifically requests that AI systems do not use images from this site for training'
};

// Initialize popup
function initializePopup() {
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

  // Get current tab status
  getCurrentTabStatus();
}

// Set up event listeners
function setupEventListeners() {
  // Contact link
  if (elements.contactLink) {
    elements.contactLink.addEventListener('click', (e) => {
      e.preventDefault();
      // You can replace this with your actual contact page
      chrome.tabs.create({
        url: 'https://www.instagram.com/protect_my_art/'
      });
    });
  }
}

// Get current tab status from background script
function getCurrentTabStatus() {
  showLoadingState();
  
  chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS' }, (response) => {
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
}

// Update popup display based on tab status
function updatePopupDisplay(status) {
  hideAllSections();
  
  if (status.error || status.noData) {
    if (isRestrictedPage(status.url)) {
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
  
  // Update additional information
  updateAdditionalInfo(status);
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

// Update additional information
function updateAdditionalInfo(status) {
  let infoText = '';
  
  if (status.hasNoAI && status.hasNoImageAI) {
    infoText = 'This website has requested protection for both general AI training and image-specific AI training. This is the most comprehensive protection available.';
  } else if (status.hasNoAI) {
    infoText = 'This website has requested general AI training protection, but does not specifically protect images. Image AI systems may still use content from this site.';
  } else if (status.hasNoImageAI) {
    infoText = 'This website specifically protects images from AI training, but does not request general AI training protection for other content.';
  } else {
    infoText = 'This website has not implemented AI protection tags. Media uploaded here will not be able to withdraw consent from crawlers.';
  }
  
  elements.additionalText.textContent = infoText;
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
    errorText.textContent = 'This extension cannot analyze special browser pages like settings, new tab, or other extensions for security reasons.';
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
  if (!url) return true;
  
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://',
    ''
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

// Refresh button handler
function handleRefresh() {
  getCurrentTabStatus();
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
    refreshButton.addEventListener('click', handleRefresh);
    header.appendChild(refreshButton);
  }
}

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Popup became visible, refresh status
    getCurrentTabStatus();
  }
});

// Auto-refresh every 30 seconds while popup is open
let autoRefreshInterval;
function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    if (!document.hidden) {
      getCurrentTabStatus();
    }
  }, 30000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Start auto-refresh when popup opens
startAutoRefresh();

// Clean up when popup closes
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleRefresh();
  }
});

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