//#region ../live-mix/src/core/params.ts
function e(e, t) {
	return Number.isFinite(t) ? Math.min(e.max, Math.max(e.min, t)) : e.default;
}
//#endregion
//#region ../live-mix/src/core/automation/Modulator.ts
function t(e) {
	return e - Math.floor(e);
}
/**
* The 0..1 waveform at `phase` (cycles). `sine` is Tides' `breathMod`
* (`sin(2π·phase)·0.5 + 0.5`); the other shapes start at the same point of the
* cycle so swapping shape keeps the peak at phase 0.25 and the trough at 0.75.
*/
function n(e, n) {
	switch (e) {
		case "sine": return Math.sin(n * Math.PI * 2) * .5 + .5;
		case "triangle": {
			let e = t(n);
			return e < .25 ? .5 + 2 * e : e < .75 ? 1.5 - 2 * e : 2 * e - 1.5;
		}
		case "saw": return t(n);
		case "square": return +(t(n) < .5);
		default: return e;
	}
}
/**
* Tides' breathing law (`kkfonie/Tides/Source/PluginProcessor.cpp:332-333`):
* `modAmount = 1 − depth·(1 − breathMod)`. At depth 1 it is the waveform
* itself; at depth 0 it is a constant 1. Also `fdnReverbBreathLaw` in
* `./dsp`, which the FdnReverb device runs in C++.
*/
function r(e, t) {
	return 1 - t * (1 - e);
}
/** The phase (cycles, wrapped to [0, 1)) of an LFO pinned at `anchorPhase` at `anchorSec`. */
function i(e, n, r, i) {
	return t(e + (i - n) * r);
}
/** murmur3's finaliser over (seed, index): a repeatable 0..1 per step. */
function a(e, t) {
	let n = (e ^ Math.imul(t, 2654435769)) >>> 0;
	return n = Math.imul(n ^ n >>> 16, 2246822507) >>> 0, n = Math.imul(n ^ n >>> 13, 3266489909) >>> 0, n = (n ^ n >>> 16) >>> 0, n / 4294967296;
}
/** `Random`'s law without the object: the 0..1 value of a seeded sample-and-hold at `timeSec`. */
function o(e, t, n, r) {
	let i = r * e, o = Math.floor(i), s = a(t >>> 0, o);
	return n ? s + (a(t >>> 0, o + 1) - s) * (i - o) : s;
}
//#endregion
//#region ../live-mix/src/core/automation/param-modulation.ts
/** The source's 0..1 value at `timeSec`: `Lfo.valueAtTime` and `Random.valueAtTime` without the objects. */
function s(e, t) {
	if (e.kind === "lfo") {
		let a = i(e.anchorPhase, e.anchorSec, e.rateHz, t);
		return r(n(e.shape, a), e.depth);
	}
	return o(e.rateHz, e.seed, e.smooth, t);
}
/** What the routes add at `timeSec`, as a fraction of the parameter's travel (`routeOffset`, summed). */
function c(e, t) {
	let n = 0;
	for (let r of e.routes) {
		let e = s(r.source, t);
		n += r.depth * (r.polarity === "bipolar" ? e * 2 - 1 : e);
	}
	return n;
}
function l(e, t) {
	return e.taper === "log" && e.min > 0 ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
}
function u(e, t) {
	return e.taper === "log" && e.min > 0 ? e.min * (e.max / e.min) ** +t : e.min + (e.max - e.min) * t;
}
/**
* The parameter's value with `offset` (a fraction of its travel) added to its
* base along the knob's own travel. A frequency on a log taper swings as many
* octaves up as down, which is how the knob turns, and a parameter that only
* takes steps (a list, a count, a switch) lands on one.
*/
function d(e, t, n) {
	if (!(e.max - e.min > 0)) return e.min;
	let r = Number.isFinite(t) ? Math.min(e.max, Math.max(e.min, t)) : e.default, i = Number.isFinite(n) && n !== 0, a = i ? Math.min(1, Math.max(0, l(e, r) + n)) : 0, o = i ? Math.min(e.max, Math.max(e.min, u(e, a))) : r, s = e.choices?.length ? 1 : e.step;
	return s === void 0 || !(s > 0) ? o : Math.min(e.max, e.min + Math.round((o - e.min) / s) * s);
}
/** The parameter's value at `timeSec`: its base moved by the routes (`paramValueAtOffset`). */
function f(e, t, n, r) {
	return d(e, t, c(n, r));
}
//#endregion
//#region ../live-mix/src/core/events.ts
var p = class {
	listeners = /* @__PURE__ */ new Set();
	/** Add a listener; returns the matching unsubscribe (idempotent). */
	subscribe(e) {
		return this.listeners.add(e), () => {
			this.listeners.delete(e);
		};
	}
	emit(e) {
		if (this.listeners.size !== 0) for (let t of [...this.listeners]) t(e);
	}
	get size() {
		return this.listeners.size;
	}
	clear() {
		this.listeners.clear();
	}
};
/**
* Whether `ctx` is a render that has not begun. None of its samples is made
* yet, so a level given now is the one the render starts at: there is no
* sound for a step to click in, and an approach from the first sample would
* leave the head of the file on its way there.
*/
function m(e) {
	return e.currentTime === 0 && typeof e.startRendering == "function";
}
//#endregion
//#region ../live-mix/src/core/pan.ts
/** A StereoPanner on `context` that plays one channel as it plays two. */
function h(e) {
	let t = e.createStereoPanner();
	return t.channelCount = 2, t.channelCountMode = "explicit", t;
}
//#endregion
//#region ../live-mix/src/core/tracks/ReturnTrack.ts
var g = class {
	name;
	device;
	/** Pan, fader, mute/solo, inserts and post-fader sends; node-free until first used. */
	strip;
	disposed = !1;
	constructor(e) {
		this.name = e.name, this.device = e.device, this.strip = new y(e.context ?? null, {
			name: e.name,
			destination: e.destination,
			solo: e.solo,
			soloSafe: e.soloSafe ?? !0
		}), this.strip.connectSource(this.device.output);
	}
	/** Sends connect here. */
	get input() {
		return this.device.input;
	}
	/** Dispose the return and its device. */
	dispose() {
		this.disposed || (this.disposed = !0, this.device.dispose(), this.strip.dispose());
	}
}, _ = class {
	ctx;
	getSource;
	items = [];
	constructor(e, t) {
		this.ctx = e, this.getSource = t;
	}
	all() {
		return this.items;
	}
	add(e, t = {}) {
		let n = this.items.find((t) => t.target === e);
		if (n) return n;
		let r = t.level === void 0 ? null : this.ctx.createGain();
		r && (r.gain.value = t.level ?? 1, r.connect(e.input));
		let i = {
			target: e,
			level: t.level ?? null,
			gainNode: r
		};
		this.items.push(i);
		let a = this.getSource();
		return a && this.connectOne(a, i), i;
	}
	remove(e) {
		let t = this.items.findIndex((t) => t.target === e);
		if (t === -1) return;
		let [n] = this.items.splice(t, 1), r = this.getSource();
		if (r) try {
			r.disconnect(n.gainNode ?? n.target.input);
		} catch {}
		n.gainNode?.disconnect();
	}
	/** Connect every send from `source` (called after a new source is attached). */
	connectAll(e) {
		for (let t of this.items) this.connectOne(e, t);
	}
	connectOne(e, t) {
		e.connect(t.gainNode ?? t.target.input);
	}
	dispose() {
		for (let e of this.items) e.gainNode?.disconnect();
		this.items.length = 0;
	}
};
//#endregion
//#region ../live-mix/src/core/tracks/ChannelStrip.ts
/** The time constant of the short approach that closes a ride at its `arriveAt`. */
const v = "ride";
var y = class {
	name;
	timeConstant;
	ctx;
	target;
	destinationNode;
	parentStrip;
	childStrips = /* @__PURE__ */ new Set();
	registry;
	sources = /* @__PURE__ */ new Set();
	insertList = [];
	changes = new p();
	sendList = null;
	nodes = null;
	/** What the sources are summed into ahead of the strip while the transport plays at another rate (`PitchKeeper`). */
	keeper = null;
	shadows = /* @__PURE__ */ new Set();
	rides = /* @__PURE__ */ new Map();
	taps = /* @__PURE__ */ new Set();
	sourceTaps = /* @__PURE__ */ new Set();
	inputGainValue = 1;
	levelValue;
	panValue = 0;
	muted = !1;
	soloed = !1;
	soloSafeFlag;
	implicitMute = !1;
	gateCommand = 1;
	disposed = !1;
	constructor(e, t) {
		this.ctx = e, this.name = t.name, this.timeConstant = t.timeConstant ?? .005, this.soloSafeFlag = t.soloSafe ?? !1, this.levelValue = Math.max(0, t.level ?? 1), this.registry = t.solo ?? null, this.target = t.destination, this.destinationNode = x(t.destination), this.parentStrip = S(t.destination), this.parentStrip?.childStrips.add(this), this.registry?.register(this), (t.eager || t.level !== void 0) && this.materialize();
	}
	/** True once the four nodes exist. */
	get materialized() {
		return this.nodes !== null;
	}
	/**
	* Create input gain → panner → fader → gate → destination (three gains and a
	* StereoPanner, in that order) and move every registered source into the
	* input gain. Idempotent; every feature calls it on first use.
	*/
	materialize() {
		return this.ensureNodes(), this;
	}
	/** Where sources enter. Reading this creates the nodes. */
	get input() {
		return this.ensureNodes().inputGain;
	}
	/** The gate, i.e. what feeds the destination and the post-fader sends. Creates the nodes. */
	get output() {
		return this.ensureNodes().gate;
	}
	/** Input trim node. Creates the nodes. */
	get inputGainNode() {
		return this.ensureNodes().inputGain;
	}
	/** The StereoPanner. Creates the nodes. */
	get panner() {
		return this.ensureNodes().panner;
	}
	/** The fader node (its `gain` is the AudioParam a Ducker or a lane targets). Creates the nodes. */
	get fader() {
		return this.ensureNodes().fader;
	}
	/** The mute/solo gate. Creates the nodes. */
	get gate() {
		return this.ensureNodes().gate;
	}
	/** The node this strip currently feeds. */
	get destination() {
		return this.destinationNode;
	}
	/** What the strip was last routed to (a bus, a group or a node). */
	get destinationTarget() {
		return this.target;
	}
	/** The group strip this one feeds, or null when it feeds a bus or a node. */
	get parent() {
		return this.parentStrip;
	}
	/** Strips routed into this one (a group's members). */
	get children() {
		return [...this.childStrips];
	}
	/** Nodes currently registered through `connectSource`. */
	get sourceNodes() {
		return [...this.sources];
	}
	/**
	* Wire a track source into the strip: straight to the destination while the
	* strip has no nodes, into the input gain once it does. Tracks call this
	* instead of `node.connect(destination)`.
	*/
	connectSource(e) {
		if (this.assertLive(), this.sources.add(e), e.connect(this.sourceEntry()), !this.keeper) for (let t of this.sourceTaps) e.connect(t);
	}
	/**
	* Sums every source into `node` before the strip, and `node` into the strip,
	* from now on: a `PitchKeeper` while the transport runs at another rate.
	* `null` connects the sources to the strip again. Sources that connect later
	* go where the others are.
	*/
	keepPitch(e) {
		if (this.assertLive(), e === this.keeper) return;
		let t = this.sourceEntry(), n = this.entry();
		e && e.connect(n);
		for (let r of this.sources) r.connect(e ?? n), r.disconnect(t);
		this.keeper && this.keeper.disconnect(n);
		for (let t of this.sourceTaps) {
			for (let e of this.sourceFeeders()) e.disconnect(t);
			for (let n of e ? [e] : this.sources) n.connect(t);
		}
		this.keeper = e;
	}
	/** The node summing the sources ahead of the strip, or null while they reach it directly. */
	get keptBy() {
		return this.keeper;
	}
	/** Drop a source from the bookkeeping after the caller disconnected it. */
	forgetSource(e) {
		this.sources.delete(e);
	}
	/** Disconnect a source from the strip and forget it. */
	disconnectSource(e) {
		if (this.sources.delete(e)) try {
			if (e.disconnect(this.sourceEntry()), !this.keeper) for (let t of this.sourceTaps) e.disconnect(t);
		} catch {}
	}
	/**
	* Let `node` hear what the track plays before the strip does anything to
	* it: every source wired through `connectSource`, now or later, or the
	* keeper they are summed into while there is one. The strip's trim,
	* inserts, pan, level, mute and solo are all after it, and so is a move of
	* the strip to another destination. Creates no strip nodes. The node hears
	* the track until the strip is disposed.
	*/
	tapSources(e) {
		if (this.assertLive(), !this.sourceTaps.has(e)) {
			this.sourceTaps.add(e);
			for (let t of this.sourceFeeders()) t.connect(e);
		}
	}
	/**
	* Re-point the strip at a new bus, group or node. Sample-continuous when the
	* new path is at unity: the graph swap lands on one render quantum. Refuses
	* to route a group into its own subtree.
	*/
	connectTo(e) {
		this.assertLive();
		let t = S(e);
		for (let e = t; e; e = e.parentStrip) if (e === this) throw Error(`live-mix: routing "${this.name}" into its own subtree would loop`);
		let n = x(e);
		if (this.nodes) this.nodes.gate.disconnect(this.destinationNode), this.nodes.gate.connect(n);
		else for (let e of this.keeper ? [this.keeper] : this.sources) e.disconnect(this.destinationNode), e.connect(n);
		let r = this.parentStrip;
		r?.childStrips.delete(this), this.target = e, this.destinationNode = n, this.parentStrip = t, t?.childStrips.add(this), this.registry?.refresh(), this.changed("routing"), r !== t && (r?.changed("members"), t?.changed("members"));
	}
	/** Last commanded input trim (linear). */
	get inputGain() {
		return this.inputGainValue;
	}
	/** Ramp the input trim (clamped at 0). */
	setInputGain(e, t = {}) {
		let { inputGain: n } = this.ensureNodes();
		this.inputGainValue = Math.max(0, e), this.ramp(n.gain, this.inputGainValue, t), this.changed("inputGain");
	}
	/** Last commanded fader value (linear). */
	get level() {
		return this.levelValue;
	}
	/** Ramp the fader (clamped at 0). */
	setLevel(e, t = {}) {
		let { fader: n } = this.ensureNodes();
		this.levelValue = Math.max(0, e), this.ramp(n.gain, this.levelValue, t), this.changed("level");
	}
	/** Last commanded pan, −1 (left) … 1 (right). */
	get pan() {
		return this.panValue;
	}
	/** Ramp the pan (clamped to ±1). */
	setPan(e, t = {}) {
		let { panner: n } = this.ensureNodes();
		this.panValue = Math.min(1, Math.max(-1, e)), this.ramp(n.pan, this.panValue, t), this.changed("pan");
	}
	/**
	* Last commanded ride of a layer (linear). A layer never moved is at 1,
	* which is the mix as it stands.
	*/
	ride(e = v) {
		return this.rides.get(e)?.value ?? 1;
	}
	/** The layers that have been moved, in the order they stand after the fader. */
	get rideLayers() {
		return [...this.rides.keys()];
	}
	/** A layer's gain node, or null until the layer is first moved. Reading it creates nothing. */
	rideNode(e = v) {
		return this.rides.get(e)?.node ?? null;
	}
	/**
	* Ramp a ride (clamped at 0): a gain after the fader that multiplies what
	* the fader lets through, so 0 takes the track out and 1 leaves the mix as
	* it is. Sends and shadows follow it as they follow the fader. `level`
	* does not change, and a later `setLevel` does not disturb a ride in
	* flight: the two are separate gains. An approach already scheduled for
	* later on this layer is dropped for the new one, so the last word wins
	* whatever order the two were to start in. With `arriveAt` the layer is at
	* its value by then. The first move of a layer makes its node; the strip's
	* own nodes are made with it.
	*/
	setRide(e, t = {}) {
		let n = this.rideLayer(t.layer ?? "ride");
		n.value = Math.max(0, e);
		let r = this.context().currentTime;
		for (let e of [n.node.gain, ...[...n.shadows.values()].map((e) => e.gain)]) e.cancelScheduledValues(r), this.approach(e, n.value, t), this.arrive(e, n.value, t);
		this.changed("ride");
	}
	get mute() {
		return this.muted;
	}
	/** Explicit mute: the gate ramps to 0 and back. Wins over any solo. */
	set mute(e) {
		this.setMute(e);
	}
	setMute(e, t = {}) {
		this.muted !== e && (this.muted = e, this.updateGate(t), this.changed("mute"));
	}
	get solo() {
		return this.soloed;
	}
	/** Solo-in-place through the registry: every other non-safe strip is muted. */
	set solo(e) {
		this.setSolo(e);
	}
	setSolo(e, t = {}) {
		this.soloed !== e && (this.soloed = e, this.registry?.refresh(t), this.changed("solo"));
	}
	get soloSafe() {
		return this.soloSafeFlag;
	}
	/** Solo-safe strips ignore other strips' solos (returns default to true). */
	set soloSafe(e) {
		this.soloSafeFlag !== e && (this.soloSafeFlag = e, this.registry?.refresh(), this.changed("soloSafe"));
	}
	/** True when another strip's solo is muting this one. */
	get implicitlyMuted() {
		return this.implicitMute;
	}
	/** Not muted, explicitly or by a solo elsewhere. */
	get audible() {
		return !this.muted && !this.implicitMute;
	}
	/** The registry's verdict for this strip; not for callers. */
	applySoloGate(e, t = {}) {
		this.implicitMute !== !e && (this.implicitMute = !e, this.updateGate(t), this.changed("gate"));
	}
	/**
	* A second fader and gate, for sound of this track that reaches the output
	* some other way than through the strip (a room it shares with other
	* tracks, `SharedSpace`) and still has to follow the track's level, mute
	* and solo. They start where the strip's stand and take every ramp
	* `setLevel`, `mute` and a solo give them from then on, at the same moment
	* and the same speed. A ramp written straight onto `fader.gain` (a ducker,
	* a lane on the strip's level) is not followed. Creates no strip nodes.
	*/
	shadow() {
		this.assertLive();
		let e = this.context(), t = e.createGain(), n = e.createGain();
		t.gain.value = this.nodes?.fader.gain.value ?? this.levelValue, n.gain.value = this.nodes?.gate.gain.value ?? this.gateCommand, t.gain.value !== this.levelValue && this.approach(t.gain, this.levelValue, {}), n.gain.value !== this.gateCommand && this.approach(n.gain, this.gateCommand, {});
		let r = {
			fader: t,
			gate: n
		}, i = t;
		for (let e of this.rides.values()) {
			let t = this.shadowRide(e);
			e.shadows.set(r, t), i.connect(t), i = t;
		}
		i.connect(n);
		for (let e of this.taps) n.connect(e);
		return this.shadows.add(r), {
			input: t,
			output: n,
			release: () => {
				if (this.shadows.delete(r)) try {
					t.disconnect();
					for (let e of this.rides.values()) e.shadows.get(r)?.disconnect(), e.shadows.delete(r);
					n.disconnect();
				} catch {}
			}
		};
	}
	/**
	* Let `node` hear all the track puts out at its level: the strip's output,
	* and whatever leaves through a shadow, now or later. A meter on a track
	* that shares its room (`SharedSpace`) then still moves with what the
	* track sends there, though not with the room's tail. Creates the strip's
	* nodes. Returns the function that takes the node off again.
	*/
	tap(e) {
		let t = this.output;
		t.connect(e);
		for (let t of this.shadows) t.gate.connect(e);
		return this.taps.add(e), () => {
			if (this.taps.delete(e)) try {
				t.disconnect(e);
				for (let t of this.shadows) t.gate.disconnect(e);
			} catch {}
		};
	}
	/** True when the strip has a post-fader send. Reading it creates nothing. */
	get hasSends() {
		return (this.sendList?.all().length ?? 0) > 0;
	}
	/**
	* Subscribe to level, pan, mute/solo, gate, insert, routing and membership
	* changes (everything a mixer view draws). Returns the unsubscribe function.
	*/
	onChange(e) {
		return this.changes.subscribe(e);
	}
	get inserts() {
		return this.insertList;
	}
	/** Append a device after the input gain (and any earlier inserts), before the pan. */
	addInsert(e) {
		if (this.assertLive(), this.insertList.includes(e)) return;
		let { panner: t } = this.ensureNodes(), n = this.insertTail();
		n.disconnect(t);
		let r = !1;
		try {
			n.connect(e.input), r = !0, e.output.connect(t);
		} catch (i) {
			throw r && n.disconnect(e.input), n.connect(t), i;
		}
		this.insertList.push(e), this.changed("inserts");
	}
	/** Remove a device and reconnect around it (does not dispose it). */
	removeInsert(e) {
		this.assertLive();
		let t = this.insertList.indexOf(e);
		if (t === -1) return;
		let { inputGain: n, panner: r } = this.ensureNodes(), i = t === 0 ? n : this.insertList[t - 1].output, a = this.insertList[t + 1]?.input ?? r;
		try {
			i.disconnect(e.input);
		} catch {}
		try {
			e.output.disconnect(a);
		} catch {}
		this.insertList.splice(t, 1), i.connect(a), this.changed("inserts");
	}
	/** Post-fader sends. Adding one creates the nodes. */
	get sends() {
		return this.sendList ??= new _(this.context(), () => this.gate), this.sendList;
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = !0;
		let e = this.parentStrip;
		e?.childStrips.delete(this), this.parentStrip = null, this.registry?.unregister(this), this.sendList?.dispose();
		for (let e of this.shadows) try {
			e.fader.disconnect(), e.gate.disconnect();
		} catch {}
		this.shadows.clear(), this.taps.clear();
		for (let e of this.sourceTaps) for (let t of this.sourceFeeders()) try {
			t.disconnect(e);
		} catch {}
		this.sourceTaps.clear();
		try {
			this.nodes?.inputGain.disconnect();
			for (let e of this.insertList) e.output.disconnect();
			this.nodes?.panner.disconnect(), this.nodes?.fader.disconnect();
			for (let e of this.rides.values()) {
				e.node.disconnect();
				for (let t of e.shadows.values()) t.disconnect();
			}
			this.nodes?.gate.disconnect();
		} catch {}
		this.rides.clear(), this.nodes = null, this.insertList.length = 0, this.sources.clear(), this.changed("dispose"), this.changes.clear(), e?.changed("members");
	}
	changed(e) {
		this.changes.emit({
			kind: e,
			strip: this
		});
	}
	updateGate(e) {
		let t = this.muted || this.implicitMute ? 0 : 1;
		if (t === this.gateCommand) return;
		if (t === 1 && !this.nodes) {
			this.gateCommand = 1;
			return;
		}
		let { gate: n } = this.ensureNodes();
		this.gateCommand = t, this.ramp(n.gain, t, e);
	}
	ramp(e, t, n) {
		if (this.approach(e, t, n), this.shadows.size === 0 || !this.nodes) return;
		let { fader: r, gate: i } = this.nodes;
		if (!(e !== r.gain && e !== i.gain)) for (let i of this.shadows) this.approach(e === r.gain ? i.fader.gain : i.gate.gain, t, n);
	}
	approach(e, t, n) {
		let r = this.context(), i = n.at ?? r.currentTime;
		if (i <= 0 && n.timeConstant === void 0 && m(r)) {
			e.setValueAtTime(t, 0);
			return;
		}
		e.setTargetAtTime(t, i, n.timeConstant ?? this.timeConstant);
	}
	/** From `arriveAt` on, the rest of the way at once (see `RideOptions.arriveAt`). */
	arrive(e, t, n) {
		let r = n.at ?? this.context().currentTime;
		n.arriveAt === void 0 || !(n.arriveAt > r) || (n.timeConstant ?? this.timeConstant) <= .02 || e.setTargetAtTime(t, n.arriveAt, .02);
	}
	/**
	* The layer's gain, made on first use and put last before the gate, in the
	* strip and in every shadow. It comes up at unity, so making one while the
	* track sounds is sample-continuous.
	*/
	rideLayer(e) {
		let t = this.rides.get(e);
		if (t) return t;
		this.assertLive();
		let { fader: n, gate: r } = this.ensureNodes(), i = this.context(), a = [...this.rides.values()].pop(), o = i.createGain(), s = a?.node ?? n;
		s.disconnect(r), s.connect(o), o.connect(r);
		let c = {
			node: o,
			shadows: /* @__PURE__ */ new Map(),
			value: 1
		};
		for (let e of this.shadows) {
			let t = i.createGain(), n = a?.shadows.get(e) ?? e.fader;
			n.disconnect(e.gate), n.connect(t), t.connect(e.gate), c.shadows.set(e, t);
		}
		return this.rides.set(e, c), c;
	}
	/** A shadow's copy of a ride layer, standing where the strip's stands now and heading where it heads. */
	shadowRide(e) {
		let t = this.context().createGain();
		return t.gain.value = e.node.gain.value, t.gain.value !== e.value && this.approach(t.gain, e.value, {}), t;
	}
	entry() {
		return this.nodes?.inputGain ?? this.destinationNode;
	}
	/** Where a source connects: the keeper while there is one, else the strip. */
	sourceEntry() {
		return this.keeper ?? this.entry();
	}
	/** What feeds the strip's entry: the keeper while there is one, else every source. */
	sourceFeeders() {
		return this.keeper ? [this.keeper] : this.sources;
	}
	insertTail() {
		let e = this.insertList[this.insertList.length - 1];
		return e ? e.output : this.ensureNodes().inputGain;
	}
	ensureNodes() {
		if (this.nodes) return this.nodes;
		this.assertLive();
		let e = this.context(), t = e.createGain(), n = h(e), r = e.createGain(), i = e.createGain();
		this.levelValue !== 1 && (r.gain.value = this.levelValue), t.connect(n), n.connect(r), r.connect(i), i.connect(this.destinationNode);
		let a = {
			inputGain: t,
			panner: n,
			fader: r,
			gate: i
		};
		this.nodes = a;
		for (let e of this.keeper ? [this.keeper] : this.sources) e.disconnect(this.destinationNode), e.connect(t);
		return a;
	}
	context() {
		if (this.ctx ??= this.destinationNode.context ?? null, !this.ctx) throw Error(`live-mix: strip "${this.name}" needs an AudioContext to create nodes`);
		return this.ctx;
	}
	assertLive() {
		if (this.disposed) throw Error(`live-mix: strip "${this.name}" is disposed`);
	}
};
function b(e) {
	return typeof e.input == "object";
}
/** The node sources connect to for a destination: a bus's or group's `input`, or the node itself. */
function x(e) {
	return b(e) ? e.input : e;
}
function S(e) {
	return b(e) ? e.strip ?? null : null;
}
//#endregion
//#region ../live-mix/src/core/tracks/InstrumentTrack.ts
var ee = class {
	name;
	/** Pan, fader, mute/solo, inserts and post-fader sends; node-free until first used. */
	strip;
	current;
	held = /* @__PURE__ */ new Set();
	disposed = !1;
	constructor(e) {
		this.name = e.name, this.current = e.device, this.strip = new y(e.context ?? null, {
			name: e.name,
			destination: e.destination,
			solo: e.solo
		}), this.strip.connectSource(this.current.output);
	}
	/** The instrument the track plays right now. */
	get device() {
		return this.current;
	}
	/**
	* Swap the instrument and keep the strip (level, pan, inserts, sends). Notes
	* held on the old device are released and its output stays wired into the
	* strip, so the release is heard. Returns the old device, which the caller
	* owns from here: dispose it once its tail has gone (that disconnects it),
	* or keep it to swap back.
	*/
	setDevice(e) {
		let t = this.current;
		if (this.disposed || e === t) return t;
		for (let e of this.held) t.noteOff(e);
		return this.held.clear(), this.strip.forgetSource(t.output), this.current = e, this.strip.connectSource(e.output), t;
	}
	noteOn(e, t, n) {
		this.disposed || (this.held.add(e), this.current.noteOn(e, t, n));
	}
	noteOff(e) {
		this.disposed || (this.held.delete(e), this.current.noteOff(e));
	}
	/** Dispose the track and its device. */
	dispose() {
		this.disposed || (this.disposed = !0, this.held.clear(), this.current.dispose(), this.strip.dispose());
	}
};
/** Default location of the bundled sampler worker, relative to the built core entry. Call lazily. */
function te() {
	return new URL("./load-sampler.js", import.meta.url).href;
}
const C = ({ buffer: e, intervalSec: t, url: n }) => {
	let r = n === void 0 ? te() : typeof n == "string" ? n : n.href, i = new Worker(r), a = new Int32Array(e), o = Atomics.add(a, 1, 1) + 1, s = {
		onreport: null,
		stop: () => {
			Atomics.compareExchange(a, 1, o, o + 1), i.onmessage = null;
		}
	};
	i.onmessage = (e) => s.onreport?.(e.data), i.onerror = (e) => e.preventDefault();
	let c = {
		buffer: e,
		run: o,
		slots: 1024,
		reportMs: t * 1e3
	};
	return i.postMessage(c), s;
};
/** Whether this context renders against the clock: an offline render has no real time to take a share of. */
function w(e) {
	return typeof e.startRendering != "function";
}
function T() {
	let e = globalThis;
	return typeof SharedArrayBuffer == "function" && e.crossOriginIsolated === !0 && typeof e.Worker == "function";
}
const E = /* @__PURE__ */ new WeakMap();
/**
* The marks handed out on one context, and the sampler that reads them.
* Devices claim a mark when they are made (`LoadProbe.for(context).claim`),
* and `EngineStats` starts the sampler while somebody watches.
*/
var ne = class e {
	/** The context's probe, made on first use. */
	static for(t) {
		let n = E.get(t);
		return n || (n = new e({ measurable: w(t) && T() }), E.set(t, n)), n;
	}
	/** Whether load can be measured here at all. */
	measurable;
	createSampler;
	buffer = null;
	claims = /* @__PURE__ */ new Set();
	free = [];
	nextIndex = 1;
	sampler = null;
	loads = /* @__PURE__ */ new Map();
	constructor(e = {}) {
		this.measurable = e.measurable ?? T(), this.createSampler = e.createSampler ?? C;
	}
	/** A mark for one processor of kind `label`; release it when the processor goes. */
	claim(e) {
		let t = this.measurable ? this.takeIndex() : 0, n = this.claims, r = this.free, i = {
			label: e,
			index: t,
			slot: t > 0 ? {
				buffer: this.cells(),
				slot: t
			} : void 0,
			memoryBytes: 0,
			release: () => {
				n.delete(i) && t > 0 && r.push(t);
			}
		};
		return n.add(i), i;
	}
	/** The marked processors by kind, costliest first, then by name; loads are the last interval's. */
	devices() {
		let e = /* @__PURE__ */ new Map();
		for (let t of this.claims) {
			let n = e.get(t.label);
			n || (n = {
				label: t.label,
				count: 0,
				load: this.loads.get(t.label) ?? 0,
				memoryBytes: 0
			}, e.set(t.label, n)), n.count += 1, n.memoryBytes += t.memoryBytes;
		}
		return [...e.values()].sort((e, t) => t.load - e.load || t.memoryBytes - e.memoryBytes || e.label.localeCompare(t.label));
	}
	/**
	* Sample until the returned function is called, handing `onReading` the
	* share of real time the marked processors took every `intervalSec`.
	* Does nothing where load cannot be measured, or while it already runs.
	*/
	start(e, t, n) {
		if (!this.measurable || this.sampler) return () => {};
		let r = this.createSampler({
			buffer: this.cells(),
			intervalSec: e,
			url: n
		});
		return this.sampler = r, r.onreport = (e) => {
			if (e.total <= 0) return;
			let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
			for (let e of this.claims) e.index > 0 && r.set(e.index, e.label);
			let i = 0;
			for (let t = 1; t < e.counts.length; t += 1) {
				let a = e.counts[t];
				if (!a) continue;
				i += a;
				let o = r.get(t);
				o !== void 0 && n.set(o, (n.get(o) ?? 0) + a / e.total);
			}
			this.loads = n, t({
				load: i / e.total,
				samples: e.total
			});
		}, () => {
			this.sampler === r && (r.onreport = null, r.stop(), this.sampler = null, this.loads = /* @__PURE__ */ new Map());
		};
	}
	cells() {
		return this.buffer ??= new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT), this.buffer;
	}
	takeIndex() {
		let e = this.free.pop();
		if (e !== void 0) return e;
		if (this.nextIndex >= 1024) return 0;
		let t = this.nextIndex;
		return this.nextIndex += 1, t;
	}
};
const D = /* @__PURE__ */ new WeakMap();
/**
* What one instance of a device module holds: its memory is fixed in size, so
* a throwaway instance (never initialised, never run) says it. Asked once per
* module; 0 when the module cannot be instantiated with no imports.
*/
function O(e) {
	let t = D.get(e);
	return t || (t = WebAssembly.instantiate(e, {}).then((e) => {
		let t = e.exports.memory;
		return t instanceof WebAssembly.Memory ? t.buffer.byteLength : 0;
	}, () => 0), D.set(e, t)), t;
}
//#endregion
//#region ../live-mix/src/core/worklet-loader.ts
const k = /* @__PURE__ */ new WeakMap();
function A(e, t) {
	let n = k.get(e);
	n || (n = /* @__PURE__ */ new Map(), k.set(e, n));
	let r = n.get(t);
	return r || (r = e.audioWorklet.addModule(t).catch((e) => {
		throw n.delete(t), e;
	}), n.set(t, r)), r;
}
//#endregion
//#region ../live-mix/src/core/worklet-node.ts
const re = /* @__PURE__ */ new WeakMap();
/** A worklet node on `context`, made with the constructor it was given or else the page's. */
function ie(e, t, n) {
	return new ((re.get(e)) ?? AudioWorkletNode)(e, t, n);
}
//#endregion
//#region ../live-mix/src/dsp/assets.ts
/** Default location of the bundled worklet processor. Call lazily. */
function ae() {
	return new URL("./wasm-device.js", import.meta.url).href;
}
function oe(e) {
	return e === void 0 ? ae() : typeof e == "string" ? e : e.href;
}
const j = /* @__PURE__ */ new Map();
/**
* Compile a device module once per page. URL-shaped sources are cached by
* href; bytes, Responses and Modules are compiled (or returned) per call.
*/
function se(e) {
	if (e instanceof WebAssembly.Module) return Promise.resolve(e);
	if (typeof e == "string" || e instanceof URL) {
		let t = typeof e == "string" ? e : e.href, n = j.get(t);
		return n || (n = ce(t).catch((e) => {
			throw j.delete(t), e;
		}), j.set(t, n)), n;
	}
	return e instanceof Response ? M(e) : WebAssembly.compile(e);
}
async function ce(e) {
	let t = await fetch(e);
	if (!t.ok) throw Error(`live-mix: failed to fetch device module ${e}: ${t.status}`);
	return M(t);
}
async function M(e) {
	return typeof WebAssembly.compileStreaming == "function" && (e.headers.get("content-type") ?? "").includes("application/wasm") ? WebAssembly.compileStreaming(e) : WebAssembly.compile(await e.arrayBuffer());
}
const N = (e) => typeof e == "number" && Number.isFinite(e), P = (e, t, n) => Math.min(n, Math.max(t, e));
function F(e, t, n, r) {
	return N(e) ? P(Math.round(e), n, r) : t;
}
function I(e, t, n, r) {
	return N(e) ? P(e, n, r) : t;
}
/** The most frames a zone can address: frame positions cross to the device as floats. */
const L = 16777216;
/**
* Fill in every default and bring every value into range. Zones that name no
* sound or have no root key are left out and named in `problems`; nothing
* throws. Round-robin groups are renumbered 1, 2, … in order of appearance,
* and a group's length is at least its highest position.
*/
function le(e) {
	let t = [], n = [], r = /* @__PURE__ */ new Map(), i = Array.isArray(e?.zones) ? e.zones : [];
	Array.isArray(e?.zones) || t.push("the map has no list of zones"), i.forEach((e, i) => {
		if (typeof e?.sample != "string" || e.sample === "") {
			t.push(`zone ${i}: no sample`);
			return;
		}
		if (!N(e.rootKey)) {
			t.push(`zone ${i}: no root key`);
			return;
		}
		let a = F(e.rootKey, 60, 0, 127), o = F(e.loKey, a, 0, 127), s = F(e.hiKey, a, 0, 127);
		o > s && ([o, s] = [s, o]);
		let c = F(e.loVel, 0, 0, 127), l = F(e.hiVel, 127, 0, 127);
		c > l && ([c, l] = [l, c]);
		let u = F(e.start, 0, 0, L), d = F(e.end, 0, 0, L);
		d !== 0 && d <= u && (t.push(`zone ${i}: its end is not after its start`), d = 0);
		let f = null;
		if (e.loop) {
			let n = F(e.loop.start, 0, 0, L), r = F(e.loop.end, 0, 0, L);
			r !== 0 && r <= n && (t.push(`zone ${i}: its loop ends before it starts`), r = 0);
			let a = F(e.loop.crossfade, 0, 0, L);
			f = {
				start: n,
				end: r,
				crossfade: a,
				crossfadeSec: a > 0 ? 0 : I(e.loop.crossfadeSec, 0, 0, 60),
				mode: e.loop.mode === "sustain" ? "sustain" : "continuous"
			};
		}
		let p = null;
		if (e.roundRobin && N(e.roundRobin.group) && e.roundRobin.group >= 1) {
			let t = Math.round(e.roundRobin.group), n = r.get(t);
			n === void 0 && (n = r.size + 1, r.set(t, n));
			let i = F(e.roundRobin.position, 1, 1, 1024);
			p = {
				group: n,
				position: i,
				length: F(e.roundRobin.length, i, 1, 1024)
			};
		}
		n.push({
			sample: e.sample,
			rootKey: a,
			tuneCents: I(e.tuneCents, 0, -4800, 4800),
			loKey: o,
			hiKey: s,
			loVel: c,
			hiVel: l,
			gainDb: I(e.gainDb, 0, -96, 24),
			pan: I(e.pan, 0, -1, 1),
			pitchTrack: I(e.pitchTrack, 1, 0, 1),
			start: u,
			end: d,
			loop: f,
			roundRobin: p
		});
	});
	let a = /* @__PURE__ */ new Map();
	for (let { roundRobin: e } of n) {
		if (!e) continue;
		let t = Math.max(e.length, e.position);
		a.set(e.group, Math.max(a.get(e.group) ?? 1, t));
	}
	for (let { roundRobin: e } of n) e && (e.length = a.get(e.group) ?? e.length);
	let o = { zones: n };
	return typeof e?.name == "string" && e.name !== "" && (o.name = e.name), {
		map: o,
		problems: t
	};
}
const R = (e) => `${(e / (1024 * 1024)).toFixed(1)} MB`;
function z(e) {
	return [...new Set(e.map((e) => e.sample))];
}
function B(e, t, n) {
	let r = 0;
	for (let i of z(e)) {
		let { frames: e, channels: a } = t(i);
		r += e * (n ? 1 : Math.min(2, Math.max(1, a)));
	}
	return r;
}
const V = (e) => `${e.loKey}:${e.hiKey}`;
/** One take of each round robin: the lowest position of every group, on each range of keys and velocities. */
function H(e) {
	let t = /* @__PURE__ */ new Map(), n = (e) => `${e.roundRobin?.group}:${V(e)}:${e.loVel}:${e.hiVel}`;
	for (let r of e) {
		if (!r.roundRobin) continue;
		let e = n(r);
		t.set(e, Math.min(t.get(e) ?? Infinity, r.roundRobin.position));
	}
	return e.filter((e) => !e.roundRobin || e.roundRobin.position === t.get(n(e))).map((e) => ({
		...e,
		roundRobin: null
	}));
}
/** One velocity layer per range of keys: the one a firm touch (100) plays, else the loudest; it then takes every velocity. */
function U(e) {
	let t = /* @__PURE__ */ new Map(), n = (e) => `${e.loVel}:${e.hiVel}`;
	for (let r of new Set(e.map(V))) {
		let i = e.filter((e) => V(e) === r), a = i.find((e) => e.loVel <= 100 && e.hiVel >= 100), o = i.reduce((e, t) => t.hiVel > e.hiVel ? t : e);
		t.set(r, n(a ?? o));
	}
	return e.filter((e) => n(e) === t.get(V(e))).map((e) => ({
		...e,
		loVel: 0,
		hiVel: 127
	}));
}
/** Every other sampled key, counted from the lowest root. */
function ue(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(V(n), Math.min(t.get(V(n)) ?? Infinity, n.rootKey));
	let n = [...t.entries()].sort((e, t) => e[1] - t[1]).map(([e]) => e), r = new Set(n.filter((e, t) => t % 2 == 0));
	return e.filter((e) => r.has(V(e)));
}
/**
* Decide what of an instrument loads into a device: all of it when it fits,
* otherwise nothing and the reason, or (with `overBudget: 'thin'`) less of
* it and what was left out. Pure: it reads only the sizes of the sounds.
*/
function de(e, t, n, r = {}) {
	let { map: i, problems: a } = le(e), o = Math.max(0, Math.min(n.poolFloats, N(r.budgetBytes) ? Math.floor(r.budgetBytes / 4) : Infinity)) * 4, s = (e) => {
		let n = Object.hasOwn(t, e) ? t[e] : void 0;
		return n !== void 0 && N(n.frames) && n.frames >= 4;
	}, c = z(i.zones).filter((e) => !s(e)), l = {
		frames: 0,
		channels: 1,
		sampleRate: 48e3
	}, u = (e) => t[e] ?? l, d = i.zones.filter((e) => s(e.sample)), f = !1, p = () => B(d, u, f) * 4, m = p(), h = (e) => ({
		ok: !1,
		reason: e,
		bytes: m,
		budgetBytes: o,
		missing: c,
		problems: a
	});
	if (i.zones.length === 0) return h("the instrument has no zones");
	if (d.length === 0) return h("none of the sounds its zones name were provided");
	let g = z(d).find((e) => u(e).frames > L);
	if (g !== void 0) return h(`"${g}" is longer than a zone can address (${L} frames)`);
	let _ = () => {
		let e = p();
		if (e > o) return `it needs ${R(e)} of sample memory and the budget is ${R(o)}`;
		if (d.length > n.maxZones) return `it has ${d.length} zones and the device holds ${n.maxZones}`;
		let t = z(d).length;
		return t > n.maxSamples ? `it has ${t} sounds and the device holds ${n.maxSamples}` : null;
	}, v = [], y = _();
	if (y !== null && r.overBudget === "thin") {
		let e = (e, t) => {
			if (y === null) return !1;
			let n = {
				count: d.length,
				bytes: p()
			}, r = t();
			r && (d = r);
			let i = n.bytes - p(), a = n.count - d.length;
			return i === 0 && a === 0 ? !1 : (v.push({
				step: e,
				zones: a,
				bytes: i
			}), y = _(), !0);
		};
		for (e("mono", () => (f = !0, null)), v.some((e) => e.step === "mono") || (f = !1), e("round-robin", () => H(d)), e("velocity", () => U(d)); e("keys", () => ue(d)););
	}
	return y === null ? {
		ok: !0,
		zones: d,
		samples: z(d),
		mono: f,
		bytes: p(),
		budgetBytes: o,
		thinned: v,
		missing: c,
		problems: a
	} : h(v.length > 0 ? `${y}, with everything that can be left out left out` : y);
}
/**
* The zones as the device reads them: `ZONE_FIELD_COUNT` floats each, in the
* order cpp/common/device_api.h lists. `samples` is the order the sounds are
* handed to the device in; `info` gives each one's rate, for a crossfade
* given in seconds.
*/
function fe(e, t, n) {
	let r = new Map(t.map((e, t) => [e, t])), i = new Float32Array(e.length * 20);
	return e.forEach((e, t) => {
		let a = t * 20, o = e.loop, s = n(e.sample)?.sampleRate ?? 48e3;
		i.set([
			r.get(e.sample) ?? -1,
			e.rootKey,
			e.tuneCents,
			e.loKey,
			e.hiKey,
			e.loVel,
			e.hiVel,
			e.gainDb,
			e.pan,
			e.start,
			e.end,
			o ? o.mode === "sustain" ? 2 : 1 : 0,
			o?.start ?? 0,
			o?.end ?? 0,
			o ? o.crossfade || Math.round(o.crossfadeSec * s) : 0,
			e.roundRobin?.group ?? 0,
			e.roundRobin?.position ?? 1,
			e.roundRobin?.length ?? 1,
			e.pitchTrack,
			0
		], a);
	}), i;
}
/**
* Plan a load (`planZoneLoad`) and, when it goes ahead, copy the sounds it
* uses (folded to mono where the plan says so) and encode its zones.
*/
function pe(e, t, n, r = {}) {
	let i = {};
	for (let [e, n] of Object.entries(t)) !n || n.channels.length === 0 || (i[e] = {
		frames: n.channels[0].length,
		channels: n.channels.length,
		sampleRate: n.sampleRate
	});
	let a = de(e, i, n, r);
	return a.ok ? {
		plan: a,
		load: {
			samples: a.samples.map((e) => {
				let n = t[e] ?? {
					channels: [/* @__PURE__ */ new Float32Array()],
					sampleRate: 48e3
				}, [r, i] = n.channels;
				if (i === void 0 || !a.mono) return {
					channels: n.channels.slice(0, 2).map((e) => e.slice()),
					sampleRate: n.sampleRate
				};
				let o = new Float32Array(r.length);
				for (let e = 0; e < o.length; e += 1) o[e] = .5 * (r[e] + (i[e] ?? 0));
				return {
					channels: [o],
					sampleRate: n.sampleRate
				};
			}),
			fields: fe(a.zones, a.samples, (e) => i[e])
		}
	} : {
		plan: a,
		load: null
	};
}
//#endregion
//#region ../live-mix/src/dsp/WasmDevice.ts
function W(e) {
	return e;
}
/** What of a parameter's spec its travel is worked out from, and no more: it crosses to the audio thread. */
function G(e) {
	return {
		min: e.min,
		max: e.max,
		default: e.default,
		taper: e.taper,
		...e.step === void 0 ? {} : { step: e.step },
		...e.choices === void 0 ? {} : { choices: e.choices }
	};
}
const me = Object.freeze({});
/** A definition's latency in whole samples at `sampleRate`: its own count, else its rounded seconds. */
function K(e, t) {
	return Math.max(0, Math.round(e.latencySamples ? e.latencySamples(t) : (e.latencySec ?? 0) * t));
}
/**
* How long a note that was let go is remembered, in ms, and how many notes at
* the most. A minute: the longest tails the stock instruments have (a bell's
* Decay and a steel's Sustain at 40 s, a pad's Release at 30) are over by then.
* Past the most, the oldest note that was let go is forgotten first, and a held
* one only when every note remembered is held.
*/
const q = () => typeof performance == "object" ? performance.now() : Date.now();
var J = class t {
	/**
	* Whether the device moves its parameters on the audio thread
	* (`ModulatedDevice`): true on the library's own processor. An app-local
	* processor is not sent the message, so its device says false.
	*/
	modulates;
	id;
	params;
	meters;
	node;
	latencySec;
	latencySamples;
	/** What a multi-sample instrument holds; undefined for every other device. */
	zones;
	values = /* @__PURE__ */ new Map();
	modulations;
	changes = new p();
	meterIntervalFrames;
	meterValues = [];
	meterWatchers = 0;
	/** The notes it was sent, oldest first (`playedNotes`). */
	played = [];
	/** How long the sound it was last handed is (`loadedSampleSeconds`). */
	sampleSeconds = null;
	bypassed = !1;
	disposed = !1;
	load;
	context;
	constructor(e, t, n, r, i, a) {
		let o = i.sampleRate;
		this.id = e.id, this.load = a, this.context = i, this.modulates = e.processor === void 0, this.params = e.params, this.meters = e.meters ?? me, this.zones = e.zones, this.meterIntervalFrames = Math.max(1, Math.round(o / 30)), this.node = t, this.latencySamples = K(e, o), this.latencySec = e.latencySec ?? this.latencySamples / o, this.values = n, this.modulations = r;
	}
	/**
	* Compile (cached), load the processor (once per context), and construct
	* the node with the module and initial params in `processorOptions`.
	*/
	static async create(n, r, i = {}) {
		let a = oe(i.processorUrl ?? r.processor?.url()), [o] = await Promise.all([se(i.wasm ?? r.wasm()), A(n, a)]), s = /* @__PURE__ */ new Map();
		for (let [t, n] of Object.entries(r.params)) {
			let r = i.params?.[t];
			s.set(t, r === void 0 ? n.default : e(n, r));
		}
		let c = ne.for(n).claim(r.id);
		O(o).then((e) => {
			c.memoryBytes = e;
		});
		let l = K(r, n.sampleRate), u = /* @__PURE__ */ new Map();
		if (r.processor === void 0) for (let [e, t] of Object.entries(i.modulations ?? {})) Object.hasOwn(r.params, e) && t.routes.length > 0 && u.set(e, t);
		let d = i.bypass === !0 && r.processor === void 0, f = {
			module: o,
			deviceId: r.id,
			params: Object.entries(r.params).map(([e, t]) => [t.id, s.get(e) ?? t.default]),
			...u.size > 0 ? { modulations: [...u].map(([e, t]) => ({
				paramId: r.params[e].id,
				travel: G(r.params[e]),
				base: s.get(e) ?? r.params[e].default,
				modulation: t
			})) } : {},
			...c.slot ? { load: c.slot } : {},
			...l > 0 ? { latencySamples: l } : {},
			...d ? { bypassed: !0 } : {}
		}, p = r.processor?.name ?? "live-mix-wasm-device", m;
		try {
			m = (i.createNode ?? ie)(n, p, {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				channelCount: 2,
				channelCountMode: "explicit",
				channelInterpretation: "speakers",
				outputChannelCount: [2],
				processorOptions: f
			});
		} catch (e) {
			throw c.release(), e;
		}
		let h = new t(r, m, s, u, n, c);
		return d ? h.bypassed = !0 : i.bypass && (h.bypass = !0), h;
	}
	get input() {
		return this.node;
	}
	get output() {
		return this.node;
	}
	setParam(t, n) {
		let r = this.params[t];
		if (!r) throw Error(`live-mix: ${this.id} has no parameter "${t}"`);
		let i = e(r, n);
		this.values.set(t, i), this.post({
			type: "set-param",
			paramId: r.id,
			value: i
		}), this.changes.emit({
			type: "param",
			name: t,
			value: i
		});
	}
	getParam(e) {
		let t = this.params[e];
		if (!t) throw Error(`live-mix: ${this.id} has no parameter "${e}"`);
		return this.values.get(e) ?? t.default;
	}
	/**
	* Move a parameter on the audio thread, around the value it is set to;
	* null leaves it there. Only on the library's own processor (`modulates`).
	*/
	modulate(e, t) {
		let n = this.params[e];
		if (!n) throw Error(`live-mix: ${this.id} has no parameter "${e}"`);
		if (!this.modulates) throw Error(`live-mix: ${this.id} runs a processor of its own and takes no modulation`);
		let r = t !== null && t.routes.length > 0;
		!r && !this.modulations.has(e) || (r ? this.modulations.set(e, t) : this.modulations.delete(e), this.post({
			type: "modulate",
			paramId: n.id,
			travel: G(n),
			base: this.getParam(e),
			modulation: r ? t : null
		}), this.changes.emit({
			type: "modulation",
			name: e
		}));
	}
	/** What moves a parameter on the audio thread now; undefined for one that stands still. */
	modulationOf(e) {
		return this.modulations.get(e);
	}
	/**
	* The parameter's value at `timeSec` on the context's clock (now, left
	* out): where the audio thread has it, worked out from the same numbers.
	*/
	paramAt(e, t = this.context.currentTime) {
		let n = this.getParam(e), r = this.modulations.get(e);
		return r ? f(this.params[e], n, r, t) : n;
	}
	get bypass() {
		return this.bypassed;
	}
	set bypass(e) {
		this.bypassed !== e && (this.bypassed = e, this.post({
			type: "bypass",
			enabled: e
		}), this.changes.emit({
			type: "bypass",
			bypass: e
		}));
	}
	/** Called after every `setParam` and bypass change; returns the unsubscribe function. */
	onChange(e) {
		return this.changes.subscribe(e);
	}
	/** The latest reading of a meter; 0 until one has arrived (nothing arrives unless the meters are watched). */
	meter(e) {
		let t = this.meters[e];
		if (!t) throw Error(`live-mix: ${this.id} has no meter "${e}"`);
		return this.meterValues[t.id] ?? 0;
	}
	/**
	* Have the module report its meters (`DEVICE_METER_HZ` times a second) until
	* the returned function is called. Watches are counted, so several views
	* can watch one device; a device without meters ignores it.
	*/
	watchMeters() {
		let e = Object.keys(this.meters).length;
		if (e === 0 || this.disposed) return () => {};
		this.meterWatchers === 0 && (this.node.port.addEventListener("message", this.onPortMessage), this.node.port.start(), this.post({
			type: "meters",
			count: e,
			intervalFrames: this.meterIntervalFrames
		})), this.meterWatchers += 1;
		let t = !0;
		return () => {
			t && (t = !1, --this.meterWatchers, !(this.meterWatchers > 0 || this.disposed) && (this.node.port.removeEventListener("message", this.onPortMessage), this.post({
				type: "meters",
				count: 0,
				intervalFrames: this.meterIntervalFrames
			}), this.meterValues = []));
		};
	}
	onPortMessage = (e) => {
		e.data?.type === "meters" && (this.meterValues = e.data.values);
	};
	/** Note events for instrument modules (`device_note_on/off`); effects ignore them. */
	noteOn(e, t, n = .5) {
		this.post({
			type: "note-on",
			noteId: e,
			frequency: t,
			gain: n
		}), this.remember(e, t, n);
	}
	noteOff(e) {
		this.post({
			type: "note-off",
			noteId: e
		});
		let t = q();
		for (let n of this.played) n.id === e && n.offMs === null && (n.offMs = t);
	}
	/**
	* The notes this device was sent: the held ones, and the ones let go in the
	* last `PLAYED_KEPT_MS`, oldest first. For a display of what an instrument
	* plays (`NoteWatchDevice`); nothing of it reaches the sound.
	*/
	playedNotes() {
		return this.forget(q()), this.played;
	}
	remember(e, t, n) {
		let r = q();
		for (let t of this.played) t.id === e && t.offMs === null && (t.offMs = r);
		if (this.forget(r), this.played.length >= 128) {
			let e = this.played.findIndex((e) => e.offMs !== null);
			this.played.splice(Math.max(e, 0), 1);
		}
		this.played.push({
			id: e,
			frequency: t,
			gain: n,
			onMs: r,
			offMs: null
		});
	}
	forget(e) {
		let t = this.played, n = 0;
		for (let r of t) (r.offMs === null || e - r.offMs <= 6e4) && (t[n++] = r);
		t.length = n;
	}
	/**
	* Hand a sample device (granular synth, sampler) the sound it plays: one or
	* two channels of audio at `sampleRate`. The data is copied, so the caller's
	* buffers stay usable; frames beyond the device's capacity are dropped.
	* Devices that take no sample ignore it.
	*/
	loadSample(e, t) {
		if (e.length === 0) return;
		let n = e.slice(0, 2).map((e) => e.slice());
		this.disposed || (this.sampleSeconds = t > 0 ? n[0].length / t : null, this.node.port.postMessage({
			type: "sample",
			channels: n,
			sampleRate: t
		}, n.map((e) => e.buffer)));
	}
	/**
	* How long the sound this device was last handed is, in seconds; null until
	* it is handed one, while a sample device plays the sound it is built with,
	* and again once it is handed an instrument of zones.
	* For a display of where in the sound a note is read (`SampleWatchDevice`).
	*/
	loadedSampleSeconds() {
		return this.sampleSeconds;
	}
	/**
	* Hand a multi-sample instrument its zones and the sounds they play: a
	* zone map and a table of decoded audio keyed by the names the zones use
	* (docs/zone-sampler.md). The instrument is fitted to the device's sample memory
	* first (`planZoneLoad`): it loads whole, or not at all and the returned
	* plan says why, or with `overBudget: 'thin'` in part and the plan says
	* what was left out. The audio is copied, so the caller's buffers stay
	* usable and can be let go. A device that takes no zones refuses.
	*/
	loadZones(e, t, n = {}) {
		if (!this.zones) return {
			ok: !1,
			reason: `${this.id} takes no zones`,
			bytes: 0,
			budgetBytes: 0,
			missing: [],
			problems: []
		};
		let { plan: r, load: i } = pe(e, t, this.zones, n);
		if (!i || this.disposed) return r;
		this.sampleSeconds = null, this.post({ type: "zones-begin" });
		for (let e of i.samples) this.node.port.postMessage({
			type: "zone-sample",
			channels: e.channels,
			sampleRate: e.sampleRate
		}, e.channels.map((e) => e.buffer));
		return this.node.port.postMessage({
			type: "zones",
			fields: i.fields
		}, [i.fields.buffer]), r;
	}
	/** Send an app-specific message to a custom processor (see `processor` in the definition). */
	postMessage(e, t) {
		this.disposed || (t ? this.node.port.postMessage(e, t) : this.node.port.postMessage(e));
	}
	dispose() {
		this.disposed || (this.post({ type: "dispose" }), this.disposed = !0, this.load.release(), this.changes.clear(), this.meterWatchers > 0 && this.node.port.removeEventListener("message", this.onPortMessage), this.node.disconnect(), this.node.port.close());
	}
	post(e) {
		this.disposed || this.node.port.postMessage(e);
	}
};
//#endregion
//#region ../live-mix/src/dsp/descriptor.ts
/**
* Describe a WASM device for the registry. `registry.create(id, ctx, options)`
* hands `processorUrl`, `wasm` and `createNode` through to `WasmDevice.create`.
*/
function Y(e, t) {
	return {
		id: e.id,
		...t.formerIds ? { formerIds: t.formerIds } : {},
		definition: e,
		name: t.name,
		kind: "wasm",
		category: t.category,
		...t.description ? { description: t.description } : {},
		version: t.version ?? 1,
		params: e.params,
		...e.meters ? { meters: e.meters } : {},
		presets: t.presets,
		...t.formerPresets ? { formerPresets: t.formerPresets } : {},
		...t.retiredPresets ? { retiredPresets: t.retiredPresets } : {},
		...t.experimental ? { experimental: !0 } : {},
		create: (t, n) => J.create(t, e, n)
	};
}
const X = W({
	id: "thesis",
	wasm: () => new URL("./thesis.wasm", import.meta.url),
	params: {
		center: {
			id: 0,
			name: "Center Note",
			min: 48,
			max: 71,
			default: 62,
			taper: "linear",
			unit: "note",
			step: 1,
			description: "The note every chord is reflected around. Notes played far from it spread wide; notes near it draw the bands close together."
		},
		resonance: {
			id: 1,
			name: "Resonance",
			min: 5,
			max: 100,
			default: 40,
			taper: "log",
			unit: "",
			description: "How narrow the noise bands are. Low is breathy noise, high rings at a clear pitch. The upper part of the range adds nothing more."
		},
		width: {
			id: 2,
			name: "Width",
			min: 0,
			max: 100,
			default: 50,
			taper: "linear",
			unit: "%",
			description: "Stereo spread of the chord. It stays mono until the top quarter of the range, where it opens out. Below that only the level changes."
		},
		attack: {
			id: 3,
			name: "Attack",
			min: .01,
			max: 5,
			default: .5,
			taper: "log",
			unit: "s",
			description: "How long a note takes to swell to full level. Short speaks at once; long fades the chord in."
		},
		release: {
			id: 4,
			name: "Release",
			min: .1,
			max: 10,
			default: 2,
			taper: "log",
			unit: "s",
			description: "How long a note takes to fade out after the key is let go."
		},
		mode: {
			id: 5,
			name: "Mode",
			min: 0,
			max: 3,
			default: 1,
			taper: "linear",
			unit: "",
			choices: [
				"Fixed",
				"Breathe",
				"Drift",
				"Gravity"
			],
			description: "How the bands move as a note holds. Fixed is still, Breathe swells each in turn, Drift wobbles their pitch, Gravity pulls them up a fifth."
		},
		breatheRate: {
			id: 6,
			name: "Rate",
			min: .1,
			max: 2,
			default: .3,
			taper: "linear",
			unit: "Hz",
			description: "Speed of the swelling in Breathe and of the pitch wobble in Drift. Fixed ignores it."
		},
		strum: {
			id: 7,
			name: "Strum",
			min: 0,
			max: 100,
			default: 0,
			taper: "linear",
			unit: "ms",
			description: "Staggers the bands of each note so they enter one after another, like a strummed chord. At zero they all start together."
		},
		mirrorEnabled: {
			id: 8,
			name: "Mirror",
			min: 0,
			max: 1,
			default: 1,
			taper: "linear",
			unit: "",
			choices: ["Off", "On"],
			description: "Adds a band as far on the other side of the Center Note as the played note is from it, counted in scale steps."
		},
		octaflipEnabled: {
			id: 9,
			name: "Octaflip",
			min: 0,
			max: 1,
			default: 1,
			taper: "linear",
			unit: "",
			choices: ["Off", "On"],
			description: "Adds the played note moved an octave towards the Center Note: down if it is above the centre, up if it is below."
		},
		middleEnabled: {
			id: 10,
			name: "Middle",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			choices: ["Off", "On"],
			description: "Adds a band halfway between the played note and the Center Note, counted in scale steps."
		},
		mirrorMiddleEnabled: {
			id: 11,
			name: "Mirror Middle",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			choices: ["Off", "On"],
			description: "Adds the Middle band's reflection on the far side of the Center Note."
		},
		centerEnabled: {
			id: 12,
			name: "Center",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			choices: ["Off", "On"],
			description: "Adds the Center Note itself to every note played, so all chords share one common tone."
		},
		scale: {
			id: 13,
			name: "Scale",
			min: 0,
			max: 12,
			default: 0,
			taper: "linear",
			unit: "",
			choices: [
				"Major",
				"Natural Minor",
				"Harmonic Minor",
				"Melodic Minor",
				"Dorian",
				"Phrygian",
				"Lydian",
				"Mixolydian",
				"Locrian",
				"Pentatonic",
				"Blues",
				"Whole Tone",
				"Chromatic"
			],
			description: "The scale every band is tuned to. Played notes snap to it and the reflections are counted in its steps."
		},
		root: {
			id: 14,
			name: "Root",
			min: 0,
			max: 11,
			default: 0,
			taper: "linear",
			unit: "",
			choices: [
				"C",
				"C#",
				"D",
				"D#",
				"E",
				"F",
				"F#",
				"G",
				"G#",
				"A",
				"A#",
				"B"
			],
			description: "The key note the scale is built on."
		}
	}
});
Y(X, {
	name: "Thesis",
	category: "instrument",
	description: "Chord instrument of filtered noise: every note becomes up to six resonant bands, the played pitch plus its reflections around a centre note within a scale.",
	presets: {
		"Thesis Default": {
			center: 62,
			resonance: 40,
			width: 50,
			attack: .5,
			release: 2,
			mode: 1,
			breatheRate: .3,
			strum: 0,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 0,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 0,
			root: 0
		},
		"Glass Choir": {
			center: 64,
			resonance: 80,
			width: 80,
			attack: 1.5,
			release: 4,
			mode: 1,
			breatheRate: .15,
			strum: 0,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 0,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 0,
			root: 0
		},
		"Drifting Minor": {
			center: 60,
			resonance: 55,
			width: 60,
			attack: .8,
			release: 3,
			mode: 2,
			breatheRate: .25,
			strum: 10,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 0,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 1,
			root: 9
		},
		"Gravity Well": {
			center: 58,
			resonance: 30,
			width: 100,
			attack: .3,
			release: 5,
			mode: 3,
			breatheRate: .4,
			strum: 40,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 1,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 0,
			root: 0
		},
		"Strummed Lydian": {
			center: 62,
			resonance: 45,
			width: 60,
			attack: .05,
			release: 1.2,
			mode: 0,
			breatheRate: .3,
			strum: 80,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 1,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 6,
			root: 0
		},
		"Fixed Full Stack": {
			center: 62,
			resonance: 60,
			width: 70,
			attack: .4,
			release: 2.5,
			mode: 0,
			breatheRate: .3,
			strum: 20,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 1,
			mirrorMiddleEnabled: 1,
			centerEnabled: 1,
			scale: 0,
			root: 0
		},
		"Pentatonic Breath": {
			center: 62,
			resonance: 50,
			width: 50,
			attack: .2,
			release: 1.5,
			mode: 1,
			breatheRate: .6,
			strum: 0,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 0,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 9,
			root: 0
		},
		"Dark Phrygian": {
			center: 50,
			resonance: 25,
			width: 30,
			attack: 1,
			release: 6,
			mode: 2,
			breatheRate: .12,
			strum: 0,
			mirrorEnabled: 1,
			octaflipEnabled: 1,
			middleEnabled: 0,
			mirrorMiddleEnabled: 1,
			centerEnabled: 0,
			scale: 5,
			root: 4
		},
		"Sparse Mirror": {
			center: 62,
			resonance: 70,
			width: 40,
			attack: .4,
			release: 2.5,
			mode: 1,
			breatheRate: .2,
			strum: 0,
			mirrorEnabled: 1,
			octaflipEnabled: 0,
			middleEnabled: 0,
			mirrorMiddleEnabled: 0,
			centerEnabled: 0,
			scale: 0,
			root: 0
		},
		"Whole tone haze": {
			center: 60,
			resonance: 26,
			width: 100,
			attack: 2.5,
			release: 7,
			breatheRate: .45,
			octaflipEnabled: 0,
			middleEnabled: 1,
			scale: 11,
			mirrorEnabled: 0
		},
		"Blues strum": {
			center: 52,
			resonance: 50,
			width: 85,
			attack: .01,
			release: .7,
			mode: 0,
			strum: 60,
			scale: 10,
			root: 9,
			middleEnabled: 1
		},
		"Locrian shadow": {
			center: 48,
			resonance: 15,
			width: 72,
			attack: 3,
			release: 9,
			breatheRate: .1,
			mirrorMiddleEnabled: 1,
			scale: 8
		},
		"Mixolydian glow": {
			center: 67,
			resonance: 50,
			width: 94,
			attack: .8,
			release: 4,
			breatheRate: 1.2,
			middleEnabled: 1,
			centerEnabled: 1,
			scale: 7,
			root: 7
		},
		"Chromatic whistle": {
			resonance: 50,
			width: 100,
			attack: .15,
			release: 1.5,
			mode: 0,
			mirrorEnabled: 0,
			octaflipEnabled: 0,
			scale: 12
		},
		"Harmonic minor tide": {
			center: 65,
			resonance: 50,
			width: 60,
			attack: 1.8,
			release: 5,
			breatheRate: .14,
			octaflipEnabled: 0,
			mirrorMiddleEnabled: 1,
			scale: 2,
			root: 7
		},
		"Melodic minor lift": {
			center: 55,
			resonance: 50,
			width: 85,
			attack: 4,
			release: 6,
			mode: 3,
			middleEnabled: 1,
			scale: 3,
			root: 2
		}
	}
});
/** Chord instrument of filtered noise: every note becomes up to six resonant bands, the played pitch plus its reflections around a centre note within a scale. Play it through `NoteDevice`: `noteOn(id, frequency, gain)` / `noteOff(id)`. */
function he(e, t = {}) {
	return J.create(e, X, t);
}
const Z = W({
	id: "atmosphere",
	wasm: () => new URL("./atmosphere.wasm", import.meta.url),
	params: {
		type: {
			id: 0,
			name: "Type",
			min: 0,
			max: 5,
			default: 0,
			taper: "linear",
			unit: "",
			choices: [
				"Wind",
				"Rain",
				"Sea",
				"Fire",
				"Vinyl",
				"Hum"
			],
			description: "Which texture plays: gusting wind, rain drops over hiss, breaking sea waves, a crackling fire, vinyl surface noise or mains hum."
		},
		density: {
			id: 1,
			name: "Density",
			min: 0,
			max: 1,
			default: .4,
			taper: "linear",
			unit: "",
			description: "How busy the texture is: how often gusts, drops, waves, crackles or clicks arrive. For Hum it adds upper harmonics for more buzz."
		},
		movement: {
			id: 2,
			name: "Movement",
			min: 0,
			max: 1,
			default: .6,
			taper: "linear",
			unit: "",
			description: "How much the texture rises and falls over time, such as the depth of gusts and waves, the flicker of fire or the wobble of a record."
		},
		tone: {
			id: 3,
			name: "Tone",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "Colour of the texture, from dark and low to bright and airy. The key's pitch leans it as well: low keys are darker."
		},
		resonance: {
			id: 4,
			name: "Resonance",
			min: 0,
			max: 1,
			default: .15,
			taper: "linear",
			unit: "",
			description: "Adds a ringing tone at the pitch of the key. Wind narrows into a whistle on that note, and Hum thins towards a pure tone."
		},
		size: {
			id: 5,
			name: "Size",
			min: 0,
			max: 1,
			default: .3,
			taper: "linear",
			unit: "",
			description: "How far away the texture sounds. Higher settings are darker and more smeared, as if heard from across a room."
		},
		attack: {
			id: 6,
			name: "Attack",
			min: .01,
			max: 20,
			default: 2,
			taper: "log",
			unit: "s",
			description: "How long the texture takes to fade in when a key is pressed."
		},
		release: {
			id: 7,
			name: "Release",
			min: .05,
			max: 30,
			default: 4,
			taper: "log",
			unit: "s",
			description: "How long the texture takes to fade out after the key is released."
		},
		width: {
			id: 8,
			name: "Width",
			min: 0,
			max: 1,
			default: 1,
			taper: "linear",
			unit: "",
			description: "Stereo width of the texture. At full, left and right are independent; at zero it folds to mono."
		},
		volume: {
			id: 9,
			name: "Volume",
			min: -48,
			max: 6,
			default: -9,
			taper: "linear",
			unit: "dB",
			description: "Output level of the instrument. A soft clip after it rounds off the peaks when many notes stack up."
		}
	}
});
Y(Z, {
	name: "Atmosphere",
	category: "instrument",
	description: "Weather and room tone to play: wind, rain, sea, fire, vinyl and mains hum, synthesised live. Hold a key to open the texture; its pitch tunes whatever in it is pitched, and more keys layer.",
	presets: {
		"Hill wind": {
			type: 0,
			density: .4,
			movement: .6,
			tone: .5,
			resonance: .15,
			size: .3,
			attack: 2,
			release: 4,
			width: 1
		},
		"Whistling gap": {
			type: 0,
			density: .6,
			movement: .8,
			tone: .6,
			resonance: .85,
			size: .2,
			attack: 1,
			release: 3
		},
		"Rain on the window": {
			type: 1,
			density: .45,
			movement: .4,
			tone: .55,
			resonance: 0,
			size: .15,
			attack: 3,
			release: 5
		},
		"Distant downpour": {
			type: 1,
			density: .9,
			movement: .5,
			tone: .4,
			resonance: 0,
			size: .8,
			attack: 5,
			release: 8
		},
		"Slow shore": {
			type: 2,
			density: .3,
			movement: .9,
			tone: .5,
			resonance: 0,
			size: .4,
			attack: 4,
			release: 8
		},
		Hearth: {
			type: 3,
			density: .45,
			movement: .6,
			tone: .45,
			resonance: .1,
			size: .1,
			attack: 2,
			release: 4,
			width: .8
		},
		"Old record": {
			type: 4,
			density: .4,
			movement: .5,
			tone: .5,
			resonance: 0,
			size: 0,
			attack: .3,
			release: .5,
			width: .7
		},
		"Mains hum": {
			type: 5,
			density: .4,
			movement: .4,
			tone: .35,
			resonance: .2,
			size: .2,
			attack: 1,
			release: 2,
			width: .6
		},
		"Rain on tin": {
			type: 1,
			density: .7,
			movement: .5,
			tone: .3,
			resonance: .9,
			size: .2,
			attack: 1.5,
			release: 6,
			volume: -3
		},
		Breakers: {
			type: 2,
			density: 1,
			movement: 1,
			tone: .75,
			resonance: 0,
			size: .05,
			attack: .5,
			release: 6,
			volume: -13
		},
		"Sea in a shell": {
			type: 2,
			density: .6,
			movement: .2,
			tone: .3,
			resonance: .6,
			size: .55,
			attack: 3,
			release: 7,
			width: .5,
			volume: -15
		},
		"Glowing coals": {
			type: 3,
			density: .05,
			movement: .2,
			tone: .2,
			resonance: 0,
			size: .5,
			attack: 4,
			release: 9
		},
		Bonfire: {
			type: 3,
			density: .92,
			movement: 1,
			tone: .8,
			resonance: 0,
			size: 0,
			attack: 1,
			release: 3,
			volume: -10
		},
		"Dusty crackle": {
			type: 4,
			density: .85,
			movement: .15,
			tone: .8,
			resonance: 0,
			size: 0,
			attack: .8,
			release: 1.5,
			volume: -6
		},
		"Pure tone": {
			type: 5,
			density: 0,
			movement: .5,
			tone: .7,
			resonance: 1,
			size: 0,
			attack: 3,
			release: 9,
			volume: -19
		},
		"Hollow drone": {
			type: 5,
			density: .8,
			movement: .7,
			tone: .8,
			resonance: 0,
			size: .1,
			attack: 4,
			release: 8,
			volume: -19.5
		}
	}
});
/** Weather and room tone to play: wind, rain, sea, fire, vinyl and mains hum, synthesised live. Hold a key to open the texture; its pitch tunes whatever in it is pitched, and more keys layer. Play it through `NoteDevice`: `noteOn(id, frequency, gain)` / `noteOff(id)`. */
function ge(e, t = {}) {
	return J.create(e, Z, t);
}
const Q = W({
	id: "droplets",
	wasm: () => new URL("./droplets.wasm", import.meta.url),
	params: {
		rain: {
			id: 0,
			name: "Rain",
			min: .3,
			max: 24,
			default: 3,
			taper: "log",
			unit: "/s",
			description: "How many drops fall each second, shared among all the keys you hold. In a shower each drop is softer, so dense rain fills in without growing much louder."
		},
		material: {
			id: 1,
			name: "Material",
			min: 0,
			max: 4,
			default: 0,
			taper: "linear",
			unit: "",
			choices: [
				"Glass",
				"Wood",
				"Metal",
				"Water",
				"Felt"
			],
			description: "What the drops land on: a thin glass ping, a short wooden bar, long ringing bell metal, a bubble of water that rises to the note, or a muted felt thump."
		},
		loose: {
			id: 2,
			name: "Loose",
			min: 0,
			max: 1,
			default: .8,
			taper: "linear",
			unit: "",
			description: "Timing of the drops. At zero they are an even pulse that climbs the held keys in order; at full they come at random moments on random keys, as rain does."
		},
		size: {
			id: 3,
			name: "Size",
			min: 0,
			max: 1,
			default: .4,
			taper: "linear",
			unit: "",
			description: "How big a drop is. Small drops are bright, sharp and short; large ones are darker, slower to speak and ring longer."
		},
		spread: {
			id: 4,
			name: "Spread",
			min: 0,
			max: 3,
			default: 1,
			taper: "linear",
			unit: "oct",
			description: "How many octaves above each held key the drops range over. At zero every drop sounds at the pitch of its key."
		},
		ring: {
			id: 5,
			name: "Ring",
			min: .25,
			max: 4,
			default: 1,
			taper: "log",
			unit: "x",
			description: "How long each drop rings, against what its material does by itself. Low notes always ring longer than high ones."
		},
		soft: {
			id: 6,
			name: "Soft",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "How much the drops differ in loudness. At zero each is as loud as its key was played; higher, more of them fall softly and a little duller."
		},
		splash: {
			id: 7,
			name: "Splash",
			min: 0,
			max: 1,
			default: .3,
			taper: "linear",
			unit: "",
			description: "Level of the noise at the start of each drop: a tick on glass and metal, a knock on wood, a splash on water, a thud on felt."
		},
		bursts: {
			id: 8,
			name: "Bursts",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			description: "Gathers the drops into flurries with lulls between them. The number of drops over time stays the same."
		},
		trail: {
			id: 9,
			name: "Trail",
			min: 0,
			max: 20,
			default: 2,
			taper: "linear",
			unit: "s",
			description: "How long the rain goes on after the keys are let go, thinning and softening as it goes. At zero it stops with the keys and the last drops ring out."
		},
		width: {
			id: 10,
			name: "Width",
			min: 0,
			max: 1,
			default: .7,
			taper: "linear",
			unit: "",
			description: "How far the rain scatters left and right. Each drop keeps the place it fell in, and the drop a key makes as it goes down is always in the middle."
		},
		volume: {
			id: 11,
			name: "Volume",
			min: -48,
			max: 6,
			default: -10,
			taper: "linear",
			unit: "dB",
			description: "Output level of the instrument. A soft clip after it rounds off the peaks when many drops pile up."
		}
	}
});
Y(Q, {
	name: "Droplets",
	category: "instrument",
	description: "Tuned rain on the chord you hold: single drops fall on your notes onto glass, wood, metal, water or felt, from a slow drip to a shower, or as an even pulse.",
	presets: {
		"Glass rain": {
			rain: 3,
			material: 0,
			loose: .8,
			size: .4,
			spread: 1,
			ring: 1
		},
		"Slow drip": {
			rain: .7,
			loose: 1,
			size: .75,
			spread: 0,
			ring: 1.6,
			soft: .3,
			trail: 6
		},
		"Wood pulse": {
			rain: 6,
			material: 1,
			loose: 0,
			size: .5,
			ring: 1.3,
			soft: .2,
			trail: .5
		},
		"Metal shower": {
			rain: 12,
			material: 2,
			loose: 1,
			size: .15,
			spread: 2,
			ring: .5,
			soft: .8,
			splash: .2
		},
		"Water drops": {
			rain: 4,
			material: 3,
			loose: 1,
			size: .5,
			ring: 1.5,
			soft: .5,
			splash: .5,
			volume: -8.5
		},
		"Felt patter": {
			rain: 8,
			material: 4,
			loose: .9,
			size: .3,
			soft: .7,
			splash: .45,
			trail: 1,
			volume: -9
		},
		"Bell drizzle": {
			rain: 2,
			material: 2,
			loose: 1,
			size: .35,
			spread: 2,
			ring: 1.6,
			soft: .6,
			splash: .2,
			trail: 8
		},
		"Glass pulse": {
			rain: 4,
			loose: 0,
			size: .3,
			spread: 2,
			soft: .1,
			splash: .15,
			trail: 0
		},
		Flurries: {
			rain: 7,
			loose: .9,
			size: .2,
			spread: 2,
			ring: .7,
			soft: .7,
			bursts: .9,
			trail: 4
		},
		"Deep pool": {
			rain: 1.2,
			material: 3,
			loose: 1,
			size: 1,
			spread: 0,
			ring: 4,
			soft: .4,
			splash: .7,
			trail: 5
		},
		"Wood ticks": {
			rain: 18,
			material: 1,
			loose: 1,
			size: .05,
			spread: 2,
			ring: .8,
			soft: .5,
			splash: .7,
			width: 1,
			volume: -8
		},
		"Felt pulse": {
			rain: 3,
			material: 4,
			loose: 0,
			size: .75,
			spread: 0,
			ring: 2,
			soft: 0,
			splash: .2,
			trail: 0,
			width: .3
		},
		"High glitter": {
			rain: 10,
			loose: 1,
			size: 0,
			spread: 3,
			ring: .6,
			soft: .8,
			splash: .1,
			trail: 3,
			width: 1,
			volume: -8.5
		},
		"Tin roof": {
			rain: 18,
			material: 2,
			loose: 1,
			size: 0,
			spread: .5,
			ring: .25,
			soft: .7,
			splash: .9,
			bursts: .3
		},
		"Long chimes": {
			rain: .8,
			material: 2,
			loose: .6,
			size: .9,
			ring: 3,
			soft: .4,
			splash: 0,
			trail: 10
		},
		"Bubble stream": {
			rain: 20,
			material: 3,
			loose: 1,
			size: .15,
			spread: 2,
			ring: .6,
			soft: .5,
			splash: .35,
			bursts: .4,
			trail: 1,
			volume: -6.5
		}
	}
});
/** Tuned rain on the chord you hold: single drops fall on your notes onto glass, wood, metal, water or felt, from a slow drip to a shower, or as an even pulse. Play it through `NoteDevice`: `noteOn(id, frequency, gain)` / `noteOff(id)`. */
function _e(e, t = {}) {
	return J.create(e, Q, t);
}
const $ = W({
	id: "handpan",
	wasm: () => new URL("./handpan.wasm", import.meta.url),
	params: {
		type: {
			id: 0,
			name: "Type",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			choices: ["Handpan", "Tongue drum"],
			description: "Handpan is the hammered steel note with its octave and fifth ringing in it. Tongue drum is a plainer, purer tone with a faint high ping. Heard from the next note."
		},
		decay: {
			id: 1,
			name: "Decay",
			min: .5,
			max: 10,
			default: 3.5,
			taper: "log",
			unit: "s",
			description: "How long a note rings after the tap. The overtones die a little sooner than the note itself."
		},
		touch: {
			id: 2,
			name: "Touch",
			min: 0,
			max: 1,
			default: .3,
			taper: "linear",
			unit: "",
			description: "From the pad of a finger to a knuckle or soft mallet. A harder touch starts faster and brighter, and its overtones bloom just after the hit."
		},
		position: {
			id: 3,
			name: "Position",
			min: 0,
			max: 1,
			default: .45,
			taper: "linear",
			unit: "",
			description: "Where the hand lands on the note. The centre is nearly a pure tone; toward the edge the octave and the fifth above it come up."
		},
		shimmer: {
			id: 4,
			name: "Shimmer",
			min: 0,
			max: 1,
			default: .4,
			taper: "linear",
			unit: "",
			description: "How far the overtones sit from perfect tuning, a little differently on every key. More makes the colour of a ringing note turn slowly."
		},
		cavity: {
			id: 5,
			name: "Cavity",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "The low thump of the air inside the shell under every tap, like a soft drum beneath the note."
		},
		sympathy: {
			id: 6,
			name: "Sympathy",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "How much other ringing notes take up a new tap where their overtones match it, so chords glow. It does nothing while only one note sounds."
		},
		damp: {
			id: 7,
			name: "Damp",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			description: "How quickly a note is muted when the key is let go, like a hand laid on the steel. At zero notes ring out."
		},
		volume: {
			id: 8,
			name: "Volume",
			min: -48,
			max: 6,
			default: -6,
			taper: "linear",
			unit: "dB",
			description: "Output level of the instrument. A soft clip after it rounds off the peaks when many notes stack up."
		}
	}
});
Y($, {
	name: "Handpan",
	category: "instrument",
	description: "A hand-played steel pan and tongue drum: each note rings with its octave and the fifth above, over a low thump of air, and ringing notes answer each other. Most at home from D3 to C5.",
	presets: {
		"Soft hands": {
			type: 0,
			decay: 3.5,
			touch: .3,
			position: .45,
			shimmer: .4,
			cavity: .5,
			sympathy: .5,
			damp: 0
		},
		"Low ding": {
			decay: 6,
			touch: .35,
			position: .25,
			shimmer: .3,
			cavity: .9,
			sympathy: .4
		},
		Halo: {
			decay: 7,
			touch: .2,
			position: .5,
			shimmer: .85,
			cavity: .3,
			sympathy: 1
		},
		"Tongue drum": {
			type: 1,
			decay: 7,
			touch: .15,
			position: .2,
			shimmer: .25,
			cavity: .6
		},
		"Rain taps": {
			decay: 1.2,
			touch: .55,
			position: .85,
			cavity: .35,
			sympathy: .3,
			damp: .8
		},
		Knuckles: {
			decay: 2.8,
			touch: .9,
			position: .6,
			shimmer: .5,
			cavity: .6
		},
		"Bright tongue": {
			type: 1,
			decay: 4.5,
			touch: .75,
			position: .9,
			shimmer: 0,
			cavity: .2,
			sympathy: .3,
			volume: -4
		},
		"Slit drum": {
			type: 1,
			decay: .8,
			touch: .5,
			position: .35,
			shimmer: .1,
			cavity: 1,
			sympathy: .2,
			volume: -2.5
		},
		"Pure tongue": {
			type: 1,
			decay: 10,
			touch: 0,
			position: 0,
			shimmer: 0,
			cavity: 0,
			sympathy: 1,
			volume: -7
		},
		"Tank drum": {
			type: 1,
			decay: 6,
			touch: .35,
			position: .6,
			shimmer: .5,
			cavity: .9,
			sympathy: .8,
			damp: .3
		},
		"Edge overtones": {
			decay: 5,
			touch: .5,
			position: 1,
			shimmer: .6,
			cavity: .2,
			sympathy: .7,
			volume: -7.5
		},
		"Centre tone": {
			decay: 5,
			touch: .1,
			position: 0,
			shimmer: .1,
			cavity: .15,
			sympathy: .8
		},
		"Palm mute": {
			decay: 2,
			touch: .15,
			position: .2,
			shimmer: .2,
			cavity: .8,
			sympathy: .2,
			damp: 1,
			volume: -4
		},
		"Slow shimmer": {
			decay: 10,
			touch: .25,
			position: .75,
			shimmer: 1,
			cavity: .1,
			sympathy: .7,
			volume: -6.5
		},
		"Bright bloom": {
			decay: 5,
			touch: 1,
			position: .3,
			shimmer: .2,
			cavity: 0,
			sympathy: .2,
			volume: -7
		},
		"Clean steel": {
			decay: 2,
			touch: .45,
			position: .35,
			shimmer: 0,
			cavity: 0,
			sympathy: 0,
			volume: -3.5
		}
	}
});
/** A hand-played steel pan and tongue drum: each note rings with its octave and the fifth above, over a low thump of air, and ringing notes answer each other. Most at home from D3 to C5. Play it through `NoteDevice`: `noteOn(id, frequency, gain)` / `noteOff(id)`. */
function ve(e, t = {}) {
	return J.create(e, $, t);
}
const ye = W({
	id: "felt-piano",
	wasm: () => new URL("./felt-piano.wasm", import.meta.url),
	params: {
		felt: {
			id: 0,
			name: "Felt",
			min: 0,
			max: 1,
			default: .65,
			taper: "linear",
			unit: "",
			description: "Lowers a felt strip between hammers and strings. More is darker and softer, with less dynamic range and a shorter sustain."
		},
		hardness: {
			id: 1,
			name: "Hammer",
			min: 0,
			max: 1,
			default: .35,
			taper: "linear",
			unit: "",
			description: "How hard the hammers are. Soft hammers give a round, dark attack; hard ones are brighter and more percussive."
		},
		detune: {
			id: 2,
			name: "Detune",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "How far apart the strings of each note are tuned. Zero is pure and still; higher adds slow beating and chorus."
		},
		stiffness: {
			id: 3,
			name: "Stiffness",
			min: 0,
			max: 2,
			default: 1,
			taper: "linear",
			unit: "",
			description: "How stiff the strings are, which pulls the overtones sharp. Zero is perfectly harmonic; higher sounds more like a bell."
		},
		thump: {
			id: 4,
			name: "Thump",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "How much of the low knock of the hammer and the broadband splash of the strike is heard under each note."
		},
		action: {
			id: 5,
			name: "Action",
			min: 0,
			max: 1,
			default: .4,
			taper: "linear",
			unit: "",
			description: "Level of the key mechanism: the tick as a key goes down and the thud of the damper landing when a note ends."
		},
		pedalNoise: {
			id: 6,
			name: "Pedal noise",
			min: 0,
			max: 1,
			default: .4,
			taper: "linear",
			unit: "",
			description: "How loud the dampers are when the sustain pedal goes down or comes up. The noise also stirs the sympathetic strings."
		},
		grit: {
			id: 7,
			name: "Grit",
			min: 0,
			max: 1,
			default: .12,
			taper: "linear",
			unit: "",
			description: "Blends in a driven, saturated copy of the piano plus a little close-mic noise that follows the playing. Zero is clean."
		},
		resonance: {
			id: 8,
			name: "Resonance",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "How much the other strings ring in sympathy with what is played. Faint with the sustain pedal up, a long bloom with it down."
		},
		damper: {
			id: 9,
			name: "Damper",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "How fast the dampers stop a note when the key is let go. Low lets notes fade out slowly; high cuts them off quickly."
		},
		reverbMix: {
			id: 10,
			name: "Reverb",
			min: 0,
			max: 1,
			default: .25,
			taper: "linear",
			unit: "",
			description: "How much of the room is mixed in with the piano. Fully up is the room alone."
		},
		reverbSize: {
			id: 11,
			name: "Room",
			min: 0,
			max: 1,
			default: .3,
			taper: "linear",
			unit: "",
			description: "How long the room rings. Low is a short, close room; high is a long tail."
		},
		width: {
			id: 12,
			name: "Width",
			min: 0,
			max: 1,
			default: .5,
			taper: "linear",
			unit: "",
			description: "Stereo width of the piano before the room. Zero is mono, the middle is the natural spread and the top is extra wide."
		},
		outputDb: {
			id: 13,
			name: "Output",
			min: -24,
			max: 12,
			default: 0,
			taper: "linear",
			unit: "dB",
			description: "Overall level after the room. A soft limiter follows it and rounds off the peaks when pushed."
		},
		sustain: {
			id: 14,
			name: "Sustain",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			description: "Holds notes after the keys are let go and lets the other strings ring. Below halfway it only slows the dampers, as a half pedal."
		},
		sostenuto: {
			id: 15,
			name: "Sostenuto",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			description: "Holds only the notes that are sounding when it goes down. Notes played after that damp as usual."
		},
		soft: {
			id: 16,
			name: "Soft pedal",
			min: 0,
			max: 1,
			default: 0,
			taper: "linear",
			unit: "",
			description: "Una corda. Notes struck while it is down are quieter and a little darker."
		},
		polyphony: {
			id: 17,
			name: "Polyphony",
			min: 1,
			max: 32,
			default: 32,
			taper: "linear",
			unit: "voices",
			step: 1,
			description: "How many notes can sound at once. Lower saves processing; at the limit the quietest note gives way to the new one."
		}
	}
});
/**
* kkfonie's Felt: a physically modelled felt piano (per-note inharmonic modal
* banks, hammer contact-time model, velvet-noise mechanics, sympathetic
* strings, FDN room) as a `NoteDevice` for an `InstrumentTrack`. Up to 32
* voices; `polyphony` caps the pool for CPU. Marked experimental in the
* registry: see docs/devices.md for the measured cost.
*/
function be(e, t = {}) {
	return J.create(e, ye, t);
}
const xe = W({
	id: "plate-reverb",
	wasm: () => new URL("./plate-reverb.wasm", import.meta.url),
	params: {
		mix: {
			id: 0,
			name: "Mix",
			min: 0,
			max: 1,
			default: .35,
			taper: "linear",
			unit: "",
			description: "Balance between the dry signal and the plate. Fully up is the plate alone."
		},
		decay: {
			id: 1,
			name: "Decay",
			min: 0,
			max: 1,
			default: .7,
			taper: "linear",
			unit: "",
			description: "How much of the sound goes round the plate again on each pass. Low dies quickly; near the top the tail rings for a long time."
		},
		damping: {
			id: 2,
			name: "Damping",
			min: 0,
			max: 1,
			default: .3,
			taper: "linear",
			unit: "",
			description: "How quickly the highs die out of the tail. Low keeps the plate bright; high makes it dark and soft."
		},
		predelayMs: {
			id: 3,
			name: "Pre-delay",
			min: 0,
			max: 250,
			default: 20,
			taper: "linear",
			unit: "ms",
			description: "The gap before the plate answers, which keeps the start of the sound clear of its tail."
		}
	}
});
/**
* Stereo in → mono sum → plate → `dry·(1−mix) + wet·mix`, exactly the law
* ambient-live's engine applied. Insert it on a bus or the master.
*/
function Se(e, t = {}) {
	return J.create(e, xe, t);
}
//#endregion
export { ee as InstrumentTrack, g as ReturnTrack, ge as createAtmosphere, _e as createDroplets, be as createFeltPiano, ve as createHandpan, Se as createPlateReverb, he as createThesis };
