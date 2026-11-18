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

  // Light DOM + Shadow DOM'u yerinde (orijinal sırasını bozmadan) kopyala
  function cloneWithShadow(node, imgPairs) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tag = node.tagName.toLowerCase();

    // Gereksiz UI buton ve ikonlarını atla (ama içinde görsel/canvas barındıran butonları SİLME!)
    if (
      tag === 'mat-icon' ||
      node.classList.contains('feedback-buttons') ||
      node.classList.contains('response-footer') ||
      node.classList.contains('tts-button-container') ||
      node.classList.contains('copy-button')
    ) {
      return null;
    }

    if (tag === 'button') {
      const hasMedia = node.querySelector('img, canvas') || node.shadowRoot;
      if (!hasMedia) return null;
    }

    // Canvas'ı doğrudan PNG img'ye çevir
    if (tag === 'canvas') {
      const rect = node.getBoundingClientRect();
      if (rect.width >= 48 || rect.height >= 48) {
        try {
          const dataUrl = node.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 50) {
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.cssText =
              'max-width:100%;height:auto;border-radius:8px;margin:10px 0;display:block;';
            imgPairs.push({ orig: null, clone: img, alreadyData: true });
            return img;
          }
        } catch (_) {}
      }
      return null;
    }

    // Özel Web Component etiketlerini (shadowRoot varsa) veya görsel saran butonları normal div'e çevir
    const hasShadow = !!node.shadowRoot;
    const out = (hasShadow || tag === 'button')
      ? document.createElement('div')
      : document.createElement(tag);

    // Özellikleri kopyala
    for (const attr of node.attributes) {
      if (attr.name === 'loading' || attr.name === 'srcset') continue;
      try {
        out.setAttribute(attr.name, attr.value);
      } catch (_) {}
    }

    if (tag === 'img') {
      const rect = node.getBoundingClientRect();
      const w = node.naturalWidth || rect.width || 0;
      const h = node.naturalHeight || rect.height || 0;
      const src = node.currentSrc || node.src || '';
      if (w >= 48 || h >= 48 || src.includes('googleusercontent') || src.startsWith('blob:') || src.startsWith('data:')) {
        imgPairs.push({ orig: node, clone: out, alreadyData: false });
      } else {
        return null; // Küçük UI ikonlarını gizle
      }
    }

    // CSS background-image kontrolü
    try {
      const bg = getComputedStyle(node).backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) {
        const rect = node.getBoundingClientRect();
        if (rect.width >= 64 && rect.height >= 64) {
          const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (m && m[1] && !m[1].startsWith('data:image/svg')) {
            const bgImg = document.createElement('img');
            bgImg.src = m[1];
            imgPairs.push({ orig: null, clone: bgImg, rawUrl: m[1], alreadyData: false });
            out.appendChild(bgImg);
          }
        }
      }
    } catch (_) {}

    // Önce Shadow DOM çocuklarını, sonra Light DOM çocuklarını aynı sırayla kopyala
    if (node.shadowRoot) {
      for (const sChild of node.shadowRoot.childNodes) {
        const clonedChild = cloneWithShadow(sChild, imgPairs);
        if (clonedChild) out.appendChild(clonedChild);
      }
    }
    for (const child of node.childNodes) {
      const clonedChild = cloneWithShadow(child, imgPairs);
      if (clonedChild) out.appendChild(clonedChild);
    }

    return out;
  }

  function applyTheme(isDark, box, bar, leftTitle, closeBtn, themeBtn) {
    if (isDark) {
      box.classList.add('derspdf-dark');
      box.style.background = '#111827';
      box.style.color = '#f1f5f9';
      bar.style.background = '#111827';
      bar.style.borderBottomColor = '#2dd4bf';
      leftTitle.style.color = '#2dd4bf';
      closeBtn.style.background = '#1e293b';
      closeBtn.style.color = '#f1f5f9';
      themeBtn.style.background = '#1e293b';
      themeBtn.style.color = '#f1f5f9';
      themeBtn.textContent = '☀️ Açık Mod';
    } else {
      box.classList.remove('derspdf-dark');
      box.style.background = '#ffffff';
      box.style.color = '#111827';
      bar.style.background = '#ffffff';
      bar.style.borderBottomColor = '#0F5C52';
      leftTitle.style.color = '#0F5C52';
      closeBtn.style.background = '#eef0f2';
      closeBtn.style.color = '#111827';
      themeBtn.style.background = '#eef0f2';
      themeBtn.style.color = '#111827';
      themeBtn.textContent = '🌙 Koyu Mod';
    }
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

    let isDark = localStorage.getItem('derspdf_dark_mode') === '1';

    const box = document.createElement('div');
    box.id = 'derspdf-print-root';
    box.style.cssText =
      'padding:28px;max-width:840px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.65;min-height:100vh;';

    const bar = document.createElement('div');
    bar.className = 'derspdf-no-print';
    bar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:22px;padding:12px 0;border-bottom:2px solid #0F5C52;position:sticky;top:0;z-index:10;';

    const leftTitle = document.createElement('div');
    leftTitle.textContent = '∑ DersPDF — Önizleme';
    leftTitle.style.cssText = 'font-weight:700;font-size:16px;';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    const themeBtn = document.createElement('button');
    themeBtn.style.cssText =
      'border:none;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;';

    const printBtn = document.createElement('button');
    printBtn.textContent = '📄 PDF Kaydet / Yazdır';
    printBtn.style.cssText =
      'background:#0F5C52;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;';
    printBtn.onclick = () => window.print();

    const closeBtn = document.createElement('button');
    closeBtn.textContent = "✕ Gemini'ye Dön";
    closeBtn.style.cssText =
      'border:none;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;';
    closeBtn.onclick = () => {
      box.remove();
      Array.from(document.body.children).forEach((el) => {
        if (el.dataset.dpOrig !== undefined) {
          el.style.display = el.dataset.dpOrig;
          delete el.dataset.dpOrig;
        }
      });
    };

    themeBtn.onclick = () => {
      isDark = !isDark;
      localStorage.setItem('derspdf_dark_mode', isDark ? '1' : '0');
      applyTheme(isDark, box, bar, leftTitle, closeBtn, themeBtn);
    };

    btnGroup.append(themeBtn, printBtn, closeBtn);
    bar.append(leftTitle, btnGroup);
    box.appendChild(bar);

    applyTheme(isDark, box, bar, leftTitle, closeBtn, themeBtn);

    const imgPairs = [];
    for (const node of rootNodes) {
      const cloned = cloneWithShadow(node, imgPairs);
      if (cloned) box.appendChild(cloned);
    }

    // Tüm görselleri bulundukları yerde base64'e çevir
    await Promise.all(
      imgPairs.map(async (pair) => {
        if (!pair.alreadyData) {
          const rawUrl = pair.rawUrl || (pair.orig && (pair.orig.currentSrc || pair.orig.src)) || pair.clone.src || '';
          const dataUrl = await urlToDataUrl(rawUrl, pair.orig);
          if (dataUrl) pair.clone.src = dataUrl;
        }
        pair.clone.style.cssText =
          'position:static !important;max-width:100% !important;width:auto !important;height:auto !important;max-height:700px;border-radius:8px;margin:12px 0;display:block !important;opacity:1 !important;visibility:visible !important;';

        let p = pair.clone.parentElement;
        for (let d = 0; d < 5 && p && p !== box; d++) {
          p.style.position = 'static';
          p.style.height = 'auto';
          p.style.minHeight = '0';
          p.style.overflow = 'visible';
          p.style.opacity = '1';
          p.style.visibility = 'visible';
          p = p.parentElement;
        }
      })
    );

    leftTitle.textContent = `∑ DersPDF — Önizleme (${imgPairs.length} görsel)`;

    if (!document.getElementById('derspdf-print-style')) {
      const st = document.createElement('style');
      st.id = 'derspdf-print-style';
      st.textContent = `
        #derspdf-print-root.derspdf-dark * { color: #e2e8f0 !important; border-color: #334155 !important; }
        #derspdf-print-root.derspdf-dark pre, #derspdf-print-root.derspdf-dark code { background: #1e293b !important; color: #f8fafc !important; }
        #derspdf-print-root.derspdf-dark a { color: #38bdf8 !important; }
        @media print {
          .derspdf-no-print { display: none !important; }
          body { background: #fff !important; margin: 0 !important; }
          body:has(#derspdf-print-root.derspdf-dark) { background: #111827 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #derspdf-print-root.derspdf-dark { background: #111827 !important; color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #derspdf-print-root img, #derspdf-print-root pre, #derspdf-print-root table { break-inside: avoid; page-break-inside: avoid; }
          #derspdf-print-root img { display: block !important; opacity: 1 !important; visibility: visible !important; }
        }
      `;
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
