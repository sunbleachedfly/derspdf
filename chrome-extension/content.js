(() => {
  if (window.__derspdfInitialized) return;
  window.__derspdfInitialized = true;

  function openPrintView() {
    const old = document.getElementById('derspdf-print-root');
    if (old) old.remove();

    const turns = document.querySelectorAll(
      'user-query, model-response, .conversation-container'
    );
    const rootNodes = turns.length
      ? Array.from(turns)
      : [document.querySelector('main') || document.body];

    const box = document.createElement('div');
    box.id = 'derspdf-print-root';
    box.style.cssText =
      'background:#fff;color:#111;padding:28px;max-width:840px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.65;min-height:100vh;';

    const bar = document.createElement('div');
    bar.className = 'derspdf-no-print';
    bar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;padding:12px 0;border-bottom:2px solid #0F5C52;position:sticky;top:0;background:#fff;z-index:10;';

    const leftTitle = document.createElement('div');
    leftTitle.textContent = '∑ DersPDF — Yazdırma / PDF Önizleme';
    leftTitle.style.cssText = 'font-weight:700;font-size:16px;color:#0F5C52;';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:10px;';

    const printBtn = document.createElement('button');
    printBtn.textContent = '📄 PDF Kaydet / Yazdır';
    printBtn.style.cssText =
      'background:#0F5C52;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;';
    printBtn.onclick = () => window.print();

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Gemini\'ye Dön';
    closeBtn.style.cssText =
      'background:#eef0f2;color:#111;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;';
    closeBtn.onclick = () => {
      box.remove();
      Array.from(document.body.children).forEach((el) => {
        if (el.dataset.dpOrig !== undefined) {
          el.style.display = el.dataset.dpOrig;
          delete el.dataset.dpOrig;
        }
      });
    };

    btnGroup.append(printBtn, closeBtn);
    bar.append(leftTitle, btnGroup);
    box.appendChild(bar);

    rootNodes.forEach((node) => {
      const clone = node.cloneNode(true);
      clone
        .querySelectorAll(
          'button, mat-icon, .feedback-buttons, .response-footer, .tts-button-container, .copy-button'
        )
        .forEach((el) => el.remove());

      clone.querySelectorAll('img').forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '10px 0';
        img.style.display = 'block';
      });

      box.appendChild(clone);
    });

    if (!document.getElementById('derspdf-print-style')) {
      const st = document.createElement('style');
      st.id = 'derspdf-print-style';
      st.textContent =
        '@media print { .derspdf-no-print { display: none !important; } body { background: #fff !important; } #derspdf-print-root img, #derspdf-print-root pre, #derspdf-print-root table { break-inside: avoid; page-break-inside: avoid; } }';
      document.head.appendChild(st);
    }

    Array.from(document.body.children).forEach((el) => {
      el.dataset.dpOrig = el.style.display;
      el.style.display = 'none';
    });

    document.body.appendChild(box);
    setTimeout(() => window.print(), 350);
  }

  // Gemini sayfasında sağ alt köşeye küçük bir "PDF Yap" butonu ekle
  function addFloatingButton() {
    if (document.getElementById('derspdf-floating-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'derspdf-floating-btn';
    btn.className = 'derspdf-no-print';
    btn.textContent = '📄 PDF Yap';
    btn.title = 'Bu Gemini konuşmasını görselleriyle PDF yap';
    btn.style.cssText =
      'position:fixed;right:20px;bottom:20px;z-index:99999;background:#0F5C52;color:#fff;border:none;padding:11px 16px;border-radius:999px;font-weight:600;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,0.22);cursor:pointer;font-family:-apple-system,sans-serif;';
    btn.onclick = openPrintView;
    document.body.appendChild(btn);
  }

  addFloatingButton();
  const obs = new MutationObserver(() => addFloatingButton());
  obs.observe(document.body, { childList: true, subtree: false });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'DERSPDF_PRINT') {
        openPrintView();
      }
    });
  }
})();
