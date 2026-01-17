// Service Worker for Chrome Extension Manifest V3

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    // Forward extraction request to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startExtraction' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'getStoredData') {
    chrome.storage.local.get(['activecampaign_data'], (result) => {
      sendResponse({ data: result.activecampaign_data || null });
    });
    return true;
  }

  if (request.action === 'deleteRecord') {
    const { type, id } = request;
    // Use atomic operations to handle race conditions
    chrome.storage.local.get(['activecampaign_data'], (result) => {
      const data = result.activecampaign_data || { contacts: [], deals: [], tasks: [] };
      
      if (data[type]) {
        data[type] = data[type].filter(item => item.id !== id);
        chrome.storage.local.set({ activecampaign_data: data }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
      } else {
        sendResponse({ success: false, error: 'Invalid data type' });
      }
    });
    return true;
  }

  if (request.action === 'exportData') {
    chrome.storage.local.get(['activecampaign_data'], (result) => {
      sendResponse({ data: result.activecampaign_data || null });
    });
    return true;
  }
});

// Listen for storage changes to sync across tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.activecampaign_data) {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'dataUpdated',
          data: changes.activecampaign_data.newValue
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    });
  }
});
