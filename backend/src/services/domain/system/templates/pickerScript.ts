export const pickerScript = `
<style id="pg-picker-styles">
  #pg-picker-toolbar * { box-sizing: border-box; }
  .pg-highlight { outline: 3px solid #38bdf8 !important; outline-offset: -3px !important; cursor: crosshair !important; background: rgba(56, 189, 248, 0.2) !important; }
  
  /* Workstation Dark Theme for Inspector - Force Visibility */
  html, body { 
    background-color: #0f172a !important; 
    color: #f1f5f9 !important; 
    border-color: #1e293b !important;
  }
  
  /* Force readability on all text elements */
  p, span, div, li, td, th, b, i, strong, em, label { 
    color: #f1f5f9 !important; 
    background-color: transparent !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }
  
  a { color: #38bdf8 !important; text-decoration: underline !important; }
  
  /* High-contrast for header tags */
  h1, h2, h3, h4, h5, h6 { color: #ffffff !important; font-weight: 800 !important; }

  /* Keep images constrained but visible */
  img:not([id^="pg-"]):not([class^="pg-"]) { 
    max-width: 120px !important; 
    max-height: 120px !important; 
    opacity: 0.8 !important; 
    border: 1px solid #475569 !important;
    background: #1e293b;
  }
  img:hover { opacity: 1.0 !important; max-width: 400px !important; max-height: 400px !important; z-index: 1000; }

  /* Force dark background on common containers that might have hardcoded white */
  header, footer, nav, aside, section, main, article, .container, .main, .content {
    background-color: transparent !important;
  }
</style>
<div id="pg-picker-toolbar" style="position: fixed; bottom: 20px; right: 20px; background: rgba(15, 23, 42, 0.95); color: #fff; padding: 12px 18px; border-radius: 12px; font-family: system-ui, sans-serif; font-size: 13px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); z-index: 2147483647; border: 1px solid rgba(255,255,255,0.15); max-width: 400px; backdrop-filter: blur(8px); display: none;">
  <div style="font-weight: 700; margin-bottom: 6px; color: #38bdf8; display: flex; justify-content: space-between; align-items: center;">
    <span>PriceGhost Selector Picker</span>
    <button onclick="document.getElementById('pg-picker-toolbar').style.display='none'" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">&times;</button>
  </div>
  <div style="margin-bottom: 8px;">
    <div style="color: #94a3b8; font-size: 11px; margin-bottom: 2px;">CSS Selector:</div>
    <code id="pg-picker-css" style="background: rgba(0,0,0,0.5); padding: 4px 6px; border-radius: 4px; display: block; word-break: break-all; color: #e2e8f0; font-family: monospace;"></code>
  </div>
  <div id="pg-picker-attr-container" style="margin-bottom: 8px; display: none;">
    <div style="color: #94a3b8; font-size: 11px; margin-bottom: 2px;">Attribute Selector:</div>
    <code id="pg-picker-attr" style="background: rgba(0,0,0,0.5); padding: 4px 6px; border-radius: 4px; display: block; word-break: break-all; color: #fbbf24; font-family: monospace;"></code>
  </div>
  <div style="margin-bottom: 10px;">
    <div style="color: #94a3b8; font-size: 11px; margin-bottom: 2px;">Preview Value:</div>
    <div id="pg-picker-value" style="color: #cbd5e1; max-height: 50px; overflow-y: auto; font-style: italic;"></div>
  </div>
  <div style="display: flex; gap: 6px;">
    <button id="pg-btn-copy-css" style="background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Copy CSS</button>
    <button id="pg-btn-copy-attr" style="background: #d97706; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1; display: none;">Copy Attr</button>
  </div>
</div>
<script>
(function() {
  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (e) {
      return false;
    }
  }

  function getSelector(el) {
    if (el.id) {
      const escapedId = el.id.replace(/(:|\\\\.|\\\\s)/g, '\\\\\\\\$1');
      if (!/^[0-9]/.test(escapedId) && isUnique('#' + escapedId)) return '#' + escapedId;
    }

    const testAttrs = ['data-testid', 'data-test', 'data-automation-id', 'itemprop', 'data-qa'];
    for (const attr of testAttrs) {
      if (el.hasAttribute(attr)) {
        const val = el.getAttribute(attr);
        const sel = '[' + attr + '="' + val + '"]';
        if (isUnique(sel)) return sel;
      }
    }

    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\\\\s+/).filter(c => c && !c.includes(':') && c.length < 30);
      for (const cls of classes) {
        const sel = '.' + cls;
        if (isUnique(sel)) return sel;
      }
    }

    let path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      // Try to find a unique class for this level
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\\\\s+/).filter(c => c && !c.includes(':') && c.length < 30);
        if (classes.length > 0) {
          const firstClassSel = selector + '.' + classes[0];
          if (isUnique(firstClassSel)) return firstClassSel;
        }
      }

      let sibCount = 0;
      let sibIndex = 0;
      let sib = current.previousSibling;
      while (sib) {
        if (sib.nodeType === Node.ELEMENT_NODE && sib.nodeName === current.nodeName) sibCount++;
        sib = sib.previousSibling;
      }
      sibIndex = sibCount + 1;
      
      sib = current.nextSibling;
      let hasMoreSibs = false;
      while (sib) {
        if (sib.nodeType === Node.ELEMENT_NODE && sib.nodeName === current.nodeName) {
          hasMoreSibs = true;
          break;
        }
        sib = sib.nextSibling;
      }
      
      if (sibIndex > 1 || hasMoreSibs) {
        selector += ':nth-of-type(' + sibIndex + ')';
      }
      
      path.unshift(selector);
      const combined = path.join(' > ');
      if (isUnique(combined)) return combined;
      
      if (current.id && !/^[0-9]/.test(current.id)) break;
      current = current.parentNode;
    }
    return path.join(' > ');
  }
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
      return success;
    }
  }
  let lastEl = null;
  document.addEventListener('mouseover', function(e) {
    if (e.target.id && e.target.id.startsWith('pg-picker')) return;
    if (e.target.closest('#pg-picker-toolbar')) return;
    if (lastEl) lastEl.classList.remove('pg-highlight');
    lastEl = e.target;
    lastEl.classList.add('pg-highlight');
  });
  document.addEventListener('mouseout', function(e) {
    if (lastEl === e.target) {
      lastEl.classList.remove('pg-highlight');
      lastEl = null;
    }
  });
  document.addEventListener('click', function(e) {
    if (e.target.id && e.target.id.startsWith('pg-picker')) return;
    if (e.target.closest('#pg-picker-toolbar')) return;
    e.preventDefault();
    e.stopPropagation();
    const selector = getSelector(e.target);
    const toolbar = document.getElementById('pg-picker-toolbar');
    const cssCode = document.getElementById('pg-picker-css');
    const attrCode = document.getElementById('pg-picker-attr');
    const attrContainer = document.getElementById('pg-picker-attr-container');
    const previewVal = document.getElementById('pg-picker-value');
    const btnAttr = document.getElementById('pg-btn-copy-attr');
    cssCode.textContent = selector;
    const tagName = e.target.tagName.toLowerCase();
    let suggestedAttr = null;
    let textPreview = '';
    if (tagName === 'img') {
      suggestedAttr = 'src';
      textPreview = e.target.src || '';
    } else if (tagName === 'meta') {
      suggestedAttr = 'content';
      textPreview = e.target.content || '';
    } else if (tagName === 'link') {
      suggestedAttr = 'href';
      textPreview = e.target.href || '';
    } else {
      textPreview = e.target.textContent.trim();
    }
    if (suggestedAttr) {
      const attrSelector = selector + '::attr(' + suggestedAttr + ')';
      attrCode.textContent = attrSelector;
      attrContainer.style.display = 'block';
      btnAttr.style.display = 'block';
      btnAttr.onclick = function() {
        copyToClipboard(attrSelector);
        const originalText = btnAttr.textContent;
        btnAttr.textContent = 'Copied!';
        setTimeout(function() { btnAttr.textContent = originalText; }, 1500);
      };
    } else {
      attrContainer.style.display = 'none';
      btnAttr.style.display = 'none';
    }
    previewVal.textContent = textPreview.length > 80 ? textPreview.substring(0, 80) + '...' : textPreview;
    const btnCss = document.getElementById('pg-btn-copy-css');
    btnCss.onclick = function() {
      copyToClipboard(selector);
      const originalText = btnCss.textContent;
      btnCss.textContent = 'Copied!';
      setTimeout(function() { btnCss.textContent = originalText; }, 1500);
    };
    toolbar.style.display = 'block';

    // Notify parent frame
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'PG_SELECTOR_PICKED',
        selector: selector,
        value: textPreview
      }, '*');
    }
  }, true);
})();
</script>
`;
