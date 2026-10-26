/* Pokama demo runtime: renders a DC page (template + Component class) without a framework. */
(function () {
  var EV = { onclick: 'click', onchange: 'change', oninput: 'input' };
  var root, tpl, comp;
  function look(expr, sc) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return +expr;
    var v = sc, ks = expr.split('.');
    for (var i = 0; i < ks.length; i++) { if (v == null) return undefined; v = v[ks[i]]; }
    return v;
  }
  function interp(s, sc) { return s.replace(/\{\{([^}]+)\}\}/g, function (_, e) { var v = look(e, sc); return v == null ? '' : String(v); }); }
  function child(sc, k, v) { var o = Object.create(sc); o[k] = v; return o; }
  function r(node, sc, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.textContent, sc))); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'TEMPLATE' && node.hasAttribute('data-scfor')) {
      var list = look(node.getAttribute('list').replace(/[{}]/g, ''), sc) || [], as = node.getAttribute('as');
      list.forEach(function (it, i) { var s2 = child(child(sc, as, it), '$index', i); node.content.childNodes.forEach(function (c) { r(c, s2, out); }); });
      return;
    }
    if (node.tagName === 'TEMPLATE' && node.hasAttribute('data-scif')) {
      var v = look(node.getAttribute('value').replace(/[{}]/g, ''), sc);
      if (v && v !== 'false') node.content.childNodes.forEach(function (c) { r(c, sc, out); });
      return;
    }
    var svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    var el = svg ? document.createElementNS(node.namespaceURI, node.tagName) : document.createElement(node.tagName);
    for (var j = 0; j < node.attributes.length; j++) {
      var a = node.attributes[j], m = a.value.match(/^\{\{([^}]+)\}\}$/), ln = a.name.toLowerCase();
      if (EV[ln]) { var f = m ? look(m[1], sc) : null; if (typeof f === 'function') el.addEventListener(EV[ln], f); continue; }
      var val = m ? look(m[1], sc) : interp(a.value, sc);
      if (a.name === 'checked') { el.checked = !!val && val !== 'false'; continue; }
      if (a.name === 'value') { el.value = val == null ? '' : val; el.setAttribute('value', val == null ? '' : val); continue; }
      el.setAttribute(a.name, val == null ? '' : val);
    }
    var kids = node.tagName === 'TEMPLATE' ? node.content.childNodes : node.childNodes, o = [];
    kids.forEach(function (c) { r(c, sc, o); });
    o.forEach(function (c) { el.appendChild(c); });
    if (el.tagName === 'TEXTAREA') el.value = el.getAttribute('value') || '';
    out.push(el);
  }
  function pathOf(el) { var p = []; while (el && el !== root) { p.unshift(Array.prototype.indexOf.call(el.parentNode.children, el)); el = el.parentNode; } return el === root ? p : null; }
  function byPath(p) { var el = root; for (var i = 0; i < p.length && el; i++) el = el.children[p[i]]; return el; }
  function render() {
    var act = document.activeElement, ap = act && root.contains(act) ? pathOf(act) : null, sel = null;
    try { if (ap && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch (e) {}
    var scrolls = [];
    root.querySelectorAll('*').forEach(function (el) { if (el.scrollTop > 0) scrolls.push([pathOf(el), el.scrollTop]); });
    var vals = comp.renderVals(), o = [];
    tpl.content.childNodes.forEach(function (c) { r(c, vals, o); });
    root.innerHTML = '';
    o.forEach(function (c) { root.appendChild(c); });
    scrolls.forEach(function (s) { var el = byPath(s[0]); if (el) el.scrollTop = s[1]; });
    if (ap) { var n = byPath(ap); if (n && n.tagName === act.tagName && n.focus) { n.focus(); try { if (sel) n.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  }
  window.DCLogic = function (p) { this.props = p || {}; this.state = {}; };
  window.DCLogic.prototype.setState = function (p) {
    var prev = Object.assign({}, this.state);
    Object.assign(this.state, typeof p === 'function' ? p(this.state) : p);
    render();
    if (this.componentDidUpdate) this.componentDidUpdate(this.props, prev);
  };
  window.DCLogic.prototype.forceUpdate = function () { render(); };
  window.dcBoot = function (Component) {
    root = document.getElementById('root');
    tpl = document.createElement('template');
    tpl.innerHTML = document.getElementById('dc-tpl').innerHTML
      .replace(/<sc-for\b/g, '<template data-scfor').replace(/<\/sc-for>/g, '</template>')
      .replace(/<sc-if\b/g, '<template data-scif').replace(/<\/sc-if>/g, '</template>');
    comp = new Component({});
    render();
    if (comp.componentDidMount) comp.componentDidMount();
  };
})();
