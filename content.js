// Content script to check for AI protection meta tags

// Flag to indicate if content script is active, is not active until initial scan completes
var isActive = false;

(function() {
  'use strict';

  // Check for meta robots tags on page load and changes
  function checkMetaRobotsTags() {
    const metaTags = document.querySelectorAll('meta[name="robots" i]');
    let hasNoAI = false;
    let hasNoImageAI = false;

    // Check each robots meta tag
    metaTags.forEach(tag => {
      const content = tag.getAttribute('content');
      if (content) {
        const directives = parseRobotsContent(content);
        if (directives.includes('noai')) {
          hasNoAI = true;
        }
        if (directives.includes('noimageai')) {
          hasNoImageAI = true;
        }
      }
    });

    return {
      hasNoAI,
      hasNoImageAI,
      url: window.location.href,
      timestamp: Date.now()
    };
  }

  // Parse robots meta content and normalize directives
  function parseRobotsContent(content) {
    return content
      .toLowerCase()
      .split(',')
      .map(directive => directive.trim())
      .filter(directive => directive.length > 0);
  }

  // Send results to background script
  function sendResultsToBackground(results, isInitial = false) {
    console.log("PMA: Trying to send results", results);
    try {
      chrome.runtime.sendMessage({
        type: 'AI_PROTECTION_STATUS',
        data: results,
        isInitial: isInitial
      }).catch(error => {
        console.debug('Protect My Art: Error sending message to background script:', error);
      });
    } catch (error) {
      console.debug('Protect My Art: Runtime not available:', error);
    }
    if (isInitial) {
      isActive = true; // Mark as active after initial scan
    }
  }

  // Initial check when content script loads
  function performInitialCheck() {
    // Wait a bit for dynamic content to load
    setTimeout(() => {
      const results = checkMetaRobotsTags();
      sendResultsToBackground(results, true);
    }, 100);
  }

  // Debounced function to avoid excessive checking
  let checkTimeout;
  function debouncedCheck() {
    console.log("PMA: Debounced check triggered");
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      const results = checkMetaRobotsTags();
      sendResultsToBackground(results);
    }, 500);
  }

  function checkIfMutationRelevant(mutations) {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.tagName === 'META' &&
            node.getAttribute('name') &&
            node.getAttribute('name').toLowerCase() === 'robots'
          ) {
            shouldCheck = true;
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.tagName === 'META' &&
            node.getAttribute('name') &&
            node.getAttribute('name').toLowerCase() === 'robots'
          ) {
            shouldCheck = true;
          }
        });
      }
      if (
        mutation.type === 'attributes' &&
        mutation.target.tagName === 'META' &&
        mutation.target.getAttribute('name') &&
        mutation.target.getAttribute('name').toLowerCase() === 'robots' &&
        mutation.attributeName === 'content'
      ) {
        shouldCheck = true;
      }
  });
  return shouldCheck;
  }

  // Monitor for dynamic changes to meta tags
  function setupDynamicMonitoring() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      shouldCheck = checkIfMutationRelevant(mutations);

      if (shouldCheck) {
        console.log("PMA: Detected relevant DOM mutation, rechecking meta tags");
        debouncedCheck();
      }
    });

    // Start observing
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['name', 'content']
    });

    return observer;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performInitialCheck);
  } else {
    performInitialCheck();
  }

  // Set up dynamic monitoring
  let observer;
  if (document.readyState !== 'loading') {
    observer = setupDynamicMonitoring();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer = setupDynamicMonitoring();
    });
  }

  // Clean up observer when page unloads
  window.addEventListener('beforeunload', () => {
    if (observer) {
      observer.disconnect();
    }
  });

  // Listen for scan request from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REQUEST_TAB_SCAN') {
      const results = checkMetaRobotsTags();
      sendResultsToBackground(results); // still updates
      console.log("PMA: Sent scan results to background:", results);
      sendResponse(results); // <-- Send actual scan results as response
      return true; // <-- Keep channel open for async response
    }
    if (message.type === 'IS_CONTENT_SCRIPT_ACTIVE') {
      return sendResponse({ active: isActive });
    }
  });

})();