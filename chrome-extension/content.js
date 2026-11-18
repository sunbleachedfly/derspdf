(() => {
  if (window.__derspdfInitialized) return;
  window.__derspdfInitialized = true;

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }

  function bgFetchDataUrl(url) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve('');
        return;
      }
      try {
        chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url }, (res) => {
          if (chrome.runtime.lastError || !res) resolve('');
          else resolve(res.dataUrl || '');
        });
      } catch (_) {
        resolve('');
      }
    });
  }

  async function urlToDataUrl(url, origImgEl) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;

    if (origImgEl) {
      try {
        if (origImgEl.complete && origImgEl.naturalWidth > 0) {
          const c = document.createElement('canvas');
          c.width = origImgEl.naturalWidth;
          c.height = origImgEl.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(origImgEl, 0, 0);
          const dataUrl = c.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 50) return dataUrl;
        }
      } catch (_) {}
    }

    const bgData = await bgFetchDataUrl(url);
    if (bgData) return bgData;

    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (resp.ok) {
        const blob = await resp.blob();
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl) return dataUrl;
      }
    } catch (_) {}

    return url;
  }

  // Light DOM + Shadow DOM içindeki tüm görselleri derinlemesine topla
  function collectDeepMedia(root, results = { imgs: [], bgUrls: [], canvases: [] }) {
    if (!root) return results;

    if (root.nodeType === 1) {
      const tag = root.tagName;
      if (tag === 'IMG') {
        const rect = root.getBoundingClientRect();
        const w = root.naturalWidth || rect.width || 0;
        const h = root.naturalHeight || rect.height || 0;
        // Küçük UI ikonlarını (avatar vs.) hariç tut, gerçek içerik görsellerini al
        if (w >= 48 || h >= 48 || (root.src && root.src.includes('googleusercontent'))) {
          results.imgs.push(root);
        }
      } else if (tag === 'CANVAS') {
        const rect = root.getBoundingClientRect();
        if (rect.width >= 48 || rect.height >= 48) {
          results.canvases.push(root);
        }
      } else {
        try {
          const bg = getComputedStyle(root).backgroundImage;
          if (bg && bg !== 'none' && bg.includes('url(')) {
            const rect = root.getBoundingClientRect();
            if (rect.width >= 64 && rect.height >= 64) {
              const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
              if (m && m[1] && !m[1].startsWith('data:image/svg')) {
                results.bgUrls.push(m[1]);
              }
            }
          }
        } catch (_) {}
      }

      if (root.shadowRoot) {
        collectDeepMedia(root.shadowRoot, results);
      }
    }

    const children = root.children || root.childNodes || [];
    for (const child of children) {
      if (child.nodeType === 1) {
        collectDeepMedia(child, results);
      }
    }
    return results;
  }

  async function openPrintView() {
    const floatBtn = document.getElementById('derspdf-floating-btn');
    if (floatBtn) floatBtn.textContent = '⏳ Görseller hazırlanıyor...';

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
    closeBtn.textContent = "✕ Gemini'ye Dön";
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

    let totalImages = 0;

    for (const node of rootNodes) {
      const deep = collectDeepMedia(node);
      const lightImgs = Array.from(node.querySelectorAll('img'));

      const clone = node.cloneNode(true);
      clone
        .querySelectorAll(
          'button, mat-icon, .feedback-buttons, .response-footer, .tts-button-container, .copy-button'
        )
        .forEach((el) => el.remove());

      // Light DOM'daki img'leri dönüştür
      const clonedImgs = Array.from(clone.querySelectorAll('img'));
      const handledSrcs = new Set();

      await Promise.all(
        clonedImgs.map(async (cImg, idx) => {
          const origImg = lightImgs[idx];
          const rawSrc = (origImg && (origImg.currentSrc || origImg.src)) || cImg.src || '';
          if (rawSrc) handledSrcs.add(rawSrc);
          if (origImg) {
            const dataUrl = await urlToDataUrl(rawSrc, origImg);
            if (dataUrl) cImg.src = dataUrl;
          }
          totalImages++;
          cImg.removeAttribute('loading');
          cImg.removeAttribute('srcset');
          cImg.style.cssText =
            'position:static !important;max-width:100% !important;width:auto !important;height:auto !important;max-height:700px;border-radius:8px;margin:12px 0;display:block !important;opacity:1 !important;visibility:visible !important;';
        })
      );

      // Shadow DOM içinde kalan veya arka plan görseli olanları ayrıca ekle
      for (const sImg of deep.imgs) {
        const sSrc = sImg.currentSrc || sImg.src || '';
        if (sSrc && !handledSrcs.has(sSrc)) {
          handledSrcs.add(sSrc);
          const dataUrl = await urlToDataUrl(sSrc, sImg);
          const newImg = document.createElement('img');
          newImg.src = dataUrl || sSrc;
          newImg.style.cssText =
            'max-width:100% !important;height:auto !important;max-height:700px;border-radius:8px;margin:12px 0;display:block !important;';
          clone.appendChild(newImg);
          totalImages++;
        }
      }

      for (const bgUrl of deep.bgUrls) {
        if (!handledSrcs.has(bgUrl)) {
          handledSrcs.add(bgUrl);
          const dataUrl = await urlToDataUrl(bgUrl, null);
          const newImg = document.createElement('img');
          newImg.src = dataUrl || bgUrl;
          newImg.style.cssText =
            'max-width:100% !important;height:auto !important;max-height:700px;border-radius:8px;margin:12px 0;display:block !important;';
          clone.appendChild(newImg);
          totalImages++;
        }
      }

      for (const cEl of deep.canvases) {
        try {
          const dataUrl = cEl.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 50) {
            const newImg = document.createElement('img');
            newImg.src = dataUrl;
            newImg.style.cssText =
              'max-width:100% !important;height:auto !important;border-radius:8px;margin:12px 0;display:block !important;';
            clone.appendChild(newImg);
            totalImages++;
          }
        } catch (_) {}
      }

      box.appendChild(clone);
    }

    // Eğer konuşma düğümleri dışında kalan (ör. main altındaki) görseller varsa onları da yakala
    if (totalImages === 0) {
      const mainRoot = document.querySelector('main') || document.body;
      const fallbackMedia = collectDeepMedia(mainRoot);
      const seen = new Set();
      for (const fImg of fallbackMedia.imgs) {
        const src = fImg.currentSrc || fImg.src || '';
        if (src && !seen.has(src)) {
          seen.add(src);
          const dataUrl = await urlToDataUrl(src, fImg);
          const newImg = document.createElement('img');
          newImg.src = dataUrl || src;
          newImg.style.cssText =
            'max-width:100% !important;height:auto !important;max-height:700px;border-radius:8px;margin:12px 0;display:block !important;';
          box.appendChild(newImg);
          totalImages++;
        }
      }
    }

    leftTitle.textContent = `∑ DersPDF — Önizleme (${totalImages} görsel)`;

    if (!document.getElementById('derspdf-print-style')) {
      const st = document.createElement('style');
      st.id = 'derspdf-print-style';
      st.textContent =
        '@media print { .derspdf-no-print { display: none !important; } body { background: #fff !important; } #derspdf-print-root img, #derspdf-print-root pre, #derspdf-print-root table { break-inside: avoid; page-break-inside: avoid; } #derspdf-print-root img { display: block !important; opacity: 1 !important; visibility: visible !important; } }';
      document.head.appendChild(st);
    }

    Array.from(document.body.children).forEach((el) => {
      el.dataset.dpOrig = el.style.display;
      el.style.display = 'none';
    });

    document.body.appendChild(box);
    if (floatBtn) floatBtn.textContent = '📄 PDF Yap';

    setTimeout(() => window.print(), 450);
  }

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
