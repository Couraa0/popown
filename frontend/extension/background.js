// background.js - YouTube AI Companion background service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("YouTube AI Companion extension installed.");
});

// Configure the side panel to open when clicking the extension's toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));
