/* dc-lite: runtime kecil untuk menjalankan halaman prototipe Dashboard Marketing Pokama di luar kanvas. */
(function () {
  var comp = null, tplRoot = null, mount = null, pending = false;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, next || {});
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  function schedule() {
    if (pending) return;
    pending = true;
    Promise.resolve().then(function () { pending = false; render(); });
  }

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (m, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }

  function renderList(nodes, scope, parent) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, parent);
  }

  function renderNode(n, scope, parent) {
    if (n.nodeType === 3) { parent.appendChild(document.createTextNode(interp(n.nodeValue, scope))); return; }
    if (n.nodeType !== 1) return;
    var tag = n.tagName.toLowerCase();
    var sc = tag === 'template' ? n.getAttribute('data-sc') : null;
    if (sc === 'for') {
      var m = WHOLE.exec(n.getAttribute('list') || '');
      var list = m ? lookup(m[1], scope) : [];
      var as = n.getAttribute('as') || 'item';
      (list || []).forEach(function (it, idx) {
        var s = Object.create(scope); s[as] = it; s.$index = idx;
        renderList(n.content.childNodes, s, parent);
      });
      return;
    }
    if (sc === 'if') {
      var mi = WHOLE.exec(n.getAttribute('value') || '');
      if (mi && lookup(mi[1], scope)) renderList(n.content.childNodes, scope, parent);
      return;
    }
    var el = n.cloneNode(false);
    var attrs = Array.prototype.slice.call(n.attributes);
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, val = attrs[a].value;
      if (name.indexOf('hint-') === 0) { el.removeAttribute(name); continue; }
      var w = WHOLE.exec(val);
      if (/^on[a-z]+$/.test(name)) {
        el.removeAttribute(name);
        if (w) {
          var fn = lookup(w[1], scope);
          if (typeof fn === 'function') el.addEventListener(name.slice(2), (function (f) { return function (e) { f(e); }; })(fn));
        }
        continue;
      }
      if (val.indexOf('{{') >= 0) {
        if (w) {
          var v = lookup(w[1], scope);
          if (v == null || v === false) el.removeAttribute(name); else el.setAttribute(name, String(v));
        } else el.setAttribute(name, interp(val, scope));
      }
    }
    renderList(n.childNodes, scope, el);
    if (tag === 'textarea') el.value = el.textContent;
    if (tag === 'input' && el.hasAttribute('value')) el.value = el.getAttribute('value');
    parent.appendChild(el);
  }

  function render() {
    var active = document.activeElement, id = active && active.id, sel = null;
    try { if (active && active.selectionStart != null) sel = [active.selectionStart, active.selectionEnd]; } catch (e) { sel = null; }
    var vals;
    try { vals = comp.renderVals(); } catch (err) { console.error('renderVals gagal', err); return; }
    var frag = document.createDocumentFragment();
    renderList(tplRoot.content.childNodes, vals, frag);
    mount.innerHTML = '';
    mount.appendChild(frag);
    window.dcComp = comp;
    try { window.dispatchEvent(new CustomEvent('dc:render')); } catch (e) {}
    if (id) {
      var again = document.getElementById(id);
      if (again) { again.focus(); try { if (sel) again.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
  }

  function boot() {
    tplRoot = document.getElementById('dc-tpl');
    mount = document.getElementById('dc-root');
    var script = document.querySelector('script[data-dc-script]');
    var props = {};
    try {
      var decl = JSON.parse(script.getAttribute('data-props') || '{}');
      Object.keys(decl).forEach(function (k) { if (k.charAt(0) !== '$' && decl[k] && 'default' in decl[k]) props[k] = decl[k]['default']; });
    } catch (e) {}
    var Component = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
    comp = new Component(props);
    if (!comp.state) comp.state = {};
    render();
    if (typeof comp.componentDidMount === 'function') comp.componentDidMount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
