//#region node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: ee, getOwnPropertySymbols: f, getPrototypeOf: p } = Object, m = globalThis, te = m.trustedTypes, ne = te ? te.emptyScript : "", re = m.reactiveElementPolyfillSupport, h = (e, t) => e, g = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ne : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, ie = (e, t) => !l(e, t), ae = {
	attribute: !0,
	type: String,
	converter: g,
	reflect: !1,
	useDefault: !1,
	hasChanged: ie
};
Symbol.metadata ??= Symbol("metadata"), m.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var _ = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = ae) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? ae;
	}
	static _$Ei() {
		if (this.hasOwnProperty(h("elementProperties"))) return;
		let e = p(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(h("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(h("properties"))) {
			let e = this.properties, t = [...ee(e), ...f(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? g : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? g : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ie)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
_.elementStyles = [], _.shadowRootOptions = { mode: "open" }, _[h("elementProperties")] = /* @__PURE__ */ new Map(), _[h("finalized")] = /* @__PURE__ */ new Map(), re?.({ ReactiveElement: _ }), (m.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var v = globalThis, oe = (e) => e, y = v.trustedTypes, se = y ? y.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, ce = "$lit$", b = `lit$${Math.random().toFixed(9).slice(2)}$`, le = "?" + b, ue = `<${le}>`, x = document, S = () => x.createComment(""), C = (e) => e === null || typeof e != "object" && typeof e != "function", w = Array.isArray, de = (e) => w(e) || typeof e?.[Symbol.iterator] == "function", T = "[ 	\n\f\r]", E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, fe = /-->/g, pe = />/g, D = RegExp(`>|${T}(?:([^\\s"'>=/]+)(${T}*=${T}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), me = /'/g, he = /"/g, ge = /^(?:script|style|textarea|title)$/i, O = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), k = Symbol.for("lit-noChange"), A = Symbol.for("lit-nothing"), _e = /* @__PURE__ */ new WeakMap(), j = x.createTreeWalker(x, 129);
function ve(e, t) {
	if (!w(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return se === void 0 ? t : se.createHTML(t);
}
var ye = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = E;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === E ? c[1] === "!--" ? o = fe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = D) : (ge.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = D) : o = pe : o === D ? c[0] === ">" ? (o = i ?? E, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? D : c[3] === "\"" ? he : me) : o === he || o === me ? o = D : o === fe || o === pe ? o = E : (o = D, i = void 0);
		let d = o === D && e[t + 1].startsWith("/>") ? " " : "";
		a += o === E ? n + ue : l >= 0 ? (r.push(s), n.slice(0, l) + ce + n.slice(l) + b + d) : n + b + (l === -2 ? t : d);
	}
	return [ve(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, M = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = ye(t, n);
		if (this.el = e.createElement(l, r), j.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = j.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(ce)) {
					let t = u[o++], n = i.getAttribute(e).split(b), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? xe : r[1] === "?" ? Se : r[1] === "@" ? Ce : F
					}), i.removeAttribute(e);
				} else e.startsWith(b) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ge.test(i.tagName)) {
					let e = i.textContent.split(b), t = e.length - 1;
					if (t > 0) {
						i.textContent = y ? y.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], S()), j.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], S());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === le) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(b, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += b.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = x.createElement("template");
		return n.innerHTML = e, n;
	}
};
function N(e, t, n = e, r) {
	if (t === k) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = C(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = N(e, i._$AS(e, t.values), i, r)), t;
}
var be = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? x).importNode(t, !0);
		j.currentNode = r;
		let i = j.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new P(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new we(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = j.nextNode(), a++);
		}
		return j.currentNode = x, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, P = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = N(this, e, t), C(e) ? e === A || e == null || e === "" ? (this._$AH !== A && this._$AR(), this._$AH = A) : e !== this._$AH && e !== k && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? de(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== A && C(this._$AH) ? this._$AA.nextSibling.data = e : this.T(x.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = M.createElement(ve(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new be(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = _e.get(e.strings);
		return t === void 0 && _e.set(e.strings, t = new M(e)), t;
	}
	k(t) {
		w(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(S()), this.O(S()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = oe(e).nextSibling;
			oe(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, F = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = A, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = A;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = N(this, e, t, 0), a = !C(e) || e !== this._$AH && e !== k, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = N(this, r[n + o], t, o), s === k && (s = this._$AH[o]), a ||= !C(s) || s !== this._$AH[o], s === A ? e = A : e !== A && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, xe = class extends F {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === A ? void 0 : e;
	}
}, Se = class extends F {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== A);
	}
}, Ce = class extends F {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = N(this, e, t, 0) ?? A) === k) return;
		let n = this._$AH, r = e === A && n !== A || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== A && (n === A || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, we = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		N(this, e);
	}
}, Te = v.litHtmlPolyfillSupport;
Te?.(M, P), (v.litHtmlVersions ??= []).push("3.3.3");
var Ee = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new P(t.insertBefore(S(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, I = globalThis, L = class extends _ {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ee(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return k;
	}
};
L._$litElement$ = !0, L.finalized = !0, I.litElementHydrateSupport?.({ LitElement: L });
var De = I.litElementPolyfillSupport;
De?.({ LitElement: L }), (I.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var R = {
	bootstrap: "notification_manager/bootstrap",
	rulesList: "notification_manager/rules/list",
	rulesGet: "notification_manager/rules/get",
	rulesCreate: "notification_manager/rules/create",
	rulesUpdate: "notification_manager/rules/update",
	rulesDelete: "notification_manager/rules/delete",
	rulesSetEnabled: "notification_manager/rules/set_enabled",
	rulesTest: "notification_manager/rules/test",
	recipientsList: "notification_manager/recipients/list",
	recipientsUpdate: "notification_manager/recipients/update",
	recipientsTest: "notification_manager/recipients/test",
	recipientsConfirm: "notification_manager/recipients/confirm",
	groupsList: "notification_manager/groups/list",
	groupsCreate: "notification_manager/groups/create",
	groupsUpdate: "notification_manager/groups/update",
	groupsDelete: "notification_manager/groups/delete",
	capabilityTargets: "notification_manager/capabilities/targets",
	capabilityForTarget: "notification_manager/capabilities/for_target",
	capabilityResolve: "notification_manager/capabilities/resolve",
	activityList: "notification_manager/activity/list",
	settingsGet: "notification_manager/settings/get",
	settingsUpdate: "notification_manager/settings/update"
}, z = class extends Error {
	constructor(e, t, n) {
		super(t), this.name = "NotificationManagerApiError", this.code = e, this.details = n;
	}
};
function Oe(e) {
	return typeof e == "object" && !!e;
}
function B(e) {
	return e instanceof z ? e : Oe(e) ? new z(typeof e.code == "string" ? e.code : "unknown_error", typeof e.message == "string" && e.message.trim().length > 0 ? e.message : "Notification Manager could not complete the request.", e.error) : e instanceof Error && e.message.trim().length > 0 ? new z("unknown_error", e.message) : new z("unknown_error", "Notification Manager could not complete the request.");
}
var V = class {
	constructor(e) {
		this.client = e;
	}
	async call(e) {
		try {
			return await this.client.callWS(e);
		} catch (e) {
			throw B(e);
		}
	}
	bootstrap() {
		return this.call({ type: R.bootstrap });
	}
	listRules() {
		return this.call({ type: R.rulesList });
	}
	getRule(e) {
		return this.call({
			type: R.rulesGet,
			rule_id: e
		});
	}
	createRule(e) {
		return this.call({
			type: R.rulesCreate,
			rule: e
		});
	}
	updateRule(e, t) {
		return this.call({
			type: R.rulesUpdate,
			rule: e,
			expected_revision: t
		});
	}
	deleteRule(e, t) {
		return this.call({
			type: R.rulesDelete,
			rule_id: e,
			expected_revision: t
		});
	}
	setRuleEnabled(e, t, n) {
		return this.call({
			type: R.rulesSetEnabled,
			rule_id: e,
			enabled: t,
			expected_revision: n
		});
	}
	testRule(e) {
		return this.call(typeof e == "string" ? {
			type: R.rulesTest,
			rule_id: e
		} : {
			type: R.rulesTest,
			rule: e
		});
	}
	listRecipients() {
		return this.call({ type: R.recipientsList });
	}
	updateRecipient(e) {
		return this.call({
			type: R.recipientsUpdate,
			recipient: e
		});
	}
	testRecipient(e) {
		return this.call({
			type: R.recipientsTest,
			recipient_id: e
		});
	}
	confirmRecipientMapping(e, t) {
		return this.call({
			type: R.recipientsConfirm,
			source: e,
			recipient_id: t
		});
	}
	listGroups() {
		return this.call({ type: R.groupsList });
	}
	createGroup(e) {
		return this.call({
			type: R.groupsCreate,
			group: e
		});
	}
	updateGroup(e) {
		return this.call({
			type: R.groupsUpdate,
			group: e
		});
	}
	deleteGroup(e) {
		return this.call({
			type: R.groupsDelete,
			group_id: e
		});
	}
	listCapabilityTargets() {
		return this.call({ type: R.capabilityTargets });
	}
	getCapabilitiesForTarget(e) {
		return this.call({
			type: R.capabilityForTarget,
			entity_id: e
		});
	}
	resolveTrigger(e, t, n) {
		return this.call({
			type: R.capabilityResolve,
			entity_id: e,
			semantic: t,
			parameters: n
		});
	}
	listActivity(e = {}) {
		return this.call({
			type: R.activityList,
			...e.ruleId ? { rule_id: e.ruleId } : {},
			...e.recipientId ? { recipient_id: e.recipientId } : {},
			...e.status ? { status: e.status } : {}
		});
	}
	getSettings() {
		return this.call({ type: R.settingsGet });
	}
	updateSettings(e, t) {
		return this.call({
			type: R.settingsUpdate,
			activity_retention_days: e,
			activity_retention_records: t
		});
	}
}, ke = class extends L {
	constructor(...e) {
		super(...e), this.variant = "secondary", this.icon = "", this.disabled = !1, this.fullWidth = !1, this.buttonType = "button";
	}
	static {
		this.properties = {
			variant: {
				type: String,
				reflect: !0
			},
			icon: { type: String },
			disabled: {
				type: Boolean,
				reflect: !0
			},
			fullWidth: {
				type: Boolean,
				attribute: "full-width",
				reflect: !0
			},
			buttonType: {
				type: String,
				attribute: "button-type"
			}
		};
	}
	static {
		this.styles = o`
    :host {
      display: inline-block;
      font: inherit;
    }

    button {
      box-sizing: border-box;
      min-block-size: var(--nm-control-height, 44px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--nm-space-2, 8px);
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      border-radius: var(--nm-radius, 8px);
      padding: 0 var(--nm-space-4, 16px);
      background: var(--card-background-color, #fafafa);
      color: var(--primary-text-color, #212121);
      font: inherit;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 140ms ease,
        border-color 140ms ease;
    }

    :host([variant="primary"]) button {
      border-color: var(--primary-color, #3f6f58);
      background: var(--primary-color, #3f6f58);
      color: var(--text-primary-color, #f7f7f7);
    }

    :host([variant="danger"]) button {
      border-color: var(--error-color, #c62828);
      background: transparent;
      color: var(--error-color, #c62828);
    }

    :host([variant="quiet"]) button {
      border-color: transparent;
      background: transparent;
      color: var(--primary-color, #3f6f58);
    }

    button:hover:not(:disabled) {
      background: var(--secondary-background-color, #f1f1f1);
    }

    :host([variant="primary"]) button:hover:not(:disabled) {
      background: var(--dark-primary-color, var(--primary-color, #365f4d));
    }

    :host([variant="danger"]) button:hover:not(:disabled),
    :host([variant="quiet"]) button:hover:not(:disabled) {
      background: var(--secondary-background-color, #f1f1f1);
    }

    button:focus-visible {
      outline: 2px solid var(--primary-color, #3f6f58);
      outline-offset: 2px;
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    :host([full-width]) {
      display: block;
    }

    :host([full-width]) button {
      inline-size: 100%;
    }

    ha-icon {
      --mdc-icon-size: 20px;
      inline-size: 20px;
      block-size: 20px;
      flex: none;
    }

    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;
	}
	render() {
		return O`
      <button type=${this.buttonType} ?disabled=${this.disabled}>
        ${this.icon ? O`<ha-icon icon=${this.icon} aria-hidden="true"></ha-icon>` : null}
        <slot></slot>
      </button>
    `;
	}
};
customElements.get("notification-manager-button") || customElements.define("notification-manager-button", ke);
//#endregion
//#region src/components/nm-status-panel.ts
var Ae = {
	error: "mdi:alert-circle-outline",
	offline: "mdi:connection",
	info: "mdi:information-outline",
	success: "mdi:check-circle-outline"
}, je = class extends L {
	constructor(...e) {
		super(...e), this.kind = "info", this.heading = "", this.message = "", this.compact = !1;
	}
	static {
		this.properties = {
			kind: {
				type: String,
				reflect: !0
			},
			heading: { type: String },
			message: { type: String },
			compact: {
				type: Boolean,
				reflect: !0
			}
		};
	}
	static {
		this.styles = o`
    :host {
      display: block;
      color: var(--primary-text-color, #212121);
      font: inherit;
    }

    .panel {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--nm-space-3, 12px);
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      border-inline-start-width: 4px;
      border-radius: var(--nm-radius, 8px);
      padding: var(--nm-space-4, 16px);
      background: var(--card-background-color, #fafafa);
    }

    :host([kind="error"]) .panel {
      border-inline-start-color: var(--error-color, #c62828);
    }

    :host([kind="offline"]) .panel {
      border-inline-start-color: var(--warning-color, #8a5a00);
      background: var(--secondary-background-color, #f1f1f1);
    }

    :host([kind="info"]) .panel {
      border-inline-start-color: var(--primary-color, #3f6f58);
    }

    :host([kind="success"]) .panel {
      border-inline-start-color: var(--success-color, #2e7d32);
    }

    :host([compact]) .panel {
      border-radius: 0;
      border-inline: 0;
      padding: 10px 24px;
    }

    ha-icon {
      --mdc-icon-size: 22px;
      color: var(--secondary-text-color, #616161);
    }

    :host([kind="error"]) ha-icon {
      color: var(--error-color, #c62828);
    }

    :host([kind="success"]) ha-icon {
      color: var(--success-color, #2e7d32);
    }

    strong,
    p {
      display: block;
      margin: 0;
    }

    strong {
      font-size: 15px;
      line-height: 1.35;
    }

    p {
      margin-top: 2px;
      color: var(--secondary-text-color, #616161);
      font-size: 14px;
      line-height: 1.45;
    }

    .actions {
      justify-self: end;
    }

    @media (max-width: 600px) {
      .panel {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .actions {
        grid-column: 2;
        justify-self: start;
      }

      :host([compact]) .panel {
        padding-inline: 16px;
      }
    }
  `;
	}
	render() {
		return O`
      <div class="panel" role=${this.kind === "error" ? "alert" : "status"} aria-live="polite">
        <ha-icon icon=${Ae[this.kind]} aria-hidden="true"></ha-icon>
        <div>
          <strong>${this.heading}</strong>
          ${this.message ? O`<p>${this.message}</p>` : null}
        </div>
        <div class="actions"><slot name="actions"></slot></div>
      </div>
    `;
	}
};
customElements.get("notification-manager-status-panel") || customElements.define("notification-manager-status-panel", je);
//#endregion
//#region src/navigation.ts
var Me = [
	"notifications",
	"people",
	"activity",
	"settings"
], Ne = [
	{
		route: "notifications",
		label: "Notifications",
		icon: "mdi:bell-outline"
	},
	{
		route: "people",
		label: "Household",
		icon: "mdi:account-multiple-outline"
	},
	{
		route: "activity",
		label: "Activity",
		icon: "mdi:history"
	},
	{
		route: "settings",
		label: "Settings",
		icon: "mdi:cog-outline",
		adminOnly: !0
	}
];
function Pe(e) {
	let t = e.replace(/^#\/?/, "").split(/[/?]/, 1)[0];
	return Me.includes(t) ? t : "notifications";
}
function Fe(e, t) {
	return e === "settings" && !t ? "notifications" : e;
}
function Ie(e) {
	return Ne.filter((t) => e || !t.adminOnly);
}
function H(e) {
	return `#/${e}`;
}
//#endregion
//#region src/activity-format.ts
function U(e) {
	return e.length <= 1 ? e[0] ?? "" : e.length === 2 ? `${e[0]} and ${e[1]}` : `${e.slice(0, -1).join(", ")}, and ${e.at(-1)}`;
}
function Le(e) {
	return e.status === "SENT" ? `${e.recipient_name}: sent` : e.status === "FAILED" ? `${e.recipient_name}: ${e.reason ?? "could not be reached"}` : `${e.recipient_name}: ${e.reason ?? "not eligible for this notification"}`;
}
function W(e) {
	let t = e.recipient_results.filter((e) => e.status === "SENT").map((e) => e.recipient_name), n = e.recipient_results.filter((e) => e.status === "FAILED").map((e) => e.recipient_name), r = e.recipient_results.filter((e) => e.status === "SKIPPED").map((e) => e.recipient_name), i = [];
	return t.length && i.push(`${e.status === "TEST" ? "Test sent" : "Sent"} to ${U(t)}`), n.length && i.push(`could not reach ${U(n)}`), r.length && i.push(`skipped ${U(r)}`), i.length ? i.join("; ") : e.reason ?? e.status.toLocaleLowerCase();
}
//#endregion
//#region src/components/nm-empty-state.ts
var Re = class extends L {
	constructor(...e) {
		super(...e), this.icon = "mdi:information-outline", this.heading = "", this.message = "";
	}
	static {
		this.properties = {
			icon: { type: String },
			heading: { type: String },
			message: { type: String }
		};
	}
	static {
		this.styles = o`
    :host {
      display: block;
      color: var(--primary-text-color, #212121);
      font: inherit;
    }

    .empty {
      display: grid;
      justify-items: start;
      gap: 8px;
      border-block: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      padding: 32px 0;
    }

    ha-icon {
      --mdc-icon-size: 28px;
      color: var(--secondary-text-color, #616161);
    }

    strong,
    p {
      margin: 0;
    }

    strong {
      font-size: 16px;
      line-height: 1.35;
    }

    p {
      max-inline-size: 58ch;
      color: var(--secondary-text-color, #616161);
      font-size: 14px;
      line-height: 1.5;
    }
  `;
	}
	render() {
		return O`
      <div class="empty">
        <ha-icon icon=${this.icon} aria-hidden="true"></ha-icon>
        <strong>${this.heading}</strong>
        <p>${this.message}</p>
      </div>
    `;
	}
};
customElements.get("notification-manager-empty-state") || customElements.define("notification-manager-empty-state", Re);
//#endregion
//#region src/pages/page-styles.ts
var G = o`
  :host {
    display: block;
    box-sizing: border-box;
    --nm-border: var(--divider-color, rgba(127, 127, 127, 0.3));
    --nm-control-border: var(--input-idle-line-color, rgba(127, 127, 127, 0.5));
    --nm-surface: var(--card-background-color, #fafafa);
    --nm-muted-surface: var(--secondary-background-color, #f1f1f1);
    --nm-space-1: 4px;
    --nm-space-2: 8px;
    --nm-space-3: 12px;
    --nm-space-4: 16px;
    --nm-space-5: 24px;
    --nm-space-6: 32px;
    --nm-control-height: 44px;
    --nm-option-height: 52px;
    --nm-row-height: 64px;
    --nm-row-height-comfortable: 72px;
    --nm-radius: 8px;
    --nm-radius-compact: 6px;
    max-inline-size: 1120px;
    margin-inline: auto;
    border: 1px solid var(--nm-border);
    border-radius: var(--nm-radius);
    padding: var(--nm-space-5);
    background: var(--nm-surface);
    color: var(--primary-text-color, #212121);
    font: inherit;
  }

  .page-heading {
    margin-bottom: var(--nm-space-4);
    padding-bottom: var(--nm-space-4);
    border-bottom: 1px solid var(--nm-border);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 26px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.35;
  }

  .page-heading p,
  .section-heading p {
    max-inline-size: 65ch;
    margin-top: 6px;
    color: var(--secondary-text-color, #616161);
    font-size: 14px;
    line-height: 1.5;
  }

  .section + .section {
    margin-top: var(--nm-space-4);
    border-top: 1px solid var(--nm-border);
    padding-top: var(--nm-space-4);
  }

  .section {
    min-inline-size: 0;
  }

  .page-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nm-space-3);
    margin-bottom: var(--nm-space-4);
  }

  .section-heading {
    margin-bottom: var(--nm-space-3);
  }

  .data-list {
    border-top: 1px solid var(--nm-border);
  }

  .data-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--nm-space-4);
    min-block-size: var(--nm-row-height);
    border-bottom: 1px solid var(--nm-border);
    padding: 10px 0;
  }

  .row-primary,
  .row-secondary {
    display: block;
  }

  .row-primary {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
  }

  .row-secondary,
  .row-meta {
    color: var(--secondary-text-color, #616161);
    font-size: 13px;
    line-height: 1.45;
  }

  .row-secondary {
    margin-top: 2px;
  }

  .row-meta {
    text-align: end;
  }

  .status {
    display: inline-block;
    border: 1px solid var(--nm-border);
    border-radius: var(--nm-radius-compact);
    padding: 3px 7px;
    background: var(--nm-muted-surface);
    color: var(--primary-text-color, #212121);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
  }

  .status[data-status="FAILED"],
  .status[data-status="NEEDS_ATTENTION"] {
    color: var(--error-color, #c62828);
  }

  .status[data-status="PARTIAL"],
  .status[data-status="DEGRADED"] {
    color: var(--warning-color, #8a5a00);
  }

  .definition-list {
    display: grid;
    grid-template-columns: minmax(160px, 0.45fr) minmax(0, 1fr);
    margin: 0;
    border-top: 1px solid var(--nm-border);
  }

  dt,
  dd {
    margin: 0;
    border-bottom: 1px solid var(--nm-border);
    padding: 14px 0;
    font-size: 14px;
    line-height: 1.45;
  }

  dt {
    color: var(--secondary-text-color, #616161);
  }

  dd {
    color: var(--primary-text-color, #212121);
    text-align: end;
  }

  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea {
    box-sizing: border-box;
    min-block-size: var(--nm-control-height);
    border: 1px solid var(--nm-control-border);
    border-radius: var(--nm-radius);
    padding: 9px 11px;
    background: var(--nm-surface);
    color: var(--primary-text-color, #212121);
    font: inherit;
  }

  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--primary-color, #3f6f58);
    outline-offset: 2px;
  }

  .hint,
  .feedback {
    color: var(--secondary-text-color, #616161);
    font-size: 13px;
    line-height: 1.45;
  }

  .error {
    color: var(--error-color, #c62828);
  }

  @media (max-width: 600px) {
    :host {
      border-inline: 0;
      border-radius: 0;
      padding: var(--nm-space-4);
    }

    .page-heading {
      margin-bottom: var(--nm-space-5);
    }

    .data-row {
      grid-template-columns: 1fr;
      gap: 6px;
      min-block-size: var(--nm-row-height-comfortable);
    }

    .row-meta {
      text-align: start;
    }

    .definition-list {
      grid-template-columns: 1fr;
    }

    dt {
      border-bottom: 0;
      padding-bottom: 2px;
    }

    dd {
      padding-top: 2px;
      text-align: start;
    }
  }
`, ze = {
	SENT: "Sent",
	PARTIAL: "Partially sent",
	SKIPPED: "Skipped",
	FAILED: "Failed",
	TEST: "Test"
}, Be = class extends L {
	constructor(...e) {
		super(...e), this.activity = [], this.rules = [], this.recipients = [], this._ruleId = "", this._recipientId = "", this._status = "", this._refreshing = !1, this._error = "";
	}
	static {
		this.properties = {
			api: { attribute: !1 },
			activity: { attribute: !1 },
			rules: { attribute: !1 },
			recipients: { attribute: !1 },
			_error: { state: !0 },
			_records: { state: !0 },
			_refreshing: { state: !0 },
			_recipientId: { state: !0 },
			_ruleId: { state: !0 },
			_status: { state: !0 }
		};
	}
	static {
		this.styles = [G, o`
      .filters {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
        align-items: end;
        gap: var(--nm-space-3);
        margin-bottom: var(--nm-space-4);
      }

      label { display: grid; gap: var(--nm-space-2); font-weight: 600; }

      .error { margin-bottom: 12px; color: var(--error-color, #c62828); }

      .delivery-results {
        display: grid;
        gap: 2px;
        margin: 6px 0 0;
        padding: 0;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
        list-style: none;
      }

      @media (max-width: 760px) {
        .filters { grid-template-columns: 1fr; }
      }
    `];
	}
	async _refresh() {
		if (!(!this.api || this._refreshing)) {
			this._refreshing = !0, this._error = "";
			try {
				this._records = await this.api.listActivity({
					ruleId: this._ruleId || void 0,
					recipientId: this._recipientId || void 0,
					status: this._status || void 0
				});
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._refreshing = !1;
			}
		}
	}
	formatTimestamp(e) {
		let t = new Date(e);
		return Number.isNaN(t.valueOf()) ? e : new Intl.DateTimeFormat(void 0, {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(t);
	}
	render() {
		let e = [...this._records ?? this.activity].sort((e, t) => Date.parse(t.timestamp) - Date.parse(e.timestamp));
		return O`
      <div class="page-heading">
        <h2>Activity</h2>
        <p>Review what was sent, skipped or unable to reach a phone.</p>
      </div>
      <div class="filters" aria-label="Activity filters">
        <label>
          Notification
          <select
            .value=${this._ruleId}
            @change=${(e) => {
			this._ruleId = e.currentTarget.value, this._refresh();
		}}
          >
            <option value="">All notifications</option>
            ${this.rules.map((e) => O`<option value=${e.id}>${e.name}</option>`)}
          </select>
        </label>
        <label>
          Person
          <select
            .value=${this._recipientId}
            @change=${(e) => {
			this._recipientId = e.currentTarget.value, this._refresh();
		}}
          >
            <option value="">Everyone</option>
            ${this.recipients.map((e) => O`<option value=${e.id}>${e.display_name}</option>`)}
          </select>
        </label>
        <label>
          Result
          <select
            .value=${this._status}
            @change=${(e) => {
			this._status = e.currentTarget.value, this._refresh();
		}}
          >
            <option value="">All results</option>
            ${Object.entries(ze).map(([e, t]) => O`<option value=${e}>${t}</option>`)}
          </select>
        </label>
        <notification-manager-button
          icon="mdi:refresh"
          .disabled=${this._refreshing}
          @click=${this._refresh}
        >
          Reload
        </notification-manager-button>
      </div>
      ${this._error ? O`<p class="error" role="alert">${this._error}</p>` : A}
      ${e.length === 0 ? O`
            <notification-manager-empty-state
              icon="mdi:history"
              heading="No activity yet"
              message="Delivery results will appear after a notification is evaluated."
            ></notification-manager-empty-state>
          ` : O`
            <div class="data-list" aria-label="Notification activity">
              ${e.map((e) => O`
                  <div class="data-row">
                    <div>
                      <span class="row-primary">${e.trigger_summary}</span>
                      <span class="row-secondary">
                        ${this.formatTimestamp(e.timestamp)}
                        <br />${W(e)}
                      </span>
                      ${e.recipient_results.length > 1 || e.status === "PARTIAL" ? O`
                            <ul class="delivery-results" aria-label="Recipient results">
                              ${e.recipient_results.map((e) => O`<li>${Le(e)}</li>`)}
                            </ul>
                          ` : A}
                    </div>
                    <div class="row-meta">
                      <span class="status" data-status=${e.status}>
                        ${ze[e.status]}
                      </span>
                    </div>
                  </div>
                `)}
            </div>
          `}
    `;
	}
};
customElements.get("notification-manager-activity-page") || customElements.define("notification-manager-activity-page", Be);
//#endregion
//#region src/rule-draft.ts
var Ve = /* @__PURE__ */ new Set([
	"OPENED",
	"CLOSED",
	"REMAINS_OPEN",
	"REMAINS_CLOSED",
	"DETECTED",
	"CLEARED",
	"REMAINS_DETECTED"
]);
function K(e) {
	return e.device_id ? `device:${e.device_id}` : `entity:${e.entity_id}`;
}
function He(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = K(n), r = t.get(e);
		if (r) {
			r.targets.push(n);
			continue;
		}
		t.set(e, {
			key: e,
			name: n.device_name?.trim() || n.display_name,
			kind: n.device_id ? "device" : "entity",
			targets: [n]
		});
	}
	return [...t.values()].map((e) => ({
		...e,
		targets: [...e.targets].sort((e, t) => e.display_name.localeCompare(t.display_name) || e.entity_id.localeCompare(t.entity_id))
	})).sort((e, t) => e.name.localeCompare(t.name) || e.key.localeCompare(t.key));
}
function Ue(e) {
	return e.filter((e) => !e.synthetic);
}
function We(e) {
	return e.semantics.some((e) => Ve.has(e.semantic));
}
function Ge(e) {
	return Ue(e).filter(We);
}
function Ke(e) {
	return Ge(e).filter((e) => e.available);
}
function q(e) {
	return We(e) ? e.available ? "ready" : "unavailable" : "unsupported";
}
function J(e) {
	let t = Ue(e), n = Ke(t), r = He(t), i = new Set(n.map(K));
	return {
		discoveredTargets: t,
		runtimeTargets: Ge(t),
		usableTargets: n,
		sources: r,
		discoveredSourceCount: r.length,
		readySourceCount: i.size
	};
}
function Y(e) {
	return e?.semantics.filter((e) => Ve.has(e.semantic)) ?? [];
}
function qe(e, t) {
	let n = e.parameters.state, r = e.type === "BINARY_STATE_DURATION";
	if (t?.category === "motion") {
		if (r && n === "on") return "REMAINS_DETECTED";
		if (!r && n === "on") return "DETECTED";
		if (!r && n === "off") return "CLEARED";
	}
	if (t?.category === "opening") {
		if (r && n === "on") return "REMAINS_OPEN";
		if (r && n === "off") return "REMAINS_CLOSED";
		if (!r && n === "on") return "OPENED";
		if (!r && n === "off") return "CLOSED";
	}
}
var Je = {
	OPENED: "opens",
	CLOSED: "closes",
	REMAINS_OPEN: "stays open",
	REMAINS_CLOSED: "stays closed",
	DETECTED: "detects activity",
	CLEARED: "clears",
	REMAINS_DETECTED: "keeps detecting activity",
	ARRIVES: "arrives home",
	LEAVES: "leaves home",
	ABOVE: "rises above the selected value",
	BELOW: "falls below the selected value",
	AT_TIME: "reaches the selected time"
};
function X(e) {
	return `${e} ${e === 1 ? "minute" : "minutes"}`;
}
function Z(e, t, n, r) {
	let i = t.startsWith("REMAINS_") ? ` for ${X(n)}` : "";
	return `When ${e} ${Je[t]}${i}, notify ${r}.`;
}
function Ye(e, t, n) {
	let r = e.toLocaleLowerCase();
	switch (t) {
		case "REMAINS_OPEN": return {
			name: `${e} left open`,
			title: e,
			message: `The ${r} has been open for ${X(n)}.`
		};
		case "REMAINS_CLOSED": return {
			name: `${e} stayed closed`,
			title: e,
			message: `The ${r} has been closed for ${X(n)}.`
		};
		case "REMAINS_DETECTED": return {
			name: `${e} activity continues`,
			title: e,
			message: `${e} has detected activity for ${X(n)}.`
		};
		case "OPENED": return {
			name: `${e} opened`,
			title: e,
			message: `${e} opened.`
		};
		case "CLOSED": return {
			name: `${e} closed`,
			title: e,
			message: `${e} closed.`
		};
		case "DETECTED": return {
			name: `${e} activity`,
			title: e,
			message: `${e} detected activity.`
		};
		case "CLEARED": return {
			name: `${e} cleared`,
			title: e,
			message: `${e} is clear.`
		};
		default: return {
			name: e,
			title: e,
			message: `${e} changed.`
		};
	}
}
function Xe(e, t, n) {
	let r = (/* @__PURE__ */ new Date()).toISOString();
	return {
		id: n.existing?.id ?? n.id,
		revision: n.existing?.revision ?? 0,
		schema_version: n.existing?.schema_version ?? 1,
		name: n.name.trim(),
		enabled: n.existing?.enabled ?? !0,
		owner_user_id: n.existing?.owner_user_id ?? e.id,
		scope: n.existing?.scope ?? (e.is_admin ? "HOUSEHOLD" : "PERSONAL"),
		trigger: t,
		conditions: n.conditions,
		audiences: n.audiences,
		content: {
			title: n.title.trim(),
			message: n.message.trim(),
			image_url: n.imageUrl,
			deep_link: n.deepLink,
			actions: n.existing?.content.actions ?? []
		},
		delivery_policy: {
			urgency: n.urgency,
			deduplicate_endpoints: !0,
			sound: n.sound
		},
		behaviour: {
			cooldown_seconds: n.cooldownSeconds,
			reminder_after_seconds: n.existing?.behaviour.reminder_after_seconds ?? null,
			repeat_every_seconds: n.existing?.behaviour.repeat_every_seconds ?? null,
			max_repeats: n.existing?.behaviour.max_repeats ?? null,
			stop_when_resolved: n.existing?.behaviour.stop_when_resolved ?? !1,
			replace_previous: n.replacePrevious
		},
		health: n.existing?.health ?? {
			status: "HEALTHY",
			issues: []
		},
		created_at: n.existing?.created_at ?? r,
		updated_at: r
	};
}
function Q() {
	return globalThis.crypto?.randomUUID?.() ?? `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
//#endregion
//#region src/pages/notifications-page.ts
var Ze = class extends L {
	constructor(...e) {
		super(...e), this.rules = [], this.targets = [], this.recipients = [], this.groups = [], this._filter = "ALL", this._workingId = "", this._error = "";
	}
	static {
		this.properties = {
			api: { attribute: !1 },
			currentUser: { attribute: !1 },
			rules: { attribute: !1 },
			targets: { attribute: !1 },
			recipients: { attribute: !1 },
			groups: { attribute: !1 },
			_error: { state: !0 },
			_filter: { state: !0 },
			_workingId: { state: !0 }
		};
	}
	static {
		this.styles = [G, o`
      .page-heading-row,
      .filters,
      .rule-row,
      .rule-actions {
        display: flex;
        align-items: center;
        gap: var(--nm-space-3);
      }

      .page-heading-row {
        justify-content: space-between;
        margin-bottom: var(--nm-space-5);
      }

      .page-heading { margin: 0; }

      .filters {
        overflow-x: auto;
        gap: var(--nm-space-1);
        margin-bottom: var(--nm-space-1);
        border-bottom: 1px solid var(--nm-border);
      }

      .filter {
        min-block-size: var(--nm-control-height);
        border: 0;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        padding: 0 12px;
        background: transparent;
        color: var(--secondary-text-color, #616161);
        font: inherit;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
      }

      .filter[aria-pressed="true"] {
        border-bottom-color: var(--primary-color, #3f6f58);
        color: var(--primary-text-color, #212121);
      }

      .filter:hover { background: var(--secondary-background-color, #f1f1f1); }

      .filter:focus-visible,
      .rule-main:focus-visible,
      summary:focus-visible,
      .menu button:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .rule-list {
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .rule-row {
        justify-content: space-between;
        min-block-size: var(--nm-row-height-comfortable);
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .rule-main {
        min-inline-size: 0;
        flex: 1;
        display: block;
        border: 0;
        padding: 12px 8px 12px 0;
        background: transparent;
        color: inherit;
        text-align: start;
        cursor: pointer;
      }

      .rule-name,
      .rule-summary { display: block; }

      .rule-name {
        font-size: 15px;
        font-weight: 600;
      }

      .rule-summary {
        overflow: hidden;
        margin-top: 3px;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rule-actions { flex: none; }

      .state {
        color: var(--secondary-text-color, #616161);
        font-size: 12px;
        font-weight: 700;
      }

      .state[data-state="NEEDS_ATTENTION"] { color: var(--error-color, #c62828); }

      details { position: relative; }

      summary {
        display: grid;
        place-items: center;
        inline-size: 44px;
        block-size: 44px;
        border-radius: var(--nm-radius);
        cursor: pointer;
        list-style: none;
      }

      summary::-webkit-details-marker { display: none; }

      .menu {
        position: absolute;
        z-index: 3;
        inset-inline-end: 0;
        min-inline-size: 160px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
        border-radius: var(--nm-radius);
        padding: 4px;
        background: var(--card-background-color, #fafafa);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
      }

      .menu button {
        inline-size: 100%;
        min-block-size: var(--nm-control-height);
        border: 0;
        border-radius: var(--nm-radius-compact);
        padding-inline: 10px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .menu button:hover { background: var(--secondary-background-color, #f1f1f1); }
      .menu .delete, .error { color: var(--error-color, #c62828); }
      .error { margin-block: 12px; }

      @media (max-width: 600px) {
        .page-heading-row { align-items: stretch; flex-direction: column; }
        .rule-summary { white-space: normal; }
        .state { display: none; }
      }
    `];
	}
	_filteredRules() {
		return this.rules.filter((e) => this._filter === "MINE" ? e.owner_user_id === this.currentUser?.id : this._filter === "HOUSEHOLD" ? e.scope === "HOUSEHOLD" : this._filter !== "ATTENTION" || e.health.status === "NEEDS_ATTENTION");
	}
	_audienceLabel(e) {
		return e.audiences.map((e) => e.type === "ME" ? "me" : e.type === "EVERYONE" ? "Everyone" : e.type === "ADMINS" ? "Admins" : e.type === "RECIPIENT" ? this.recipients.find((t) => t.id === e.recipient_id)?.display_name : this.groups.find((t) => t.id === e.group_id)?.name).filter(Boolean).join(", ");
	}
	_summary(e) {
		let t = this.targets.find((t) => t.entity_id === e.trigger.target?.entity_id), n = qe(e.trigger, t);
		if (!n || !e.trigger.target) return `Notify ${this._audienceLabel(e)}.`;
		let r = e.trigger.parameters.duration_seconds, i = typeof r == "number" ? Math.max(1, Math.round(r / 60)) : 0;
		return Z(e.trigger.target.display_name_snapshot, n, i, this._audienceLabel(e));
	}
	_changed() {
		this.dispatchEvent(new CustomEvent("data-changed", {
			bubbles: !0,
			composed: !0
		}));
	}
	async _toggle(e) {
		if (!(!this.api || this._workingId)) {
			this._workingId = e.id;
			try {
				await this.api.setRuleEnabled(e.id, !e.enabled, e.revision), this._changed();
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._workingId = "";
			}
		}
	}
	async _duplicate(e) {
		if (!this.api || this._workingId) return;
		this._workingId = e.id;
		let t = (/* @__PURE__ */ new Date()).toISOString();
		try {
			await this.api.createRule({
				...e,
				id: Q(),
				revision: 0,
				name: `${e.name} copy`,
				created_at: t,
				updated_at: t,
				health: {
					status: "HEALTHY",
					issues: []
				}
			}), this._changed();
		} catch (e) {
			this._error = B(e).message;
		} finally {
			this._workingId = "";
		}
	}
	async _delete(e) {
		if (!(!this.api || this._workingId) && globalThis.confirm?.(`Delete “${e.name}”? This cannot be undone.`)) {
			this._workingId = e.id;
			try {
				await this.api.deleteRule(e.id, e.revision), this._changed();
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._workingId = "";
			}
		}
	}
	render() {
		let e = this._filteredRules();
		return O`
      <div class="page-heading-row">
        <div class="page-heading">
          <h2>Notifications</h2>
          <p>See what your household will be told and whether anything needs attention.</p>
        </div>
        <notification-manager-button
          variant="primary"
          icon="mdi:plus"
          @click=${() => this.dispatchEvent(new CustomEvent("rule-create", {
			bubbles: !0,
			composed: !0
		}))}
        >
          Create notification
        </notification-manager-button>
      </div>

      <div class="filters" role="group" aria-label="Filter notifications">
        ${[
			["ALL", "All"],
			["MINE", "Mine"],
			["HOUSEHOLD", "Household"],
			["ATTENTION", "Needs attention"]
		].map(([e, t]) => O`
            <button
              class="filter"
              type="button"
              aria-pressed=${this._filter === e}
              @click=${() => this._filter = e}
            >
              ${t}
            </button>
          `)}
      </div>
      ${this._error ? O`<p class="error" role="alert">${this._error}</p>` : A}

      ${e.length === 0 ? O`
            <notification-manager-empty-state
              icon="mdi:bell-outline"
              heading=${this.rules.length ? "No notifications match this filter" : "No notifications yet"}
              message=${this.rules.length ? "Choose another filter to see your notifications." : "Create one to tell someone when something important happens at home."}
            ></notification-manager-empty-state>
          ` : O`
            <div class="rule-list" aria-label="Notification rules">
              ${e.map((e) => O`
                  <article class="rule-row">
                    <button
                      class="rule-main"
                      type="button"
                      @click=${() => this.dispatchEvent(new CustomEvent("rule-open", {
			detail: { ruleId: e.id },
			bubbles: !0,
			composed: !0
		}))}
                    >
                      <span class="rule-name">${e.name}</span>
                      <span class="rule-summary">${this._summary(e)}</span>
                    </button>
                    <div class="rule-actions">
                      <span class="state" data-state=${e.health.status}>
                        ${e.health.status === "NEEDS_ATTENTION" ? "Needs attention" : e.enabled ? "On" : "Paused"}
                      </span>
                      <details>
                        <summary aria-label=${`More actions for ${e.name}`}>
                          <ha-icon icon="mdi:dots-vertical" aria-hidden="true"></ha-icon>
                        </summary>
                        <div class="menu">
                          <button type="button" @click=${() => void this._toggle(e)}>
                            ${e.enabled ? "Pause" : "Resume"}
                          </button>
                          <button type="button" @click=${() => void this._duplicate(e)}>
                            Duplicate
                          </button>
                          <button
                            class="delete"
                            type="button"
                            @click=${() => void this._delete(e)}
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </article>
                `)}
            </div>
          `}
    `;
	}
};
customElements.get("notification-manager-notifications-page") || customElements.define("notification-manager-notifications-page", Ze);
//#endregion
//#region src/pages/people-groups-page.ts
var Qe = class extends L {
	constructor(...e) {
		super(...e), this.recipients = [], this.groups = [], this.onboarding = !1, this.unconfirmedMappings = [], this._openRecipientId = "", this._busy = !1, this._feedback = "", this._error = "", this._editingGroupId = "", this._groupName = "", this._groupMembers = [], this._mappingRecipientIds = {};
	}
	static {
		this.properties = {
			api: { attribute: !1 },
			currentUser: { attribute: !1 },
			recipients: { attribute: !1 },
			groups: { attribute: !1 },
			onboarding: { type: Boolean },
			unconfirmedMappings: { attribute: !1 },
			_busy: { state: !0 },
			_editingGroupId: { state: !0 },
			_error: { state: !0 },
			_feedback: { state: !0 },
			_groupMembers: { state: !0 },
			_groupName: { state: !0 },
			_mappingRecipientIds: { state: !0 },
			_openRecipientId: { state: !0 }
		};
	}
	static {
		this.styles = [G, o`
      .section-heading-row,
      .person-row,
      .group-row,
      .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nm-space-3);
      }

      .section-heading-row { margin-bottom: var(--nm-space-3); }
      .section-heading { margin: 0; }

      .person,
      .group {
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .person:first-child,
      .group:first-child { border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3)); }

      .person-row,
      .group-row { min-block-size: var(--nm-row-height-comfortable); }

      .person-main {
        min-inline-size: 0;
        flex: 1;
        border: 0;
        padding: 10px 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .person-main:focus-visible,
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .person-name,
      .person-device { display: block; }
      .person-name { font-weight: 600; }
      .person-device { margin-top: 2px; color: var(--secondary-text-color, #616161); font-size: 13px; }

      .profile,
      .group-form {
        margin-bottom: 14px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-4);
        background: var(--secondary-background-color, #f1f1f1);
      }

      .group-form > label { display: grid; gap: var(--nm-space-2); font-weight: 600; }

      .endpoint-list { display: grid; gap: var(--nm-space-2); margin-block: var(--nm-space-2); }

      .endpoint {
        display: flex;
        align-items: center;
        gap: var(--nm-space-2);
        min-block-size: var(--nm-control-height);
        font-weight: 500;
      }

      .endpoint input { inline-size: 18px; block-size: 18px; }

      .actions { justify-content: flex-start; flex-wrap: wrap; }

      .feedback { margin: 10px 0; color: var(--secondary-text-color, #616161); }
      .error { color: var(--error-color, #c62828); }

      .group-form {
        display: grid;
        gap: var(--nm-space-3);
        max-inline-size: 620px;
        margin-top: 12px;
      }

      .group-form input[type="text"] { inline-size: 100%; }

      .mapping-list { display: grid; gap: var(--nm-space-3); margin-top: var(--nm-space-3); }

      .mapping-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr) auto;
        align-items: center;
        gap: var(--nm-space-3);
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-bottom: var(--nm-space-3);
      }

      .mapping-row select { inline-size: 100%; }

      .member-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-2) var(--nm-space-4);
      }

      .member-grid label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-block-size: var(--nm-control-height);
      }

      .group-actions { display: flex; align-items: center; gap: 4px; }

      @media (max-width: 600px) {
        .member-grid { grid-template-columns: 1fr; }
        .mapping-row { grid-template-columns: 1fr; }
        .group-row { align-items: flex-start; padding-block: 8px; }
      }
    `];
	}
	_activeEndpointCount(e) {
		return e.endpoints.filter((e) => e.enabled).length;
	}
	_canEdit(e) {
		return !!(this.currentUser?.is_admin || e.ha_user_id === this.currentUser?.id);
	}
	_changed() {
		this.dispatchEvent(new CustomEvent("data-changed", {
			bubbles: !0,
			composed: !0
		}));
	}
	_createFirstNotification() {
		this.dispatchEvent(new CustomEvent("create-first-notification", {
			bubbles: !0,
			composed: !0
		}));
	}
	async _setPrimary(e, t) {
		if (!(!this.api || this._busy || !this._canEdit(e))) {
			this._busy = !0;
			try {
				await this.api.updateRecipient({
					...e,
					preferences: {
						...e.preferences,
						preferred_endpoint_id: t
					}
				}), this._feedback = `${e.display_name}'s primary phone was updated.`, this._changed();
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._busy = !1;
			}
		}
	}
	async _test(e) {
		if (!(!this.api || this._busy)) {
			this._busy = !0, this._feedback = "", this._error = "";
			try {
				let t = await this.api.testRecipient(e.id);
				this._feedback = t.status === "SENT" ? `Test sent to ${e.display_name}.` : t.reason ?? `${e.display_name} does not currently have a usable phone.`;
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._busy = !1;
			}
		}
	}
	async _confirmMapping(e) {
		if (!this.api || this._busy || !this.currentUser?.is_admin) return;
		let t = e.candidate_user_ids[0], n = this.recipients.find((e) => e.ha_user_id === t), r = this._mappingRecipientIds[e.source] ?? n?.id ?? "";
		if (!r) {
			this._error = "Choose the household member who owns this phone or person profile.";
			return;
		}
		this._busy = !0;
		try {
			await this.api.confirmRecipientMapping(e.source, r), this._feedback = `${e.display_name} was confirmed.`, this._changed();
		} catch (e) {
			this._error = B(e).message;
		} finally {
			this._busy = !1;
		}
	}
	_startGroup(e) {
		this._editingGroupId = e?.id ?? "new", this._groupName = e?.name ?? "", this._groupMembers = e?.member_recipient_ids ?? [], this._error = "";
	}
	async _saveGroup() {
		if (!(!this.api || this._busy || !this._groupName.trim())) {
			this._busy = !0;
			try {
				let e = this.groups.find((e) => e.id === this._editingGroupId), t = {
					id: e?.id ?? Q().replace(/^rule-/, "group-"),
					name: this._groupName.trim(),
					type: "CUSTOM",
					member_recipient_ids: this._groupMembers,
					system_type: null
				};
				e ? await this.api.updateGroup(t) : await this.api.createGroup(t), this._editingGroupId = "", this._feedback = `${t.name} was saved.`, this._changed();
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._busy = !1;
			}
		}
	}
	async _deleteGroup(e) {
		if (!(!this.api || this._busy) && globalThis.confirm?.(`Delete the group “${e.name}”?`)) {
			this._busy = !0;
			try {
				await this.api.deleteGroup(e.id), this._changed();
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._busy = !1;
			}
		}
	}
	_renderGroupForm() {
		return O`
      <div class="group-form">
        <label>
          Group name
          <input
            type="text"
            .value=${this._groupName}
            @input=${(e) => this._groupName = e.currentTarget.value}
          />
        </label>
        <div>
          <strong>People</strong>
          <div class="member-grid">
            ${this.recipients.map((e) => O`
                <label>
                  <input
                    type="checkbox"
                    .checked=${this._groupMembers.includes(e.id)}
                    @change=${(t) => {
			let n = t.currentTarget.checked;
			this._groupMembers = n ? [.../* @__PURE__ */ new Set([...this._groupMembers, e.id])] : this._groupMembers.filter((t) => t !== e.id);
		}}
                  />
                  ${e.display_name}
                </label>
              `)}
          </div>
        </div>
        <div class="actions">
          <notification-manager-button variant="primary" @click=${this._saveGroup}>
            Save group
          </notification-manager-button>
          <notification-manager-button @click=${() => this._editingGroupId = ""}>
            Cancel
          </notification-manager-button>
        </div>
      </div>
    `;
	}
	render() {
		let e = this.groups.filter((e) => e.type === "CUSTOM"), t = this.groups.filter((e) => e.type === "SYSTEM"), n = this.recipients.reduce((e, t) => e + this._activeEndpointCount(t), 0), r = this.onboarding ? this.recipients.find((e) => e.ha_user_id === this.currentUser?.id)?.id ?? this.recipients[0]?.id ?? "" : "", i = this._openRecipientId || r;
		return O`
      <div class="page-heading">
        <h2>Household</h2>
        <p>Manage who receives notifications and which phone is used.</p>
      </div>

      ${this.onboarding ? O`
            <notification-manager-status-panel
              kind=${n > 0 ? "success" : "info"}
              heading=${n > 0 ? "Your household is ready" : "Let's connect your first phone"}
              message=${n > 0 ? `${n} notification ${n === 1 ? "phone is" : "phones are"} ready. You can send a test below, then create your first notification.` : "Notification Manager checks Home Assistant for Companion App phones automatically. If no phone appears, sign in to this Home Assistant from the Companion App and return here."}
            >
              ${n > 0 ? O`
                    <notification-manager-button
                      slot="actions"
                      icon="mdi:plus"
                      @click=${this._createFirstNotification}
                    >
                      Create first notification
                    </notification-manager-button>
                  ` : A}
            </notification-manager-status-panel>
          ` : A}

      ${this.unconfirmedMappings.length > 0 ? O`
            <notification-manager-status-panel
              kind="info"
              heading="Set up your household"
              message=${`${this.unconfirmedMappings.length} possible phone ${this.unconfirmedMappings.length === 1 ? "match needs" : "matches need"} administrator confirmation. Review each person below.`}
            ></notification-manager-status-panel>
          ` : A}
      ${this.unconfirmedMappings.length > 0 && this.currentUser?.is_admin ? O`
            <div class="mapping-list" aria-label="Mappings to confirm">
              ${this.unconfirmedMappings.map((e) => {
			let t = e.candidate_user_ids.length ? this.recipients.filter((t) => e.candidate_user_ids.includes(t.ha_user_id)) : this.recipients, n = t[0]?.id ?? "";
			return O`
                  <div class="mapping-row">
                    <div>
                      <span class="row-primary">${e.display_name}</span>
                      <span class="row-secondary">
                        ${e.source_type === "phone" ? "Choose who owns this phone" : "Choose the matching household member"}
                      </span>
                    </div>
                    <select
                      aria-label=${`Owner for ${e.display_name}`}
                      .value=${this._mappingRecipientIds[e.source] ?? n}
                      @change=${(t) => {
				this._mappingRecipientIds = {
					...this._mappingRecipientIds,
					[e.source]: t.currentTarget.value
				};
			}}
                    >
                      <option value="">Choose a person</option>
                      ${t.map((e) => O`
                          <option value=${e.id}>${e.display_name}</option>
                        `)}
                    </select>
                    <notification-manager-button
                      .disabled=${this._busy}
                      @click=${() => void this._confirmMapping(e)}
                    >
                      Confirm
                    </notification-manager-button>
                  </div>
                `;
		})}
            </div>
          ` : A}
      ${this._error ? O`<p class="feedback error" role="alert">${this._error}</p>` : A}
      ${this._feedback ? O`<p class="feedback" aria-live="polite">${this._feedback}</p>` : A}

      <section class="section" aria-labelledby="people-heading">
        <div class="section-heading">
          <h3 id="people-heading">People and phones</h3>
        </div>
        ${this.recipients.length === 0 ? O`
              <notification-manager-empty-state
                icon="mdi:account-outline"
                heading="No household members found"
                message="Active Home Assistant users will appear here after discovery."
              ></notification-manager-empty-state>
            ` : O`
              <div aria-label="Household recipients">
                ${this.recipients.map((e) => {
			let t = i === e.id, n = this._activeEndpointCount(e);
			return O`
                    <article class="person">
                      <div class="person-row">
                        <button
                          class="person-main"
                          type="button"
                          aria-expanded=${t}
                          @click=${() => this._openRecipientId = t ? "__closed__" : e.id}
                        >
                          <span class="person-name">${e.display_name}</span>
                          <span class="person-device">
                            ${n ? `${n} ${n === 1 ? "phone" : "phones"} ready` : "No notification phone"}
                          </span>
                        </button>
                        <ha-icon
                          icon=${t ? "mdi:chevron-up" : "mdi:chevron-down"}
                          aria-hidden="true"
                        ></ha-icon>
                      </div>
                      ${t ? O`
                            <div class="profile">
                              ${e.endpoints.length ? O`
                                    <p class="hint">Primary notification device</p>
                                    <div class="endpoint-list">
                                      ${e.endpoints.map((t, n) => O`
                                          <label class="endpoint">
                                            <input
                                              type="radio"
                                              name=${`primary-${e.id}`}
                                              .checked=${e.preferences.preferred_endpoint_id === t.id || !e.preferences.preferred_endpoint_id && n === 0}
                                              ?disabled=${!t.enabled || !this._canEdit(e)}
                                              @change=${() => void this._setPrimary(e, t.id)}
                                            />
                                            ${e.endpoints.length === 1 ? `${e.display_name}'s phone` : `${e.display_name}'s phone ${n + 1}`}
                                            ${t.enabled ? "" : " (unavailable)"}
                                          </label>
                                        `)}
                                    </div>
                                  ` : O`<p class="hint">No phone is currently mapped to this person.</p>`}
                              <notification-manager-button
                                .disabled=${this._busy || n === 0 || !this._canEdit(e)}
                                @click=${() => void this._test(e)}
                              >
                                Send test
                              </notification-manager-button>
                            </div>
                          ` : A}
                    </article>
                  `;
		})}
              </div>
            `}
      </section>

      <section class="section" aria-labelledby="groups-heading">
        <div class="section-heading-row">
          <div class="section-heading">
            <h3 id="groups-heading">Groups</h3>
            <p>Rules follow current group membership, so phones can change without editing rules.</p>
          </div>
          ${this.currentUser?.is_admin ? O`
                <notification-manager-button icon="mdi:plus" @click=${() => this._startGroup()}>
                  New group
                </notification-manager-button>
              ` : A}
        </div>
        ${this._editingGroupId === "new" ? this._renderGroupForm() : A}
        <div aria-label="Notification groups">
          ${[...t, ...e].map((e) => {
			let t = e.system_type === "EVERYONE" ? this.recipients.length : e.member_recipient_ids.length, n = e.system_type === "ADMINS" ? "current administrators" : `${t} ${t === 1 ? "person" : "people"}`;
			return O`
              <article class="group">
                <div class="group-row">
                  <div>
                    <span class="row-primary">${e.name}</span>
                    <span class="row-secondary">
                      ${e.type === "SYSTEM" ? "Updates automatically" : "Custom group"},
                      ${n}
                    </span>
                  </div>
                  ${e.type === "CUSTOM" && this.currentUser?.is_admin ? O`
                        <div class="group-actions">
                          <notification-manager-button
                            variant="quiet"
                            @click=${() => this._startGroup(e)}
                          >
                            Edit
                          </notification-manager-button>
                          <notification-manager-button
                            variant="danger"
                            .disabled=${this._busy}
                            @click=${() => void this._deleteGroup(e)}
                          >
                            Delete
                          </notification-manager-button>
                        </div>
                      ` : A}
                </div>
                ${this._editingGroupId === e.id ? this._renderGroupForm() : A}
              </article>
            `;
		})}
        </div>
      </section>
    `;
	}
};
customElements.get("notification-manager-people-groups-page") || customElements.define("notification-manager-people-groups-page", Qe);
//#endregion
//#region src/pages/rule-detail-page.ts
var $e = class extends L {
	constructor(...e) {
		super(...e), this.activity = [], this.targets = [], this.recipients = [], this.groups = [], this._busy = !1, this._feedback = "";
	}
	static {
		this.properties = {
			api: { attribute: !1 },
			rule: { attribute: !1 },
			activity: { attribute: !1 },
			targets: { attribute: !1 },
			recipients: { attribute: !1 },
			groups: { attribute: !1 },
			_busy: { state: !0 },
			_feedback: { state: !0 }
		};
	}
	static {
		this.styles = [G, o`
      :host {
        max-inline-size: 840px;
        margin-inline: auto;
      }

      .back-row { margin-bottom: var(--nm-space-3); }

      .title-row,
      .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nm-space-3);
      }

      .title-row h2 {
        flex: 1;
      }

      .summary {
        max-inline-size: 65ch;
        margin: var(--nm-space-3) 0 var(--nm-space-5);
        color: var(--primary-text-color, #212121);
        font-size: 17px;
        line-height: 1.55;
      }

      .actions {
        justify-content: flex-start;
        flex-wrap: wrap;
        margin-bottom: var(--nm-space-5);
      }

      .section {
        padding-top: var(--nm-space-4);
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .feedback {
        margin-block: 12px;
        color: var(--secondary-text-color, #616161);
      }

      .danger {
        margin-top: var(--nm-space-5);
      }

      @media (max-width: 600px) {
        .title-row {
          align-items: flex-start;
        }

        .actions notification-manager-button {
          flex: 1;
        }
      }
    `];
	}
	_audienceLabel(e) {
		return e.map((e) => e.type === "ME" ? "me" : e.type === "EVERYONE" ? "Everyone" : e.type === "ADMINS" ? "Admins" : e.type === "RECIPIENT" ? this.recipients.find((t) => t.id === e.recipient_id)?.display_name ?? "a household member" : this.groups.find((t) => t.id === e.group_id)?.name ?? "a group").join(", ");
	}
	_resolvedRecipients(e) {
		let t = /* @__PURE__ */ new Set();
		for (let n of e.audiences) if (n.type === "ME") {
			let n = this.recipients.find((t) => t.ha_user_id === e.owner_user_id);
			n && t.add(n.id);
		} else n.type === "EVERYONE" ? this.recipients.forEach((e) => t.add(e.id)) : n.type === "RECIPIENT" && n.recipient_id ? t.add(n.recipient_id) : n.type === "GROUP" && n.group_id && this.groups.find((e) => e.id === n.group_id)?.member_recipient_ids.forEach((e) => t.add(e));
		return this.recipients.filter((e) => t.has(e.id));
	}
	_summary() {
		if (!this.rule?.trigger.target) return "This notification needs a replacement device.";
		let e = this.targets.find((e) => e.entity_id === this.rule?.trigger.target?.entity_id), t = qe(this.rule.trigger, e);
		if (!t) return `Notify ${this._audienceLabel(this.rule.audiences)} when the event occurs.`;
		let n = this.rule.trigger.parameters.duration_seconds, r = typeof n == "number" ? Math.max(1, Math.round(n / 60)) : 0;
		return Z(this.rule.trigger.target.display_name_snapshot, t, r, this._audienceLabel(this.rule.audiences));
	}
	_conditionSummary(e) {
		return e.conditions.length === 0 ? "No additional conditions" : e.conditions.map((e) => {
			if (e.type === "TIME_WINDOW") return `between ${String(e.parameters.start)} and ${String(e.parameters.end)}`;
			let t = e.target?.display_name_snapshot ?? "the selected device";
			if (e.type === "PERSON_HOME") return `${t} is home`;
			if (e.type === "PERSON_AWAY") return `${t} is away`;
			let n = this.targets.find((t) => t.entity_id === e.target?.entity_id), r = e.parameters.state;
			return n?.category === "motion" ? `${t} is ${r === "on" ? "detecting activity" : "clear"}` : `${t} is ${r === "on" ? "open or active" : "closed or inactive"}`;
		}).join(" and ");
	}
	async _test() {
		if (!(!this.api || !this.rule || this._busy)) {
			this._busy = !0;
			try {
				let e = await this.api.testRule(this.rule.id), t = e.recipient_results.filter((e) => e.status === "SENT").length;
				this._feedback = t ? `Test sent to ${t} ${t === 1 ? "person" : "people"}.` : e.reason ?? "No eligible phone could receive the test.", this.dispatchEvent(new CustomEvent("data-changed", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				this._feedback = B(e).message;
			} finally {
				this._busy = !1;
			}
		}
	}
	async _toggle() {
		if (!(!this.api || !this.rule || this._busy)) {
			this._busy = !0;
			try {
				await this.api.setRuleEnabled(this.rule.id, !this.rule.enabled, this.rule.revision), this.dispatchEvent(new CustomEvent("data-changed", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				this._feedback = B(e).message;
			} finally {
				this._busy = !1;
			}
		}
	}
	async _delete() {
		if (!(!this.api || !this.rule || this._busy) && globalThis.confirm?.(`Delete “${this.rule.name}”? This cannot be undone.`)) {
			this._busy = !0;
			try {
				await this.api.deleteRule(this.rule.id, this.rule.revision), this.dispatchEvent(new CustomEvent("rule-deleted", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				this._feedback = B(e).message, this._busy = !1;
			}
		}
	}
	render() {
		let e = this.rule;
		if (!e) return O`
        <notification-manager-status-panel
          kind="error"
          heading="Notification not found"
          message="It may have been deleted in another browser."
        ></notification-manager-status-panel>
      `;
		let t = this.activity.filter((t) => t.rule_id === e.id).slice(0, 5), n = t[0], r = this._resolvedRecipients(e), i = r.filter((e) => e.endpoints.some((e) => e.enabled)).length;
		return O`
      <div class="back-row">
        <notification-manager-button
          variant="quiet"
          icon="mdi:arrow-left"
          @click=${() => this.dispatchEvent(new CustomEvent("detail-close", {
			bubbles: !0,
			composed: !0
		}))}
        >
          Notifications
        </notification-manager-button>
      </div>
      <div class="title-row">
        <h2>${e.name}</h2>
        <span class="status" data-status=${e.health.status}>
          ${e.health.status === "NEEDS_ATTENTION" ? "Needs attention" : e.enabled ? "On" : "Paused"}
        </span>
      </div>
      <p class="summary">${this._summary()}</p>

      ${e.health.issues.length ? O`
            <notification-manager-status-panel
              kind=${e.health.status === "NEEDS_ATTENTION" ? "error" : "info"}
              heading=${e.health.status === "NEEDS_ATTENTION" ? "Needs attention" : "Limited"}
              .message=${e.health.issues.map((e) => e.message).join(" ")}
            ></notification-manager-status-panel>
          ` : A}

      <div class="actions">
        <notification-manager-button
          variant="primary"
          icon="mdi:pencil-outline"
          @click=${() => this.dispatchEvent(new CustomEvent("rule-edit", {
			bubbles: !0,
			composed: !0
		}))}
        >
          ${e.health.status === "NEEDS_ATTENTION" ? "Choose replacement" : "Edit"}
        </notification-manager-button>
        <notification-manager-button .disabled=${this._busy} @click=${this._test}>
          Send test
        </notification-manager-button>
        <notification-manager-button .disabled=${this._busy} @click=${this._toggle}>
          ${e.enabled ? "Pause" : "Resume"}
        </notification-manager-button>
      </div>
      ${this._feedback ? O`<p class="feedback" aria-live="polite">${this._feedback}</p>` : A}

      <section class="section" aria-labelledby="details-heading">
        <h3 id="details-heading">Details</h3>
        <dl class="definition-list">
          <dt>Recipients</dt>
          <dd>
            ${this._audienceLabel(e.audiences)}
            ${r.length ? O`<br />${r.length}
                  ${r.length === 1 ? "person" : "people"}, ${i}
                  ${i === 1 ? "phone" : "phones"}` : A}
          </dd>
          <dt>Conditions</dt>
          <dd>${this._conditionSummary(e)}</dd>
          <dt>Last triggered</dt>
          <dd>${n ? new Date(n.timestamp).toLocaleString() : "Not yet"}</dd>
          <dt>Last result</dt>
          <dd>${n ? W(n) : "No activity yet"}</dd>
        </dl>
      </section>

      <section class="section" aria-labelledby="recent-heading">
        <h3 id="recent-heading">Recent activity</h3>
        ${t.length ? O`
              <div class="data-list">
                ${t.map((e) => O`
                    <div class="data-row">
                      <div>
                        <span class="row-primary">${e.trigger_summary}</span>
                        <span class="row-secondary">
                          ${new Date(e.timestamp).toLocaleString()}<br />${W(e)}
                        </span>
                      </div>
                      <span class="status" data-status=${e.status}>${e.status.toLowerCase()}</span>
                    </div>
                  `)}
              </div>
            ` : O`<p class="hint">No activity has been recorded for this notification.</p>`}
      </section>

      <div class="danger">
        <notification-manager-button
          variant="danger"
          .disabled=${this._busy}
          @click=${this._delete}
        >
          Delete notification
        </notification-manager-button>
      </div>
    `;
	}
};
customElements.get("notification-manager-rule-detail-page") || customElements.define("notification-manager-rule-detail-page", $e);
//#endregion
//#region src/pages/rule-editor-page.ts
var et = {
	opening: "Door or window state",
	motion: "Motion state"
};
function $(e) {
	return e.currentTarget.value;
}
var tt = class extends L {
	constructor(...e) {
		super(...e), this.targets = [], this.recipients = [], this.groups = [], this._initialisedFor = "", this._draftId = Q(), this._selectedSourceKey = "", this._selectedTargetId = "", this._selectedSemantic = "", this._sourcePickerOpen = !0, this._sourceSearch = "", this._durationMinutes = 5, this._audienceMode = "ME", this._recipientIds = [], this._groupIds = [], this._name = "", this._title = "", this._message = "", this._contentEdited = !1, this._conditionDrafts = [], this._urgency = "NORMAL", this._sound = "default", this._cooldownMinutes = 0, this._replacePrevious = !1, this._imageUrl = "", this._deepLink = "", this._saving = !1, this._error = "", this._status = "";
	}
	static {
		this.properties = {
			api: { attribute: !1 },
			currentUser: { attribute: !1 },
			rule: { attribute: !1 },
			targets: { attribute: !1 },
			recipients: { attribute: !1 },
			groups: { attribute: !1 },
			_audienceMode: { state: !0 },
			_conditionDrafts: { state: !0 },
			_durationMinutes: { state: !0 },
			_error: { state: !0 },
			_groupIds: { state: !0 },
			_name: { state: !0 },
			_recipientIds: { state: !0 },
			_saving: { state: !0 },
			_sourcePickerOpen: { state: !0 },
			_sourceSearch: { state: !0 },
			_selectedSemantic: { state: !0 },
			_selectedSourceKey: { state: !0 },
			_selectedTargetId: { state: !0 },
			_status: { state: !0 },
			_title: { state: !0 },
			_message: { state: !0 }
		};
	}
	static {
		this.styles = [G, o`
      :host {
        max-inline-size: 1040px;
        margin-inline: auto;
      }

      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nm-space-4);
        margin-bottom: var(--nm-space-2);
      }

      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible,
      summary:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .composer-section {
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-block: var(--nm-space-4);
      }

      .editor-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        align-items: start;
        gap: var(--nm-space-6);
      }

      .editor-form {
        min-inline-size: 0;
      }

      .editor-form .composer-section:first-child {
        border-top: 0;
        padding-block-start: 0;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-4);
        margin-top: var(--nm-space-4);
      }

      .field,
      .choice-group {
        display: grid;
        gap: var(--nm-space-2);
      }

      .field.full,
      .choice-group {
        grid-column: 1 / -1;
      }

      label,
      legend {
        color: var(--primary-text-color, #212121);
        font-size: 14px;
        font-weight: 600;
      }

      input:not([type="checkbox"]):not([type="radio"]),
      select,
      textarea {
        inline-size: 100%;
      }

      textarea {
        min-block-size: 96px;
        resize: vertical;
      }

      .hint {
        margin: 0;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      .source-search {
        margin-top: var(--nm-space-4);
      }

      .source-list,
      .signal-list,
      .behaviour-list {
        display: grid;
        gap: var(--nm-space-2);
        margin-top: var(--nm-space-3);
      }

      .source-list {
        max-block-size: 320px;
        overflow-y: auto;
        padding-inline-end: var(--nm-space-1);
        scrollbar-gutter: stable;
      }

      .source-option,
      .signal-option,
      .behaviour-option {
        inline-size: 100%;
        min-block-size: var(--nm-option-height);
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--nm-space-3);
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-2) var(--nm-space-3);
        background: var(--card-background-color, #fafafa);
        color: var(--primary-text-color, #212121);
        text-align: start;
        font: inherit;
        cursor: pointer;
      }

      .behaviour-option {
        grid-template-columns: minmax(0, 1fr);
      }

      .source-summary {
        margin-top: var(--nm-space-3);
      }

      .change-label {
        color: var(--primary-color, #3f6f58);
        font-weight: 600;
      }

      .source-option:hover,
      .signal-option:hover,
      .behaviour-option:hover {
        border-color: var(--primary-color, #3f6f58);
      }

      .source-option[aria-pressed="true"],
      .signal-option[aria-pressed="true"],
      .behaviour-option[aria-pressed="true"] {
        border-color: var(--primary-color, #3f6f58);
        background: color-mix(in srgb, var(--primary-color, #3f6f58) 8%, transparent);
      }

      .source-option:focus-visible,
      .signal-option:focus-visible,
      .behaviour-option:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .signal-option:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }

      .source-option:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }

      .option-copy {
        display: grid;
        gap: 2px;
        min-inline-size: 0;
      }

      .option-title {
        overflow-wrap: anywhere;
        font-weight: 600;
      }

      .option-meta,
      .option-count {
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
        font-weight: 400;
      }

      .selection-path {
        margin: 8px 0 0;
        color: var(--secondary-text-color, #616161);
        font-size: 14px;
      }

      .no-results {
        margin: 12px 0 0;
        color: var(--secondary-text-color, #616161);
      }

      .condition-list {
        display: grid;
        grid-column: 1 / -1;
        gap: var(--nm-space-3);
      }

      .condition-card {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-3);
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-3);
      }

      .condition-card .condition-kind,
      .condition-card .condition-target {
        grid-column: 1 / -1;
      }

      .condition-actions {
        grid-column: 1 / -1;
        text-align: end;
      }

      .condition-actions button,
      .add-condition {
        min-block-size: var(--nm-control-height);
        border: 0;
        border-radius: var(--nm-radius-compact);
        padding: 0 var(--nm-space-3);
        background: transparent;
        color: var(--primary-color, #3f6f58);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .condition-actions button:focus-visible,
      .add-condition:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      fieldset {
        min-inline-size: 0;
        margin: var(--nm-space-4) 0 0;
        border: 0;
        padding: 0;
      }

      .choice-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-2);
        margin-top: var(--nm-space-2);
      }

      .choice {
        display: flex;
        align-items: flex-start;
        gap: var(--nm-space-2);
        min-block-size: var(--nm-control-height);
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: var(--nm-radius-compact);
        padding: var(--nm-space-2);
        font-weight: 500;
        cursor: pointer;
      }

      .choice:has(input:checked) {
        border-color: var(--primary-color, #3f6f58);
        background: color-mix(in srgb, var(--primary-color, #3f6f58) 8%, transparent);
      }

      .choice input {
        inline-size: 18px;
        min-block-size: 18px;
        block-size: 18px;
        margin: 1px 0 0;
        padding: 0;
      }

      .expanded-choice {
        margin-top: var(--nm-space-3);
        border-inline-start: 3px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-inline-start: var(--nm-space-4);
      }

      details {
        border-block: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-block: 4px;
      }

      summary {
        min-block-size: var(--nm-option-height);
        display: flex;
        align-items: center;
        font-weight: 600;
        cursor: pointer;
      }

      .review {
        margin: 10px 0 0;
        color: var(--primary-text-color, #212121);
        font-size: 15px;
        line-height: 1.5;
      }

      .review-panel {
        position: sticky;
        inset-block-start: 24px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-4);
        background: var(--card-background-color, #fafafa);
      }

      .review-actions {
        display: grid;
        align-items: stretch;
        justify-content: stretch;
        gap: var(--nm-space-4);
        margin-top: var(--nm-space-4);
      }

      .button-row {
        display: grid;
        justify-content: stretch;
        gap: var(--nm-space-2);
      }

      .mobile-actions {
        display: none;
      }

      .mobile-feedback {
        grid-column: 1 / -1;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      .feedback {
        min-block-size: 22px;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      .error {
        color: var(--error-color, #c62828);
      }

      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (max-width: 840px) {
        :host { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
        .editor-layout { grid-template-columns: 1fr; gap: var(--nm-space-2); }
        .review-panel { position: static; }

        .review-panel .review-actions {
          display: none;
        }

        .mobile-actions {
          position: fixed;
          z-index: 5;
          inset-inline: 0;
          inset-block-end: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: var(--nm-space-2);
          border-top: 1px solid var(--nm-border);
          padding:
            var(--nm-space-3)
            max(var(--nm-space-4), env(safe-area-inset-right))
            max(var(--nm-space-3), env(safe-area-inset-bottom))
            max(var(--nm-space-4), env(safe-area-inset-left));
          background: var(--card-background-color, #fafafa);
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
        }
      }

      @media (max-width: 640px) {
        .field-grid,
        .choice-list,
        .condition-card {
          grid-template-columns: 1fr;
        }

        .choice-list { gap: var(--nm-space-2); }
      }
    `];
	}
	willUpdate(e) {
		(e.has("rule") || e.has("targets")) && this._initialise();
	}
	_initialise() {
		let e = this.rule?.id ?? "new";
		if (this._initialisedFor === e || this.targets.length === 0) return;
		this._initialisedFor = e, this._sourcePickerOpen = !this.rule, this._sourceSearch = "";
		let t = J(this.targets), n = this.rule?.trigger.target ? t.discoveredTargets.find((e) => e.entity_id === this.rule?.trigger.target?.entity_id) : t.usableTargets[0];
		this._selectedSourceKey = n ? K(n) : "", this._selectedTargetId = n?.entity_id ?? "", this._selectedSemantic = this.rule ? qe(this.rule.trigger, n) ?? "" : Y(n)[0]?.semantic ?? "";
		let r = this.rule?.trigger.parameters.duration_seconds;
		this._durationMinutes = typeof r == "number" ? Math.max(1, Math.round(r / 60)) : 5, this.rule ? (this._name = this.rule.name, this._title = this.rule.content.title, this._message = this.rule.content.message, this._contentEdited = !0, this._imageUrl = this.rule.content.image_url ?? "", this._deepLink = this.rule.content.deep_link ?? "", this._urgency = this.rule.delivery_policy.urgency, this._sound = this.rule.delivery_policy.sound ?? "default", this._cooldownMinutes = Math.round((this.rule.behaviour.cooldown_seconds ?? 0) / 60), this._replacePrevious = this.rule.behaviour.replace_previous, this._initialiseAudience(this.rule.audiences), this._initialiseConditions(this.rule.conditions)) : this._applyGeneratedContent();
	}
	_initialiseAudience(e) {
		let t = e.length === 1 ? e[0] : void 0;
		t && [
			"ME",
			"EVERYONE",
			"ADMINS"
		].includes(t.type) ? this._audienceMode = t.type : (this._audienceMode = "CHOOSE", this._recipientIds = e.filter((e) => e.type === "RECIPIENT" && e.recipient_id).map((e) => e.recipient_id), this._groupIds = e.filter((e) => e.type === "GROUP" && e.group_id).map((e) => e.group_id));
	}
	_initialiseConditions(e) {
		this._conditionDrafts = e.map((e) => ({
			key: Q(),
			mode: e.type,
			targetId: e.target?.entity_id ?? "",
			start: String(e.parameters.start ?? "22:00"),
			end: String(e.parameters.end ?? "06:00"),
			expectedState: e.parameters.state === "off" ? "off" : "on"
		}));
	}
	_addCondition() {
		this._conditionDrafts = [...this._conditionDrafts, {
			key: Q(),
			mode: "PERSON_HOME",
			targetId: "",
			start: "22:00",
			end: "06:00",
			expectedState: "on"
		}], this._markDirty();
	}
	_updateCondition(e, t) {
		this._conditionDrafts = this._conditionDrafts.map((n, r) => r === e ? {
			...n,
			...t
		} : n), this._markDirty();
	}
	_removeCondition(e) {
		this._conditionDrafts = this._conditionDrafts.filter((t, n) => n !== e), this._markDirty();
	}
	get _selectedTarget() {
		return this.targets.find((e) => e.entity_id === this._selectedTargetId);
	}
	_applyGeneratedContent() {
		if (this._contentEdited || !this._selectedTarget || !this._selectedSemantic) return;
		let e = Ye(this._selectedTarget.display_name, this._selectedSemantic, this._durationMinutes);
		this._name = e.name, this._title = e.title, this._message = e.message;
	}
	_markDirty() {
		this._error = "", this._status = "", this.dispatchEvent(new CustomEvent("editor-dirty", {
			detail: { dirty: !0 },
			bubbles: !0,
			composed: !0
		}));
	}
	_selectSource(e) {
		let t = J(this.targets).sources.find((t) => t.key === e);
		if (!t) return;
		let n = t.targets.find((e) => q(e) === "ready");
		n && (this._selectedSourceKey = t.key, this._sourcePickerOpen = !1, this._sourceSearch = "", this._selectTarget(n.entity_id));
	}
	_selectTarget(e) {
		this._sourcePickerOpen = !1, this._sourceSearch = "", e !== this._selectedTargetId && (this._selectedTargetId = e, this._selectedSemantic = Y(this._selectedTarget)[0]?.semantic ?? "", this._contentEdited = !1, this._applyGeneratedContent(), this._markDirty());
	}
	_selectSemantic(e) {
		e !== this._selectedSemantic && (this._selectedSemantic = e, this._contentEdited = !1, this._applyGeneratedContent(), this._markDirty());
	}
	_changeSourceSearch(e) {
		this._sourceSearch = $(e);
	}
	async _openSourcePicker() {
		this._sourcePickerOpen = !0, await this.updateComplete, this.shadowRoot?.querySelector("#source-search")?.focus();
	}
	_changeDuration(e) {
		this._durationMinutes = Math.max(1, Number($(e)) || 1), this._contentEdited = !1, this._applyGeneratedContent(), this._markDirty();
	}
	_setContent(e, t) {
		let n = $(t);
		e === "name" && (this._name = n), e === "title" && (this._title = n), e === "message" && (this._message = n), this._contentEdited = !0, this._markDirty();
	}
	_toggleSelection(e, t, n) {
		let r = e === "recipient" ? this._recipientIds : this._groupIds, i = n ? [.../* @__PURE__ */ new Set([...r, t])] : r.filter((e) => e !== t);
		e === "recipient" ? this._recipientIds = i : this._groupIds = i, this._markDirty();
	}
	_audiences() {
		return this._audienceMode === "CHOOSE" ? [...this._recipientIds.map((e) => ({
			type: "RECIPIENT",
			recipient_id: e,
			group_id: null
		})), ...this._groupIds.map((e) => ({
			type: "GROUP",
			recipient_id: null,
			group_id: e
		}))] : [{
			type: this._audienceMode,
			recipient_id: null,
			group_id: null
		}];
	}
	_audienceName() {
		if (this._audienceMode === "ME") return "me";
		if (this._audienceMode === "EVERYONE") return "Everyone";
		if (this._audienceMode === "ADMINS") return "Admins";
		let e = this._recipientIds.length + this._groupIds.length;
		return e === 1 ? "the selected person or group" : `${e} selected audiences`;
	}
	_resolvedRecipients() {
		if (this._audienceMode === "ME") return this.recipients.filter((e) => e.ha_user_id === this.currentUser?.id);
		if (this._audienceMode === "EVERYONE") return this.recipients;
		if (this._audienceMode === "ADMINS") return [];
		let e = this.groups.filter((e) => this._groupIds.includes(e.id)).flatMap((e) => e.member_recipient_ids), t = /* @__PURE__ */ new Set([...this._recipientIds, ...e]);
		return this.recipients.filter((e) => t.has(e.id));
	}
	_supports(e) {
		let t = this._resolvedRecipients();
		return t.length > 0 && t.every((t) => t.endpoints.some((t) => t.enabled && t.capabilities.includes(e)));
	}
	_conditions() {
		return this._conditionDrafts.flatMap((e) => {
			if (e.mode === "TIME_WINDOW") return [{
				type: "TIME_WINDOW",
				target: null,
				parameters: {
					start: e.start,
					end: e.end
				}
			}];
			let t = this.targets.find((t) => t.entity_id === e.targetId);
			return t ? [{
				type: e.mode,
				target: {
					entity_id: t.entity_id,
					registry_id: t.registry_id,
					device_id: t.device_id,
					domain: t.domain,
					device_class: t.device_class,
					display_name_snapshot: t.display_name
				},
				parameters: e.mode === "ENTITY_STATE" ? { state: e.expectedState } : {}
			}] : [];
		});
	}
	async _draft() {
		if (!this.api || !this.currentUser) throw Error("Home Assistant is unavailable.");
		let e = this._selectedTarget;
		if (!e || !this._selectedSemantic || q(e) !== "ready") throw Error("Choose an available notification-ready signal.");
		let t = this._audiences();
		if (t.length === 0) throw Error("Choose at least one person or group.");
		if (!this._name.trim() || !this._title.trim() || !this._message.trim()) throw Error("Add a notification name, title and message.");
		for (let e of this._conditionDrafts) if (e.mode !== "TIME_WINDOW" && !e.targetId) throw Error(e.mode === "ENTITY_STATE" ? "Choose a device for each condition." : "Choose a person for each condition.");
		let n = this._selectedSemantic.startsWith("REMAINS_") ? { duration_seconds: Math.round(this._durationMinutes * 60) } : {}, r = await this.api.resolveTrigger(e.entity_id, this._selectedSemantic, n);
		return Xe(this.currentUser, r, {
			id: this._draftId,
			existing: this.rule,
			name: this._name,
			audiences: t,
			title: this._title,
			message: this._message,
			imageUrl: this._imageUrl.trim() || null,
			deepLink: this._deepLink.trim() || null,
			conditions: this._conditions(),
			urgency: this._urgency,
			sound: this._urgency === "CRITICAL" ? this._sound.trim() || "default" : null,
			cooldownSeconds: this._cooldownMinutes > 0 ? Math.round(this._cooldownMinutes * 60) : null,
			replacePrevious: this._replacePrevious
		});
	}
	async _save() {
		if (!(!this.api || this._saving)) {
			this._saving = !0, this._error = "";
			try {
				let e = await this._draft(), t = this.rule ? await this.api.updateRule(e, this.rule.revision) : await this.api.createRule(e);
				this.dispatchEvent(new CustomEvent("rule-saved", {
					detail: { rule: t },
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				let t = B(e);
				this._error = t.code === "conflict" ? "This notification changed while you were editing it. Reload it before saving again." : t.message;
			} finally {
				this._saving = !1;
			}
		}
	}
	async _sendTest() {
		if (!(!this.api || this._saving)) {
			this._saving = !0, this._error = "", this._status = "";
			try {
				let e = await this._draft(), t = await this.api.testRule(e), n = t.recipient_results.filter((e) => e.status === "SENT").length;
				this._status = n ? `Test sent to ${n} ${n === 1 ? "person" : "people"}.` : t.reason ?? "No eligible phone could receive the test.";
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._saving = !1;
			}
		}
	}
	_renderAudienceChoices() {
		let e = this.groups.filter((e) => e.type === "CUSTOM");
		return O`
      <fieldset class="choice-group">
        <legend class="sr-only">Recipients</legend>
        <div class="choice-list">
          ${(this.currentUser?.is_admin ? [
			"ME",
			"EVERYONE",
			"ADMINS",
			"CHOOSE"
		] : ["ME"]).map((e) => O`
              <label class="choice">
                <input
                  type="radio"
                  name="audience"
                  value=${e}
                  .checked=${this._audienceMode === e}
                  @change=${() => {
			this._audienceMode = e, this._markDirty();
		}}
                />
                ${e === "ME" ? "Me" : e === "EVERYONE" ? "Everyone" : e === "ADMINS" ? "Admins" : "Choose people or groups"}
              </label>
            `)}
        </div>
      </fieldset>
      ${this._audienceMode === "CHOOSE" ? O`
            <div class="expanded-choice">
              <p class="hint">People</p>
              <div class="choice-list">
                ${this.recipients.map((e) => O`
                    <label class="choice">
                      <input
                        type="checkbox"
                        .checked=${this._recipientIds.includes(e.id)}
                        @change=${(t) => this._toggleSelection("recipient", e.id, t.currentTarget.checked)}
                      />
                      ${e.display_name}
                    </label>
                  `)}
              </div>
              ${e.length ? O`
                    <p class="hint">Groups</p>
                    <div class="choice-list">
                      ${e.map((e) => O`
                          <label class="choice">
                            <input
                              type="checkbox"
                              .checked=${this._groupIds.includes(e.id)}
                              @change=${(t) => this._toggleSelection("group", e.id, t.currentTarget.checked)}
                            />
                            ${e.name}
                          </label>
                        `)}
                    </div>
                  ` : A}
            </div>
          ` : A}
    `;
	}
	render() {
		let { sources: e, usableTargets: t } = J(this.targets), n = e.find((e) => e.key === this._selectedSourceKey), r = this._sourceSearch.trim().toLocaleLowerCase(), i = r ? e.filter((e) => e.name.toLocaleLowerCase().includes(r) || e.targets.some((e) => e.display_name.toLocaleLowerCase().includes(r) || e.entity_id.toLocaleLowerCase().includes(r))) : e, a = this._selectedTarget && q(this._selectedTarget) === "ready" ? Y(this._selectedTarget) : [], o = this.targets.filter((e) => e.category === "person"), s = this._selectedSemantic.startsWith("REMAINS_"), c = this._supports("important"), l = this._supports("critical") && this._supports("sound"), u = this._supports("image"), d = this._supports("deep_link"), ee = this._supports("replacement"), f = this._resolvedRecipients(), p = f.filter((e) => e.endpoints.some((e) => e.enabled)).length, m = this._selectedTarget && this._selectedSemantic ? Z(this._selectedTarget.display_name, this._selectedSemantic, this._durationMinutes, this._audienceName()) : "Choose a device, signal, behaviour and audience to review this notification.";
		return O`
      <div class="editor-header">
        <notification-manager-button
          variant="quiet"
          icon="mdi:arrow-left"
          @click=${() => this.dispatchEvent(new CustomEvent("editor-cancel", {
			bubbles: !0,
			composed: !0
		}))}
        >
          Notifications
        </notification-manager-button>
      </div>
      <div class="page-heading">
        <h2>${this.rule ? "Edit notification" : "Create notification"}</h2>
        <p>Choose what to monitor, what should happen and who should be notified.</p>
      </div>

      ${t.length === 0 ? O`
            <notification-manager-status-panel
              kind="error"
              heading="No notification-ready signals found"
              message="Add a supported device or entity in Home Assistant, then reload this page."
            ></notification-manager-status-panel>
          ` : O`
            <div class="editor-layout">
              <div class="editor-form">
            <section class="composer-section" aria-labelledby="what-heading">
              <h3 id="what-heading">Device</h3>
              ${this._sourcePickerOpen ? O`
                    <div class="field source-search">
                      <label for="source-search">Find a device or entity</label>
                      <input
                        id="source-search"
                        type="search"
                        placeholder="Search by device, signal or entity ID"
                        autocomplete="off"
                        .value=${this._sourceSearch}
                        @input=${this._changeSourceSearch}
                      />
                    </div>
                    <div class="source-list" aria-label="Devices and entities">
                      ${i.map((e) => O`
                          <button
                            class="source-option"
                            type="button"
                            aria-pressed=${e.key === this._selectedSourceKey ? "true" : "false"}
                            ?disabled=${e.targets.every((e) => q(e) !== "ready")}
                            @click=${() => this._selectSource(e.key)}
                          >
                            <span class="option-copy">
                              <span class="option-title">${e.name}</span>
                               <span class="option-meta">
                                 ${e.kind === "device" ? "Device" : "Individual entity"}${e.targets.every((e) => q(e) !== "ready") ? " · No notification-ready signals" : ""}
                              </span>
                            </span>
                            <span class="option-count">
                              ${e.targets.filter((e) => q(e) === "ready").length}
                              of ${e.targets.length} ready
                            </span>
                          </button>
                        `)}
                    </div>
                    ${i.length === 0 ? O`<p class="no-results">No matching devices or entities.</p>` : A}
                  ` : O`
                    <button
                      class="source-option source-summary"
                      type="button"
                      @click=${this._openSourcePicker}
                    >
                      <span class="option-copy">
                        <span class="option-title">${n?.name ?? "Selected entity"}</span>
                        <span class="option-meta">
                          ${n?.kind === "device" ? "Device" : "Individual entity"}
                        </span>
                      </span>
                      <span class="change-label">Change</span>
                    </button>
                  `}
            </section>

            <section class="composer-section" aria-labelledby="signal-heading">
              <h3 id="signal-heading">Signal</h3>
              <p class="selection-path">
                Choose what on ${n?.name ?? "this device"} should be monitored.
              </p>
              <div class="signal-list" aria-label="Signals">
                ${n?.targets.map((e) => O`
                    <button
                      class="signal-option"
                       type="button"
                       aria-pressed=${e.entity_id === this._selectedTargetId ? "true" : "false"}
                       ?disabled=${q(e) !== "ready"}
                      @click=${() => this._selectTarget(e.entity_id)}
                    >
                      <span class="option-copy">
                        <span class="option-title">${e.display_name}</span>
                        <span class="option-meta">
                           ${et[e.category] ?? "Entity state"}${q(e) === "unavailable" ? " · Unavailable" : q(e) === "unsupported" ? " · Not supported for notifications yet" : ""}
                        </span>
                      </span>
                    </button>
                  `)}
              </div>
            </section>

            <section class="composer-section" aria-labelledby="when-heading">
              <h3 id="when-heading">Behaviour</h3>
              <p class="selection-path">When ${this._selectedTarget?.display_name ?? "the signal"}…</p>
              <div class="behaviour-list" aria-label="Behaviours">
                ${a.map((e) => O`
                    <button
                      class="behaviour-option"
                      type="button"
                      aria-pressed=${e.semantic === this._selectedSemantic ? "true" : "false"}
                      @click=${() => this._selectSemantic(e.semantic)}
                    >
                      <span class="option-title">${e.label}</span>
                    </button>
                  `)}
              </div>
              <div class="field-grid">
                ${s ? O`
                      <div class="field">
                        <label for="duration">For how long?</label>
                        <div>
                          <input
                            id="duration"
                            type="number"
                            min="1"
                            step="1"
                            .value=${String(this._durationMinutes)}
                            @input=${this._changeDuration}
                          />
                          <p class="hint">Minutes</p>
                        </div>
                      </div>
                    ` : A}
              </div>
            </section>

            <section class="composer-section" aria-labelledby="who-heading">
              <h3 id="who-heading">Recipients</h3>
              ${this._renderAudienceChoices()}
              <p class="hint">
                ${f.length}
                ${f.length === 1 ? "person" : "people"},
                ${p} ${p === 1 ? "phone" : "phones"} currently ready
              </p>
            </section>

            <section class="composer-section" aria-labelledby="message-heading">
              <h3 id="message-heading">Message</h3>
              <div class="field-grid">
                <div class="field full">
                  <label for="name">Notification name</label>
                  <input
                    id="name"
                    .value=${this._name}
                    @input=${(e) => this._setContent("name", e)}
                  />
                </div>
                <div class="field full">
                  <label for="title">Phone title</label>
                  <input
                    id="title"
                    .value=${this._title}
                    @input=${(e) => this._setContent("title", e)}
                  />
                </div>
                <div class="field full">
                  <label for="message">Message</label>
                  <textarea
                    id="message"
                    .value=${this._message}
                    @input=${(e) => this._setContent("message", e)}
                  ></textarea>
                </div>
              </div>
            </section>

            <section class="composer-section" aria-labelledby="options-heading">
              <details>
                <summary id="options-heading">Conditions and delivery options</summary>
                <div class="field-grid">
                  <div class="field full">
                    <label>Only notify when</label>
                    ${this._conditionDrafts.length === 0 ? O`<p class="hint">No additional conditions</p>` : A}
                  </div>
                  <div class="condition-list">
                    ${this._conditionDrafts.map((e, t) => {
			let n = this.targets.find((t) => t.entity_id === e.targetId), r = e.mode === "ENTITY_STATE" ? this.targets.filter((e) => ["opening", "motion"].includes(e.category)) : o, i = n?.category === "motion" ? "Activity detected" : "Open", a = n?.category === "motion" ? "Clear" : "Closed";
			return O`
                        <div class="condition-card">
                          <div class="field condition-kind">
                            <label for=${`condition-kind-${e.key}`}>Condition</label>
                            <select
                              id=${`condition-kind-${e.key}`}
                              .value=${e.mode}
                              @change=${(e) => this._updateCondition(t, {
				mode: $(e),
				targetId: ""
			})}
                            >
                              <option value="PERSON_HOME">A selected person is home</option>
                              <option value="PERSON_AWAY">A selected person is away</option>
                              <option value="TIME_WINDOW">Between two times</option>
                              <option value="ENTITY_STATE">Another device is in a selected state</option>
                            </select>
                          </div>
                          ${e.mode === "TIME_WINDOW" ? O`
                                <div class="field">
                                  <label for=${`condition-start-${e.key}`}>From</label>
                                  <input
                                    id=${`condition-start-${e.key}`}
                                    type="time"
                                    .value=${e.start}
                                    @input=${(e) => this._updateCondition(t, { start: $(e) })}
                                  />
                                </div>
                                <div class="field">
                                  <label for=${`condition-end-${e.key}`}>Until</label>
                                  <input
                                    id=${`condition-end-${e.key}`}
                                    type="time"
                                    .value=${e.end}
                                    @input=${(e) => this._updateCondition(t, { end: $(e) })}
                                  />
                                </div>
                              ` : O`
                                <div class="field condition-target">
                                  <label for=${`condition-target-${e.key}`}>
                                    ${e.mode === "ENTITY_STATE" ? "Device" : "Person"}
                                  </label>
                                  <select
                                    id=${`condition-target-${e.key}`}
                                    .value=${e.targetId}
                                    @change=${(e) => this._updateCondition(t, { targetId: $(e) })}
                                  >
                                    <option value="">
                                      ${e.mode === "ENTITY_STATE" ? "Choose a device" : "Choose a person"}
                                    </option>
                                    ${r.map((e) => O`
                                        <option value=${e.entity_id} ?disabled=${!e.available}>
                                          ${e.display_name}
                                        </option>
                                      `)}
                                  </select>
                                </div>
                                ${e.mode === "ENTITY_STATE" ? O`
                                      <div class="field condition-target">
                                        <label for=${`condition-state-${e.key}`}>State</label>
                                        <select
                                          id=${`condition-state-${e.key}`}
                                          .value=${e.expectedState}
                                          @change=${(e) => this._updateCondition(t, { expectedState: $(e) })}
                                        >
                                          <option value="on">${i}</option>
                                          <option value="off">${a}</option>
                                        </select>
                                      </div>
                                    ` : A}
                              `}
                          <div class="condition-actions">
                            <button type="button" @click=${() => this._removeCondition(t)}>
                              Remove condition
                            </button>
                          </div>
                        </div>
                      `;
		})}
                  </div>
                  <div class="field full">
                    <button class="add-condition" type="button" @click=${this._addCondition}>
                      + Add condition
                    </button>
                    ${this._conditionDrafts.length > 1 ? O`<p class="hint">All conditions must be met.</p>` : A}
                  </div>
                  <div class="field">
                    <label for="urgency">Urgency</label>
                    <select
                      id="urgency"
                      .value=${this._urgency}
                      @change=${(e) => {
			this._urgency = $(e), this._markDirty();
		}}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT" ?disabled=${!c}>Important</option>
                      <option value="CRITICAL" ?disabled=${!l}>Critical</option>
                    </select>
                    ${c ? A : O`<p class="hint">Important alerts are not confirmed for every selected phone.</p>`}
                    ${l ? A : O`<p class="hint">Critical alerts are not confirmed for every selected phone.</p>`}
                  </div>
                  <div class="field">
                    <label for="cooldown">Wait before notifying again</label>
                    <input
                      id="cooldown"
                      type="number"
                      min="0"
                      .value=${String(this._cooldownMinutes)}
                      @input=${(e) => {
			this._cooldownMinutes = Math.max(0, Number($(e)) || 0), this._markDirty();
		}}
                    />
                    <p class="hint">Minutes, or 0 for no cooldown</p>
                  </div>
                  ${u ? O`
                        <div class="field full">
                          <label for="image">Image address</label>
                          <input
                            id="image"
                            inputmode="url"
                            .value=${this._imageUrl}
                            @input=${(e) => {
			this._imageUrl = $(e), this._markDirty();
		}}
                          />
                        </div>
                      ` : A}
                  ${d ? O`
                        <div class="field full">
                          <label for="deep-link">Open when tapped</label>
                          <input
                            id="deep-link"
                            .value=${this._deepLink}
                            placeholder="/lovelace/home"
                            @input=${(e) => {
			this._deepLink = $(e), this._markDirty();
		}}
                          />
                        </div>
                      ` : A}
                  ${ee ? O`
                        <label class="choice field full">
                          <input
                            type="checkbox"
                            .checked=${this._replacePrevious}
                            @change=${(e) => {
			this._replacePrevious = e.currentTarget.checked, this._markDirty();
		}}
                          />
                          Replace the previous phone notification from this rule
                        </label>
                      ` : A}
                </div>
              </details>
            </section>
              </div>

            <aside class="review-panel" aria-labelledby="review-heading">
              <h3 id="review-heading">Review</h3>
              <p class="review">${m}</p>
              <div class="review-actions">
                <div class="feedback" aria-live="polite">
                  ${this._error ? O`<span class="error">${this._error}</span>` : this._status}
                </div>
                <div class="button-row">
                  <notification-manager-button
                    .fullWidth=${!0}
                    .disabled=${this._saving}
                    @click=${this._sendTest}
                  >
                    Send test
                  </notification-manager-button>
                  <notification-manager-button
                    variant="primary"
                    .fullWidth=${!0}
                    .disabled=${this._saving}
                    @click=${this._save}
                  >
                    ${this._saving ? "Saving…" : "Save notification"}
                  </notification-manager-button>
                </div>
              </div>
            </aside>
            </div>
            <div class="mobile-actions" aria-label="Notification actions">
              ${this._error || this._status ? O`
                    <div class="mobile-feedback" aria-live="polite">
                      ${this._error ? O`<span class="error">${this._error}</span>` : this._status}
                    </div>
                  ` : A}
              <notification-manager-button
                .fullWidth=${!0}
                .disabled=${this._saving}
                @click=${this._sendTest}
              >
                Send test
              </notification-manager-button>
              <notification-manager-button
                variant="primary"
                .fullWidth=${!0}
                .disabled=${this._saving}
                @click=${this._save}
              >
                ${this._saving ? "Saving…" : "Save notification"}
              </notification-manager-button>
            </div>
          `}
    `;
	}
};
customElements.get("notification-manager-rule-editor-page") || customElements.define("notification-manager-rule-editor-page", tt);
//#endregion
//#region src/pages/settings-page.ts
var nt = class extends L {
	constructor(...e) {
		super(...e), this.capabilityTargets = [], this.unconfirmedMappings = [], this._days = 30, this._records = 1e3, this._loading = !1, this._error = "", this._status = "";
	}
	static {
		this.properties = {
			api: { attribute: !1 },
			currentUser: { attribute: !1 },
			capabilityTargets: { attribute: !1 },
			unconfirmedMappings: { attribute: !1 },
			_days: { state: !0 },
			_error: { state: !0 },
			_loading: { state: !0 },
			_records: { state: !0 },
			_settings: { state: !0 },
			_status: { state: !0 }
		};
	}
	static {
		this.styles = [G, o`
      .settings-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 180px)) auto;
        align-items: end;
        gap: var(--nm-space-3);
        margin-top: var(--nm-space-3);
      }

      label { display: grid; gap: var(--nm-space-2); font-weight: 600; }

      .feedback { margin-top: 10px; color: var(--secondary-text-color, #616161); }
      .error { color: var(--error-color, #c62828); }

      @media (max-width: 600px) {
        .settings-form { grid-template-columns: 1fr; }
      }
    `];
	}
	updated(e) {
		e.has("api") && this.api && !this._settings && this._load();
	}
	async _load() {
		if (!(!this.api || this._loading)) {
			this._loading = !0;
			try {
				this._settings = await this.api.getSettings(), this._days = this._settings.activity_retention.days, this._records = this._settings.activity_retention.records;
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._loading = !1;
			}
		}
	}
	async _save() {
		if (!(!this.api || this._loading)) {
			this._loading = !0, this._error = "", this._status = "";
			try {
				let e = await this.api.updateSettings(this._days, this._records);
				this._settings &&= {
					...this._settings,
					activity_retention: e
				}, this._status = "Activity retention was updated.";
			} catch (e) {
				this._error = B(e).message;
			} finally {
				this._loading = !1;
			}
		}
	}
	render() {
		let e = J(this.capabilityTargets), t = this._settings?.diagnostics;
		return O`
      <div class="page-heading">
        <h2>Settings</h2>
        <p>Manage activity history and check that Notification Manager is ready.</p>
      </div>

      <section class="section" aria-labelledby="integration-heading">
        <div class="section-heading">
          <h3 id="integration-heading">Overview</h3>
        </div>
        <dl class="definition-list">
          <dt>Signed in as</dt>
          <dd>${this.currentUser?.name || "Home Assistant administrator"}</dd>
          <dt>Discovered signals</dt>
          <dd>${e.discoveredTargets.length}</dd>
          <dt>Ready notification signals</dt>
          <dd>${e.usableTargets.length}</dd>
          <dt>Devices and entities with ready signals</dt>
          <dd>${e.readySourceCount} of ${e.discoveredSourceCount}</dd>
          <dt>Phone matches to review</dt>
          <dd>${this.unconfirmedMappings.length}</dd>
        </dl>
      </section>

      <section class="section" aria-labelledby="health-heading">
        <div class="section-heading">
          <h3 id="health-heading">System status</h3>
        </div>
        ${this._loading && !t ? O`<p>Loading integration status…</p>` : t ? O`
                <dl class="definition-list">
                  <dt>Version</dt>
                  <dd>${t.version}</dd>
                  <dt>Notifications on</dt>
                  <dd>${t.rules.enabled} of ${t.rules.total}</dd>
                  <dt>Needs attention</dt>
                  <dd>${t.rules.health.NEEDS_ATTENTION}</dd>
                  <dt>Household phones</dt>
                  <dd>
                    ${t.discovery.recipients} people,
                    ${t.discovery.enabled_endpoints} ready phones
                  </dd>
                  <dt>Notification engine</dt>
                  <dd>
                    ${t.runtime.attached ? `Running, ${t.runtime.watched_rules} active, ${t.runtime.pending_timers} waiting` : "Not running"}
                  </dd>
                </dl>
              ` : A}
      </section>

      <section class="section" aria-labelledby="retention-heading">
        <div class="section-heading">
          <h3 id="retention-heading">Activity history</h3>
          <p>Older activity is removed when either limit is reached.</p>
        </div>
        <div class="settings-form">
          <label>
            Keep for days
            <input
              type="number"
              min="1"
              max="3650"
              .value=${String(this._days)}
              @input=${(e) => this._days = Number(e.currentTarget.value)}
            />
          </label>
          <label>
            Maximum entries
            <input
              type="number"
              min="1"
              max="1000"
              .value=${String(this._records)}
              @input=${(e) => this._records = Number(e.currentTarget.value)}
            />
          </label>
          <notification-manager-button
            variant="primary"
            .disabled=${this._loading}
            @click=${this._save}
          >
            Save
          </notification-manager-button>
        </div>
        ${this._error ? O`<p class="feedback error" role="alert">${this._error}</p>` : A}
        ${this._status ? O`<p class="feedback" aria-live="polite">${this._status}</p>` : A}
      </section>
    `;
	}
};
customElements.get("notification-manager-settings-page") || customElements.define("notification-manager-settings-page", nt);
//#endregion
//#region src/notification-manager-panel.ts
var rt = class extends L {
	constructor(...e) {
		super(...e), this.narrow = !1, this._activeRoute = Pe(globalThis.location?.hash ?? ""), this._connectedToHomeAssistant = globalThis.navigator?.onLine ?? !0, this._errorMessage = "", this._loadState = "idle", this._loadGeneration = 0, this._notificationView = "list", this._onboardingActive = !1, this._selectedRuleId = "", this._editorDirty = !1, this._handleHashChange = () => {
			let e = Pe(globalThis.location?.hash ?? "");
			if (!this._bootstrapData) {
				this._activeRoute = e;
				return;
			}
			let t = Fe(e, this._bootstrapData.current_user.is_admin);
			if (t !== "notifications" && this._editorDirty && !this._confirmDiscard()) {
				globalThis.history?.replaceState(null, "", H("notifications"));
				return;
			}
			this._activeRoute = t, t !== "notifications" && (this._notificationView = "list", this._selectedRuleId = ""), t !== e && globalThis.history?.replaceState(null, "", H(t));
		}, this._handleConnectionReady = () => {
			this._connectedToHomeAssistant = !0, this._loadBootstrap();
		}, this._handleConnectionLost = () => {
			this._connectedToHomeAssistant = !1;
		}, this._handleOnline = () => {
			this.hass && this._loadBootstrap();
		}, this._handleOffline = () => {
			this._connectedToHomeAssistant = !1;
		}, this._handleBeforeUnload = (e) => {
			this._editorDirty && (e.preventDefault(), e.returnValue = "");
		};
	}
	static {
		this.properties = {
			hass: { attribute: !1 },
			narrow: {
				type: Boolean,
				reflect: !0
			},
			panel: { attribute: !1 },
			route: { attribute: !1 },
			_activeRoute: { state: !0 },
			_bootstrapData: { state: !0 },
			_connectedToHomeAssistant: { state: !0 },
			_errorMessage: { state: !0 },
			_loadState: { state: !0 },
			_notificationView: { state: !0 },
			_onboardingActive: { state: !0 },
			_selectedRuleId: { state: !0 }
		};
	}
	static {
		this.styles = o`
    :host {
      display: block;
      min-block-size: 100%;
      background: var(--primary-background-color, #f6f6f6);
      color: var(--primary-text-color, #212121);
      font-family: var(
        --ha-font-family-body,
        var(--paper-font-body1_-_font-family, sans-serif)
      );
      font-size: 14px;
      line-height: 1.5;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .shell {
      min-block-size: 100%;
    }

    .app-header {
      border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      background: var(--app-header-background-color, var(--card-background-color, #fafafa));
      color: var(--app-header-text-color, var(--primary-text-color, #212121));
    }

    .app-header-inner {
      display: flex;
      align-items: center;
      gap: 28px;
      min-block-size: 64px;
      max-inline-size: 1120px;
      margin: 0 auto;
      padding:
        max(8px, env(safe-area-inset-top))
        max(24px, env(safe-area-inset-right))
        8px
        max(24px, env(safe-area-inset-left));
    }

    .app-title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }

    .navigation {
      flex: 1;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .navigation-inner {
      display: flex;
      align-items: stretch;
      gap: 4px;
      min-inline-size: max-content;
      justify-content: flex-end;
    }

    .navigation a {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 48px;
      border-radius: 6px;
      padding: 0 12px;
      color: var(--secondary-text-color, #616161);
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition:
        background-color 140ms ease,
        color 140ms ease;
    }

    .navigation a::after {
      content: "";
      position: absolute;
      inset-inline: 10px;
      inset-block-end: 0;
      block-size: 2px;
      background: transparent;
    }

    .navigation a:hover {
      background: var(--secondary-background-color, #f1f1f1);
      color: var(--primary-text-color, #212121);
    }

    .navigation a[aria-current="page"] {
      color: var(--primary-text-color, #212121);
    }

    .navigation a[aria-current="page"]::after {
      background: var(--primary-color, #3f6f58);
    }

    .navigation a:focus-visible {
      outline: 2px solid var(--primary-color, #3f6f58);
      outline-offset: -3px;
    }

    .navigation ha-icon {
      --mdc-icon-size: 20px;
      inline-size: 20px;
      block-size: 20px;
      flex: none;
    }

    main {
      max-inline-size: 1120px;
      margin: 0 auto;
      padding:
        32px
        max(24px, env(safe-area-inset-right))
        max(48px, env(safe-area-inset-bottom))
        max(24px, env(safe-area-inset-left));
    }

    .state-container {
      max-inline-size: 720px;
    }

    .skeleton {
      display: grid;
      gap: 16px;
      max-inline-size: 760px;
      padding-top: 4px;
    }

    .skeleton-line,
    .skeleton-row {
      display: block;
      background: var(--secondary-background-color, #e9e9e9);
    }

    .skeleton-line {
      inline-size: min(240px, 60%);
      block-size: 24px;
      border-radius: 8px;
    }

    .skeleton-row {
      block-size: 64px;
      border-radius: 8px;
    }

    .sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }

    @media (max-width: 700px) {
      .app-header-inner {
        display: block;
        padding: max(10px, env(safe-area-inset-top)) 0 0;
      }

      .app-title {
        padding: 0 max(16px, env(safe-area-inset-left)) 10px;
        font-size: 18px;
      }

      .navigation {
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .navigation-inner {
        justify-content: flex-start;
        padding-inline: 8px;
      }

      .navigation a {
        min-block-size: 52px;
        padding-inline: 10px;
      }

      main {
        padding-block-start: 24px;
        padding-inline-start: max(16px, env(safe-area-inset-left));
        padding-inline-end: max(16px, env(safe-area-inset-right));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .navigation a {
        transition: none;
      }
    }
  `;
	}
	connectedCallback() {
		super.connectedCallback(), globalThis.addEventListener?.("hashchange", this._handleHashChange), globalThis.addEventListener?.("popstate", this._handleHashChange), globalThis.addEventListener?.("online", this._handleOnline), globalThis.addEventListener?.("offline", this._handleOffline), globalThis.addEventListener?.("beforeunload", this._handleBeforeUnload), this.hass?.connection && this._boundConnection !== this.hass.connection && (this._bindConnection(this.hass.connection), this._api = new V(this.hass), this._loadBootstrap());
	}
	disconnectedCallback() {
		globalThis.removeEventListener?.("hashchange", this._handleHashChange), globalThis.removeEventListener?.("popstate", this._handleHashChange), globalThis.removeEventListener?.("online", this._handleOnline), globalThis.removeEventListener?.("offline", this._handleOffline), globalThis.removeEventListener?.("beforeunload", this._handleBeforeUnload), this._unbindConnection(), this._api = void 0, super.disconnectedCallback();
	}
	updated(e) {
		if (e.has("hass")) {
			let e = this.hass?.connection;
			this._api = this.hass ? new V(this.hass) : void 0, e && e !== this._boundConnection ? (this._bindConnection(e), this._loadBootstrap()) : e || this._unbindConnection();
		}
	}
	_bindConnection(e) {
		this._unbindConnection(), this._boundConnection = e, e.addEventListener?.("ready", this._handleConnectionReady), e.addEventListener?.("disconnected", this._handleConnectionLost), e.addEventListener?.("reconnect-error", this._handleConnectionLost);
	}
	_unbindConnection() {
		this._boundConnection?.removeEventListener?.("ready", this._handleConnectionReady), this._boundConnection?.removeEventListener?.("disconnected", this._handleConnectionLost), this._boundConnection?.removeEventListener?.("reconnect-error", this._handleConnectionLost), this._boundConnection = void 0;
	}
	async _loadBootstrap() {
		let e = this._api;
		if (!e) {
			this._loadState = "error", this._errorMessage = "Home Assistant is not available to this panel.";
			return;
		}
		let t = ++this._loadGeneration, n = this._bootstrapData !== void 0;
		n || (this._loadState = "loading"), this._errorMessage = "";
		try {
			let r = await e.bootstrap();
			if (t !== this._loadGeneration) return;
			if (this._bootstrapData = r, this._loadState = "ready", this._connectedToHomeAssistant = !0, !n && r.current_user.is_admin && r.rules.length === 0 && !this._onboardingWasCompleted(r.current_user.id)) {
				this._onboardingActive = !0, this._activeRoute = "people", globalThis.history?.replaceState(null, "", H("people"));
				return;
			}
			let i = Fe(this._activeRoute, r.current_user.is_admin);
			i !== this._activeRoute && (this._activeRoute = i, globalThis.history?.replaceState(null, "", H(i)));
		} catch (e) {
			if (t !== this._loadGeneration) return;
			let r = B(e);
			this._errorMessage = r.message, n ? (this._loadState = "ready", this._connectedToHomeAssistant = !1) : this._loadState = "error";
		}
	}
	_renderHeader(e) {
		return O`
      <header class="app-header">
        <div class="app-header-inner">
          <h1 class="app-title">Notification Manager</h1>
          ${e ? this._renderNavigation(e) : A}
        </div>
      </header>
    `;
	}
	_renderNavigation(e) {
		return O`
      <nav class="navigation" aria-label="Notification Manager">
        <div class="navigation-inner">
          ${Ie(e.current_user.is_admin).map((e) => O`
              <a
                href=${H(e.route)}
                @click=${(t) => {
			t.preventDefault(), this._goToRoute(e.route);
		}}
                aria-current=${this._activeRoute === e.route ? "page" : A}
              >
                <ha-icon icon=${e.icon} aria-hidden="true"></ha-icon>
                <span>${e.label}</span>
              </a>
            `)}
        </div>
      </nav>
    `;
	}
	_confirmDiscard() {
		if (!this._editorDirty) return !0;
		let e = globalThis.confirm?.("Discard your unsaved notification changes?") ?? !1;
		return e && (this._editorDirty = !1), e;
	}
	_goToRoute(e) {
		e !== "notifications" && !this._confirmDiscard() || (this._activeRoute = e, e !== "notifications" && (this._notificationView = "list"), globalThis.history?.pushState(null, "", H(e)));
	}
	_showNotification(e, t = "") {
		this._editorDirty && !this._confirmDiscard() || (this._activeRoute = "notifications", this._notificationView = e, this._selectedRuleId = t, e !== "create" && e !== "edit" && (this._editorDirty = !1), globalThis.history?.replaceState(null, "", H("notifications")));
	}
	_onboardingWasCompleted(e) {
		try {
			return globalThis.localStorage?.getItem(this._onboardingStorageKey(e)) === "complete";
		} catch {
			return !1;
		}
	}
	_onboardingStorageKey(e) {
		return `notification-manager:onboarding:${e}`;
	}
	_completeOnboardingAndCreate() {
		let e = this._bootstrapData?.current_user.id;
		if (e) try {
			globalThis.localStorage?.setItem(this._onboardingStorageKey(e), "complete");
		} catch {}
		this._onboardingActive = !1, this._showNotification("create");
	}
	async _refreshData() {
		await this._loadBootstrap();
	}
	async _handleRuleSaved(e) {
		this._editorDirty = !1, this._selectedRuleId = e.detail.rule.id, await this._refreshData(), this._notificationView = "detail";
	}
	_renderNotifications(e) {
		let t = e.rules.find((e) => e.id === this._selectedRuleId);
		return this._notificationView === "create" || this._notificationView === "edit" ? O`
        <notification-manager-rule-editor-page
          .api=${this._api}
          .currentUser=${e.current_user}
          .rule=${this._notificationView === "edit" ? t : void 0}
          .targets=${e.capability_targets}
          .recipients=${e.recipients}
          .groups=${e.groups}
          @editor-dirty=${(e) => this._editorDirty = e.detail.dirty}
          @editor-cancel=${() => this._showNotification("list")}
          @rule-saved=${(e) => void this._handleRuleSaved(e)}
        ></notification-manager-rule-editor-page>
      ` : this._notificationView === "detail" ? O`
        <notification-manager-rule-detail-page
          .api=${this._api}
          .rule=${t}
          .activity=${e.activity}
          .targets=${e.capability_targets}
          .recipients=${e.recipients}
          .groups=${e.groups}
          @detail-close=${() => this._showNotification("list")}
          @rule-edit=${() => this._showNotification("edit", this._selectedRuleId)}
          @rule-deleted=${() => {
			this._showNotification("list"), this._refreshData();
		}}
          @data-changed=${() => void this._refreshData()}
        ></notification-manager-rule-detail-page>
      ` : O`
      <notification-manager-notifications-page
        .api=${this._api}
        .currentUser=${e.current_user}
        .rules=${e.rules}
        .targets=${e.capability_targets}
        .recipients=${e.recipients}
        .groups=${e.groups}
        @rule-create=${() => this._showNotification("create")}
        @rule-open=${(e) => this._showNotification("detail", e.detail.ruleId)}
        @data-changed=${() => void this._refreshData()}
      ></notification-manager-notifications-page>
    `;
	}
	_renderLoading() {
		return O`
      <main>
        <div class="skeleton" role="status" aria-busy="true">
          <span class="sr-only">Loading Notification Manager</span>
          <span class="skeleton-line"></span>
          <span class="skeleton-row"></span>
          <span class="skeleton-row"></span>
          <span class="skeleton-row"></span>
        </div>
      </main>
    `;
	}
	_renderError() {
		return O`
      <main>
        <div class="state-container">
          <notification-manager-status-panel
            kind="error"
            heading="Could not load Notification Manager"
            .message=${this._errorMessage}
          >
            <notification-manager-button
              slot="actions"
              icon="mdi:refresh"
              @click=${() => void this._loadBootstrap()}
            >
              Retry
            </notification-manager-button>
          </notification-manager-status-panel>
        </div>
      </main>
    `;
	}
	_renderPage(e) {
		switch (this._activeRoute) {
			case "people": return O`
          <notification-manager-people-groups-page
            .api=${this._api}
            .currentUser=${e.current_user}
            .recipients=${e.recipients}
            .groups=${e.groups}
            .onboarding=${this._onboardingActive}
            .unconfirmedMappings=${e.unconfirmed_recipient_mappings}
            @data-changed=${() => void this._refreshData()}
            @create-first-notification=${() => this._completeOnboardingAndCreate()}
          ></notification-manager-people-groups-page>
        `;
			case "activity": return O`
          <notification-manager-activity-page
            .api=${this._api}
            .activity=${e.activity}
            .rules=${e.rules}
            .recipients=${e.recipients}
          ></notification-manager-activity-page>
        `;
			case "settings": return e.current_user.is_admin ? O`
              <notification-manager-settings-page
                .api=${this._api}
                .currentUser=${e.current_user}
                .capabilityTargets=${e.capability_targets}
                .unconfirmedMappings=${e.unconfirmed_recipient_mappings}
              ></notification-manager-settings-page>
            ` : O`
              <notification-manager-notifications-page
                .api=${this._api}
                .currentUser=${e.current_user}
                .rules=${e.rules}
                .targets=${e.capability_targets}
                .recipients=${e.recipients}
                .groups=${e.groups}
              ></notification-manager-notifications-page>
            `;
			default: return this._renderNotifications(e);
		}
	}
	render() {
		let e = this._bootstrapData;
		return O`
      <div class="shell">
        ${this._renderHeader(e)}
        ${e && !this._connectedToHomeAssistant ? O`
              <notification-manager-status-panel
                kind="offline"
                heading="Connection lost"
                message="Waiting for Home Assistant. Current data may be out of date."
                compact
              ></notification-manager-status-panel>
            ` : A}
        ${this._loadState === "error" ? this._renderError() : !e || this._loadState === "loading" ? this._renderLoading() : O`<main id="main-content">${this._renderPage(e)}</main>`}
      </div>
    `;
	}
};
customElements.get("notification-manager-panel") || customElements.define("notification-manager-panel", rt);
//#endregion
export { V as NotificationManagerApi, z as NotificationManagerApiError, rt as NotificationManagerPanel };
