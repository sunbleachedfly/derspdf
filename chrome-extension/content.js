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
      node.classList.contains('sr-only') ||
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

  function applyTheme(theme, box, bar, leftTitle, closeBtn, themeBtn) {
    box.classList.remove('derspdf-dark', 'derspdf-paper');
    box.style.backgroundImage = 'none';

    if (theme === 'dark') {
      box.classList.add('derspdf-dark');
      box.style.backgroundColor = '#000000';
      box.style.color = '#f5f5f5';
      bar.style.backgroundColor = '#000000';
      bar.style.borderBottomColor = '#2dd4bf';
      leftTitle.style.color = '#2dd4bf';
      closeBtn.style.backgroundColor = '#1a1a1a';
      closeBtn.style.color = '#f5f5f5';
      themeBtn.style.backgroundColor = '#1a1a1a';
      themeBtn.style.color = '#f5f5f5';
      themeBtn.textContent = '🌙 Siyah Mod';
    } else if (theme === 'paper') {
      box.classList.add('derspdf-paper');
      box.style.backgroundColor = '#FBF5E3';
      box.style.backgroundImage =
        `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`;
      box.style.backgroundSize = '200px 200px';
      box.style.color = '#1C1917';
      bar.style.backgroundColor = '#FBF5E3';
      bar.style.borderBottomColor = '#B45309';
      leftTitle.style.color = '#92400E';
      closeBtn.style.backgroundColor = '#EFE6CE';
      closeBtn.style.color = '#1C1917';
      themeBtn.style.backgroundColor = '#EFE6CE';
      themeBtn.style.color = '#1C1917';
      themeBtn.textContent = '📜 Sarı Kağıt';
    } else {
      box.style.backgroundColor = '#ffffff';
      box.style.color = '#111827';
      bar.style.backgroundColor = '#ffffff';
      bar.style.borderBottomColor = '#0F5C52';
      leftTitle.style.color = '#0F5C52';
      closeBtn.style.backgroundColor = '#eef0f2';
      closeBtn.style.color = '#111827';
      themeBtn.style.backgroundColor = '#eef0f2';
      themeBtn.style.color = '#111827';
      themeBtn.textContent = '☀️ Beyaz Mod';
    }
  }

  async function openPrintView() {
    const floatBtn = document.getElementById('derspdf-floating-btn');
    if (floatBtn) floatBtn.textContent = '⏳ Hazırlanıyor...';

    const old = document.getElementById('derspdf-print-root');
    if (old) old.remove();

    const isChatGPT =
      location.hostname.includes('chatgpt.com') ||
      location.hostname.includes('chat.openai.com');

    let turns;
    if (isChatGPT) {
      turns = document.querySelectorAll('[data-message-author-role]');
      if (!turns.length) {
        turns = document.querySelectorAll('main article, [data-testid*="conversation-turn"]');
      }
      if (!turns.length) {
        turns = document.querySelectorAll('[data-message-id], .markdown, .whitespace-pre-wrap');
      }
    } else {
      turns = document.querySelectorAll('user-query, model-response');
      if (!turns.length) {
        turns = document.querySelectorAll('.conversation-container');
      }
    }
    const rootNodes = turns.length
      ? Array.from(turns)
      : [document.querySelector('main') || document.body];

    const themes = ['light', 'paper', 'dark'];
    let currentTheme = localStorage.getItem('derspdf_theme') || (localStorage.getItem('derspdf_dark_mode') === '1' ? 'dark' : 'light');
    if (!themes.includes(currentTheme)) currentTheme = 'light';

    const box = document.createElement('div');
    box.id = 'derspdf-print-root';
    box.style.cssText =
      'position:fixed;inset:0;z-index:999999;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.65;';

    const inner = document.createElement('div');
    inner.id = 'derspdf-print-inner';
    inner.style.cssText = 'max-width:840px;margin:0 auto;padding:0 24px 64px;';

    const bar = document.createElement('div');
    bar.className = 'derspdf-no-print';
    bar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:22px;padding:14px 0;border-bottom:2px solid #0F5C52;position:sticky;top:0;z-index:10;';

    const leftTitle = document.createElement('div');
    leftTitle.textContent = '∑ DersPDF — Önizleme';
    leftTitle.style.cssText = 'font-weight:700;font-size:16px;';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '☑️ Tümünü Kaldır';
    selectAllBtn.style.cssText =
      'border:1px solid rgba(128,128,128,0.3);background:transparent;color:inherit;padding:9px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;';

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
      const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
      currentTheme = themes[nextIdx];
      localStorage.setItem('derspdf_theme', currentTheme);
      applyTheme(currentTheme, box, bar, leftTitle, closeBtn, themeBtn);
    };

    btnGroup.append(selectAllBtn, themeBtn, printBtn, closeBtn);
    bar.append(leftTitle, btnGroup);
    inner.appendChild(bar);
    box.appendChild(inner);

    applyTheme(currentTheme, box, bar, leftTitle, closeBtn, themeBtn);

    const imgPairs = [];
    const msgEntries = [];

    function updateSelectionSummary() {
      const selectedCount = msgEntries.filter((m) => m.checkbox.checked).length;
      leftTitle.textContent = `∑ DersPDF (${selectedCount}/${msgEntries.length} mesaj • ${imgPairs.length} görsel)`;
      selectAllBtn.textContent =
        selectedCount === msgEntries.length ? '☑️ Tümünü Kaldır' : '✅ Tümünü Seç';
    }

    selectAllBtn.onclick = () => {
      const allSelected = msgEntries.every((m) => m.checkbox.checked);
      const nextState = !allSelected;
      msgEntries.forEach((m) => {
        m.checkbox.checked = nextState;
        m.wrapper.classList.toggle('derspdf-excluded', !nextState);
      });
      updateSelectionSummary();
    };

    for (const node of rootNodes) {
      let cloned = cloneWithShadow(node, imgPairs);
      if (!cloned) continue;

      // Eğer klonlanan düğümde görünür metin veya görsel kalmadıysa düz metni kurtar
      const hasContent =
        (cloned.textContent && cloned.textContent.trim().length > 0) ||
        cloned.querySelector('img');
      if (!hasContent) {
        const rawFallback = (node.innerText || node.textContent || '').trim();
        if (!rawFallback) continue;
        cloned = document.createElement('div');
        cloned.style.whiteSpace = 'pre-wrap';
        cloned.textContent = rawFallback;
      }

      cloned.style.opacity = '1';
      cloned.style.visibility = 'visible';
      cloned.style.height = 'auto';
      cloned.style.maxHeight = 'none';
      cloned.style.overflow = 'visible';
      cloned.style.position = 'static';
      cloned.style.transform = 'none';

      const wrapper = document.createElement('div');
      wrapper.className = 'derspdf-msg-wrapper';
      wrapper.style.cssText = 'margin-bottom:18px;transition:opacity 0.15s;';

      const tagName = node.tagName ? node.tagName.toLowerCase() : '';
      const gptRole =
        node.getAttribute('data-message-author-role') ||
        (node.querySelector('[data-message-author-role]') &&
          node.querySelector('[data-message-author-role]').getAttribute('data-message-author-role'));
      const isUser = tagName === 'user-query' || gptRole === 'user';
      const labelText = isUser
        ? '👤 Senin Mesajın'
        : tagName === 'model-response'
          ? '✨ Gemini Yanıtı'
          : gptRole === 'assistant'
            ? '🤖 ChatGPT Yanıtı'
            : '💬 Konuşma';

      const msgHeader = document.createElement('label');
      msgHeader.className = 'derspdf-no-print derspdf-msg-select';
      msgHeader.style.cssText =
        'display:inline-flex;align-items:center;gap:8px;padding:5px 11px;margin-bottom:8px;border-radius:999px;border:1px solid rgba(128,128,128,0.28);font-size:12.5px;font-weight:600;cursor:pointer;user-select:none;';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.style.cssText = 'width:16px;height:16px;accent-color:#0F5C52;cursor:pointer;margin:0;';

      const lblSpan = document.createElement('span');
      lblSpan.textContent = labelText;

      cb.addEventListener('change', () => {
        wrapper.classList.toggle('derspdf-excluded', !cb.checked);
        updateSelectionSummary();
      });

      msgHeader.append(cb, lblSpan);
      wrapper.append(msgHeader, cloned);
      inner.appendChild(wrapper);
      msgEntries.push({ wrapper, checkbox: cb });
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
        for (let d = 0; d < 5 && p && p !== inner; d++) {
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

    updateSelectionSummary();

    if (!document.getElementById('derspdf-print-style')) {
      const st = document.createElement('style');
      st.id = 'derspdf-print-style';
      st.textContent = `
        #derspdf-print-root .derspdf-excluded { opacity: 0.32; }
        #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) * { color: #111827 !important; background-color: transparent !important; border-color: #d1d5db !important; }
        #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) .derspdf-msg-select { background-color: #f3f4f6 !important; border-color: #d1d5db !important; color: #111827 !important; }
        #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) user-query, #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) .user-query-bubble-with-background, #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) .query-content, #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) [data-message-author-role="user"], #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) .user-message-bubble-color { background-color: #f3f4f6 !important; border-radius: 12px !important; padding: 8px 12px !important; }
        #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) pre, #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) code { background-color: #f3f4f6 !important; color: #111827 !important; }
        #derspdf-print-root:not(.derspdf-dark):not(.derspdf-paper) a { color: #0f5c52 !important; }

        #derspdf-print-root.derspdf-paper * { color: #1C1917 !important; background-color: transparent !important; border-color: #DFD3B4 !important; }
        #derspdf-print-root.derspdf-paper .derspdf-msg-select { background-color: #EFE6CE !important; border-color: #D8C9A3 !important; color: #1C1917 !important; }
        #derspdf-print-root.derspdf-paper user-query, #derspdf-print-root.derspdf-paper .user-query-bubble-with-background, #derspdf-print-root.derspdf-paper .query-content, #derspdf-print-root.derspdf-paper [data-message-author-role="user"], #derspdf-print-root.derspdf-paper .user-message-bubble-color { background-color: #F2E9CF !important; border-radius: 12px !important; padding: 8px 12px !important; }
        #derspdf-print-root.derspdf-paper pre, #derspdf-print-root.derspdf-paper code { background-color: #F4ECD6 !important; color: #1C1917 !important; }
        #derspdf-print-root.derspdf-paper a { color: #0F5C52 !important; }

        #derspdf-print-root.derspdf-dark * { color: #f5f5f5 !important; background-color: transparent !important; border-color: #2a2a2a !important; }
        #derspdf-print-root.derspdf-dark .derspdf-msg-select { background-color: #141414 !important; border-color: #333333 !important; }
        #derspdf-print-root.derspdf-dark user-query, #derspdf-print-root.derspdf-dark .user-query-bubble-with-background, #derspdf-print-root.derspdf-dark .query-content, #derspdf-print-root.derspdf-dark [data-message-author-role="user"], #derspdf-print-root.derspdf-dark .user-message-bubble-color { background-color: #161616 !important; border-radius: 12px !important; padding: 8px 12px !important; }
        #derspdf-print-root.derspdf-dark pre, #derspdf-print-root.derspdf-dark code { background-color: #141414 !important; color: #f5f5f5 !important; }
        #derspdf-print-root.derspdf-dark a { color: #38bdf8 !important; }
        @media print {
          .derspdf-no-print, .derspdf-excluded { display: none !important; }
          html, body { overflow: visible !important; height: auto !important; background: #fff !important; margin: 0 !important; }
          #derspdf-print-root { position: static !important; inset: auto !important; overflow: visible !important; height: auto !important; }
          #derspdf-print-inner { padding: 0 !important; max-width: none !important; }
          body:has(#derspdf-print-root.derspdf-paper) { background: #FBF5E3 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #derspdf-print-root.derspdf-paper { background-color: #FBF5E3 !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E") !important; background-size: 200px 200px !important; color: #1C1917 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body:has(#derspdf-print-root.derspdf-dark) { background: #000000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #derspdf-print-root.derspdf-dark { background: #000000 !important; color: #f5f5f5 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
