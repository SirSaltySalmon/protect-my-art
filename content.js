// Content script to check for AI protection meta tags
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
  function sendResultsToBackground(results) {
    try {
      chrome.runtime.sendMessage({
        type: 'AI_PROTECTION_STATUS',
        data: results
      }).catch(error => {
        console.debug('Protect My Art: Error sending message to background script:', error);
      });
    } catch (error) {
      console.debug('Protect My Art: Runtime not available:', error);
    }
  }

  // Initial check when content script loads
  function performInitialCheck() {
    // Wait a bit for dynamic content to load
    setTimeout(() => {
      const results = checkMetaRobotsTags();
      sendResultsToBackground(results);
    }, 100);
  }

  // Debounced function to avoid excessive checking
  let checkTimeout;
  function debouncedCheck() {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      const results = checkMetaRobotsTags();
      sendResultsToBackground(results);
    }, 500);
  }

  // Monitor for dynamic changes to meta tags
  function setupDynamicMonitoring() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if any added nodes are meta tags or contain meta tags
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'META' || node.querySelector('meta')) {
                shouldCheck = true;
              }
            }
          });
        }
        
        if (mutation.type === 'attributes' && 
            mutation.target.tagName === 'META' && 
            (mutation.attributeName === 'name' || mutation.attributeName === 'content')) {
          shouldCheck = true;
        }
      });

      if (shouldCheck) {
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

  // Handle visibility changes (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Tab became visible, do a quick check
      setTimeout(() => {
        const results = checkMetaRobotsTags();
        sendResultsToBackground(results);
      }, 100);
    }
  });

})();