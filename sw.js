// The toolbar button just opens a new tab; everything else lives in the page.
chrome.action.onClicked.addListener(() => chrome.tabs.create({}));
