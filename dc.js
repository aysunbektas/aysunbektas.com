/* Minimal template runtime for aysunbektas.com — renders the design templates (sc-for / sc-if / {{ }} ) with state. */
(function () {
  'use strict';
  var RE = /\{\{\s*([^}]+?)\s*\}\}/g;

  function lookup(expr, scopes) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    var parts = expr.split('.');
    for (var s = scopes.length - 1; s >= 0; s--) {
      var sc = scopes[s];
      if (sc && Object.prototype.hasOwnProperty.call(sc, parts[0])) {
        var v = sc;
        for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
        return v;
      }
    }
    return undefined;
  }
  function interp(str, scopes) {
    if (str.indexOf('{{') < 0) return str;
    var single = str.match(/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/);
    if (single) { var v = lookup(single[1], scopes); return v; }
    return str.replace(RE, function (_, e) { var v = lookup(e, scopes); return v == null ? '' : String(v); });
  }
  var EVT = { onclick: 'click', onmousemove: 'mousemove', oninput: 'input', onchange: 'change', onsubmit: 'submit' };

  var SVGNS = 'http://www.w3.org/2000/svg';
  function render(node, scopes, out, ns) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      if (t.indexOf('{{') >= 0) { var v = interp(t, scopes); out.appendChild(document.createTextNode(v == null ? '' : String(v))); }
      else out.appendChild(document.createTextNode(t));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'helmet') return;
    if (tag === 'sc-for') {
      var list = lookup(node.getAttribute('list').replace(/[{}]/g, ''), scopes) || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var sc = {}; sc[as] = list[i]; sc['$index'] = i;
        for (var c = node.firstChild; c; c = c.nextSibling) render(c, scopes.concat([sc]), out, ns);
      }
      return;
    }
    if (tag === 'sc-if') {
      var cond = lookup(node.getAttribute('value').replace(/[{}]/g, ''), scopes);
      if (cond) for (var c2 = node.firstChild; c2; c2 = c2.nextSibling) render(c2, scopes, out, ns);
      return;
    }
    var isSvg = ns || tag === 'svg';
    var el = isSvg ? document.createElementNS(SVGNS, node.tagName) : document.createElement(tag);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, val = attrs[a].value;
      if (name.indexOf('hint-') === 0) continue;
      var ln = name.toLowerCase();
      if (EVT[ln]) {
        var fn = interp(val, scopes);
        if (typeof fn === 'function') { el._h = el._h || {}; el._h[EVT[ln]] = fn; }
        continue;
      }
      var iv = interp(val, scopes);
      if (iv === false || iv == null) { if (name === 'aria-pressed' || name === 'aria-expanded') el.setAttribute(name, 'false'); continue; }
      el.setAttribute(name, iv === true ? '' : String(iv));
    }
    for (var c3 = node.firstChild; c3; c3 = c3.nextSibling) render(c3, scopes, el, isSvg && tag !== 'foreignobject');
    out.appendChild(el);
  }

  window.DCLogic = function (props) { this.props = props || {}; this.state = {}; };
  DCLogic.prototype.setState = function (patch) {
    for (var k in patch) this.state[k] = patch[k];
    var self = this;
    if (!self._raf) self._raf = requestAnimationFrame(function () { self._raf = null; self._render(); });
  };
  DCLogic.prototype._render = function () {
    var vals = this.renderVals ? this.renderVals() : {};
    var frag = document.createElement('div');
    for (var c = this._tpl.firstChild; c; c = c.nextSibling) render(c, [vals], frag);
    var root = this._root;
    if (window.morphdom) {
      morphdom(this._root, frag, {
        childrenOnly: true,
        onBeforeNodeDiscarded: function (node) { return !node._keep; },
        onBeforeNodeAdded: function (node) {
          if (node.nodeType === 1 && node.tagName === 'FORM' && root._formKey) {
            var k = root._formKey(node); var boxes = root.querySelectorAll('[role="status"][data-form]');
            for (var q = 0; q < boxes.length; q++) if (boxes[q].getAttribute('data-form') === k) return false;
          }
          return node;
        },
        onBeforeElUpdated: function (from, to) {
          if (from._keep) return false;
          if (to._h) from._h = to._h; else if (from._h) from._h = null;
          if (from.classList && from.classList.contains('in') && to.classList && to.classList.contains('rv')) to.classList.add('in');
          if (from === document.activeElement && (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA' || from.tagName === 'SELECT')) { return false; }
          if (from.tagName === 'VIDEO' && from.getAttribute('src') === to.getAttribute('src')) return false;
          return true;
        }
      });
    } else { this._root.innerHTML = ''; while (frag.firstChild) this._root.appendChild(frag.firstChild); }
    reveal(this._root);
  };
  var io = null;
  function reveal(root) {
    var els = root.querySelectorAll('.rv:not(.in)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { for (var i = 0; i < els.length; i++) els[i].classList.add('in'); return; }
    if (!io) io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) if (entries[j].isIntersecting) { entries[j].target.classList.add('in'); io.unobserve(entries[j].target); }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    for (var k = 0; k < els.length; k++) if (!els[k]._rv) { els[k]._rv = true; io.observe(els[k]); }
  }

  function delegate(root, type) {
    root.addEventListener(type, function (e) {
      var el = e.target;
      while (el && el !== root) {
        if (el._h && el._h[type]) {
          try { Object.defineProperty(e, 'currentTarget', { value: el, configurable: true }); } catch (err) {}
          try { el._h[type].call(el, e); } finally { try { delete e.currentTarget; } catch (err) {} }
          if (type === 'click') break;
        }
        el = el.parentNode;
      }
    }, type === 'mousemove' ? { passive: true } : false);
  }

  function boot() {
    var tplEl = document.getElementById('dc-template');
    var root = document.getElementById('dc-root');
    if (!tplEl || !root) return;
    var tpl = tplEl.content ? tplEl.content : tplEl;
    var helmet = tpl.querySelector('helmet');
    if (helmet) { var h = helmet.cloneNode(true); while (h.firstChild) document.head.appendChild(h.firstChild); }
    var inner = tpl.querySelector('x-dc') || tpl;
    var comp = new Component({});
    comp._tpl = inner; comp._root = root;
    delegate(root, 'click'); delegate(root, 'mousemove'); delegate(root, 'input'); delegate(root, 'change');
    function formKey(f) { var sj = f.querySelector('input[name="_subject"]'); return (sj ? sj.value : '') + '|' + (f.id || (f.getAttribute('style') || '').slice(0, 40)); }
    root._formKey = formKey;
    // Inline form submission (FormSubmit AJAX) — no page redirect
    root.addEventListener('submit', function (e) {
      var f = e.target; if (!f || !f.action || f.action.indexOf('formsubmit.co') < 0) return;
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      var btn = f.querySelector('button[type="submit"]'); var orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Gönderiliyor…'; }
      var fd = new FormData(f); fd.delete('_next'); fd.delete('_captcha');
      var subj = fd.get('_subject') || ''; var isSub = /abonel/i.test(subj);
      var url = f.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      fetch(url, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } }).then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); }).then(function (j) {
        var ok = j && (j.success === true || j.success === 'true' || /success|activ|sent/i.test(String(j.message || '')));
        if (!ok) throw new Error(j && j.message || 'err');
        var dark = /\#2A1D4A|\#211743|rgb\(42, 29, 74\)|rgb\(33, 23, 67\)/.test(getComputedStyle(f.closest('section') || f).backgroundColor + (f.closest('section') ? f.closest('section').getAttribute('style') : ''));
        var fg = dark ? '#F5EFE6' : '#2A1D4A', sub = dark ? '#CFC6DD' : '#4A3A62';
        var msg = isSub ? '<div style="font-family:\'Bricolage Grotesque\',sans-serif;font-weight:800;font-size:26px;letter-spacing:-.03em;color:' + fg + '">Kulise hoş geldiniz <span style="color:#E85D2A">✓</span></div><div style="font-size:15px;line-height:1.5;color:' + sub + '">Aboneliğiniz alındı. Yeni sayılar e-postanıza gelecek; her e-postada tek tıkla çıkış var.</div>'
                        : '<div style="font-family:\'Bricolage Grotesque\',sans-serif;font-weight:800;font-size:26px;letter-spacing:-.03em;color:' + fg + '">Talebiniz ulaştı <span style="color:#E85D2A">✓</span></div><div style="font-size:15px;line-height:1.5;color:' + sub + '">Teşekkürler. En kısa sürede hello@aysunbektas.com adresinden dönüş yapılacak.</div>';
        var box = document.createElement('div'); box.setAttribute('role', 'status'); box.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:22px 24px;border:1px solid #E85D2A;border-radius:14px;background:rgba(232,93,42,.08);max-width:560px;animation:rise .5s ease both';
        box.innerHTML = msg; box.setAttribute('data-form', formKey(f)); f.replaceWith(box); box._keep = true;
      }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = orig; } f.removeEventListener('submit', arguments.callee); f.submit(); });
    });
    comp._render();
    root.removeAttribute('hidden');
    if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target) setTimeout(function () { target.scrollIntoView(); }, 50); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
