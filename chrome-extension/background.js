chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'DERSPDF_PRINT' });
  } catch (e) {
    // Sayfa yeni yüklendiyse veya Gemini değilse içeriğe script enjekte etmeyi dene
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'DERSPDF_PRINT' });
    } catch (_) {}
  }
});
