chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'DERSPDF_PRINT' });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'DERSPDF_PRINT' });
    } catch (_) {}
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'FETCH_IMAGE' && msg.url) {
    fetch(msg.url, { credentials: 'include' })
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ dataUrl: reader.result || '' });
        reader.onerror = () => sendResponse({ dataUrl: '' });
        reader.readAsDataURL(blob);
      })
      .catch(() => sendResponse({ dataUrl: '' }));
    return true; // async sendResponse
  }
});
