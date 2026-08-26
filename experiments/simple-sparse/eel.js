// Ribbon Eel - Pelagic Scavenger & Hydrodynamic Lifter with 9 Discrete Sizes & Spline Batching

// 9 Discrete Size Constants: 3 Small, 3 Medium, 3 Large
const EEL_SIZES = [
    20.0, 22.5, 25.0, // Small (S1, S2, S3)
    28.0, 31.0, 34.0, // Medium (M1, M2, M3)
    38.0, 42.0, 46.0  // Large (L1, L2, L3)
];

// Pre-computed 6 Discrete Emerald/Cyan/Teal/Slate Color Tiers
const EEL_COLOR_TIERS = [
    { fill: "#14b8a6", stroke: "#5eead4", dorsal: "#2dd4bf" }, // 0: Satiated Electric Teal
    { fill: "#0d9488", stroke: "#2dd4bf", dorsal: "#14b8a6" }, // 1: Vibrant Marine Cyan
    { fill: "#0891b2", stroke: "#38bdf8", dorsal: "#06b6d4" }, // 2: Deep Aqua
    { fill: "#0284c7", stroke: "#60a5fa", dorsal: "#38bdf8" }, // 3: Pelagic Azure
    { fill: "#475569", stroke: "#94a3b8", dorsal: "#64748b" }, // 4: Dusky Slate
    { fill: "#334155", stroke: "#64748b", dorsal: "#475569" }  // 5: Starving Shadow
];

class RibbonEel {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     * @param {SparseNetwork} [inheritedBrain] 
     * @param {number} [customSize]
     */
    constructor(x, y, bounds, inheritedBrain = null, customSize = null, stagnation = 0) {
        this.species = "Eel";
        this.x = x;
        this.y = y;
        this.bounds = bounds;
        this.name = uid("Eel");
        this.stagnation = stagnation || 0;

        // 9 Discrete Size Tier Selection (3 Small, 3 Medium, 3 Large)
        if (typeof customSize === "number") {
            let closestIdx = 0;
            let minDist = 999;
            for (let i = 0; i < EEL_SIZES.length; i++) {
                const d = Math.abs(EEL_SIZES[i] - customSize);
                if (d < minDist) {
                    minDist = d;
                    closestIdx = i;
                }
            }
            this.sizeIndex = closestIdx;
        } else {
            this.sizeIndex = Math.floor(Math.random() * EEL_SIZES.length);
        }

        this.size = EEL_SIZES[this.sizeIndex];
        this.sizeTier = this.sizeIndex < 3 ? "small" : (this.sizeIndex < 6 ? "medium" : "large");

        const sizeFactor = this.size / 30;
        this.maxSpeed = 125 + sizeFactor * 20;
        this.maxTurnSpeed = Math.PI * 2.1;

        this.angle = Math.random() * Math.PI * 2;
        this.vx = 0;
        this.vy = 0;

        // Serpentine S-curve Spine Segments
        this.numSegments = 7;
        this.segmentSpacing = this.size * 0.18;
        this.spine = [];
        for (let i = 0; i < this.numSegments; i++) {
            this.spine.push({ x: this.x - i * this.segmentSpacing, y: this.y });
        }

        // Lifecycle, Invulnerability & Scoring
        this.age = 0;
        this.foodEaten = 0;
        this.score = 0;
        this.dead = false;
        this.invulnerableTimer = 2.5;

        // Mouth Gulp State
        this.mouthOpen = false;

        // Highlight reel recording buffer
        this.recentInputBuffer = [];
        this.highlightClips = [];

        // Edge entry state
        this.enteringScreen = (x < 0 || x > bounds.w);
        this.entryDir = x < 0 ? 0 : Math.PI;

        // Think constraints
        this.acc = Math.random() * 0.15;
        this.accMax = 0.16;

        // Hunger & Metabolism
        this.hunger = 0.2;
        this.energyDrainRate = 0;

        // 9 Sensory Inputs: Carcass Angle, Carcass Dist, Jelly Angle, Jelly Dist, Pred Threat, Wall Dist, Hunger, Vert Velocity, Energy Drain
        this.inputs = new Array(9).fill(0);

        // 3 Outputs: Steer, Slither Thrust, Mouth Gulp
        this.outputs = [0.5, 0.5, 0.0];

        this._initBrain(inheritedBrain);
        this.think([], [], []);
    }

    _initBrain(inheritedBrain) {
        if (inheritedBrain) {
            this.brain = inheritedBrain.clone();
            this.brain.name = this.name;
            const temp = 1.0 + Math.min(2.5, this.stagnation * 0.04);
            this.brain.mutate(0.12 * temp, {
                strength: 0.25 * (1.0 + Math.min(1.5, this.stagnation * 0.03)),
                addConnectionRate: 0.04 * (1.0 + Math.min(2.0, this.stagnation * 0.03)),
                addNodeRate: 0.015 * (1.0 + Math.min(2.0, this.stagnation * 0.03))
            });
        } else {
            this.brain = new SparseNetwork({
                name: this.name,
                numInputs: this.inputs.length,
                numOutputs: this.outputs.length,
                initialHidden: 4,
                initialConnectivity: 0.5,
                maxComplexity: 5.5,
                inputLabels: [
                    "Carcass Angle", "Carcass Dist",
                    "Jelly Angle", "Jelly Dist",
                    "Pred Threat", "Wall Dist",
                    "Hunger", "Vert Velocity",
                    "Energy Drain"
                ],
                outputLabels: ["Steer", "Slither", "Gulp Mouth"]
            });
        }
    }

    onResize(canvas) {
        this.bounds = { w: canvas.width || canvas.w, h: canvas.height || canvas.h };
    }

    _captureHighlight() {
        if (this.recentInputBuffer.length >= 10) {
            const clip = this.recentInputBuffer.slice(-20);
            this.highlightClips.push(clip);
            if (this.highlightClips.length > 3) {
                this.highlightClips.shift();
            }
        }
    }

    /**
     * @param {Array<Carcass>} carcasses 
     * @param {Array<Jellyfish>} jellies 
     * @param {Array<PredatorFish>} predators 
     */
    think(carcasses = [], jellies = [], predators = []) {
        const maxDetectDist = Math.hypot(this.bounds.w, this.bounds.h) * 0.45;
        const maxDetectDistSq = maxDetectDist * maxDetectDist;

        // 1. Sinking Carcass Sensing via distSq
        let nearestC = null, minCDistSq = maxDetectDistSq;
        for (let i = 0; i < carcasses.length; i++) {
            const c = carcasses[i];
            if (c.state !== "sinking") continue;
            const dx = c.x - this.x;
            const dy = c.y - this.y;
            if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minCDistSq) { minCDistSq = dSq; nearestC = c; }
        }

        if (nearestC) {
            const minCDist = Math.sqrt(minCDistSq);
            let diff = Math.atan2(nearestC.y - this.y, nearestC.x - this.x) - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.inputs[0] = diff / Math.PI;
            this.inputs[1] = clamp(1 - (minCDist / maxDetectDist), 0, 1);
        } else {
            this.inputs[0] = 0; this.inputs[1] = 0;
        }

        // 2. Jellyfish Slipstream Proximity Sensing via distSq
        let nearestJ = null, minJDistSq = 200 * 200;
        for (let i = 0; i < jellies.length; i++) {
            const j = jellies[i];
            if (j.dead) continue;
            const dx = j.x - this.x;
            const dy = j.y - this.y;
            if (Math.abs(dx) > 200 || Math.abs(dy) > 200) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minJDistSq) { minJDistSq = dSq; nearestJ = j; }
        }

        if (nearestJ) {
            const minJDist = Math.sqrt(minJDistSq);
            let diff = Math.atan2(nearestJ.y - this.y, nearestJ.x - this.x) - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.inputs[2] = diff / Math.PI;
            this.inputs[3] = clamp(1 - (minJDist / 200), 0, 1);
        } else {
            this.inputs[2] = 0; this.inputs[3] = 0;
        }

        // 3. Predator Threat via distSq
        let maxPThreat = 0;
        const threatRadius = 160;
        const threatRadiusSq = threatRadius * threatRadius;
        for (let i = 0; i < predators.length; i++) {
            const p = predators[i];
            if (p.dead) continue;
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            if (Math.abs(dx) > threatRadius || Math.abs(dy) > threatRadius) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < threatRadiusSq) {
                const t = (1 - (Math.sqrt(dSq) / threatRadius)) * (p.size / 30);
                if (t > maxPThreat) maxPThreat = t;
            }
        }
        this.inputs[4] = clamp(maxPThreat, 0, 1);

        // 4. Wall Distance
        const distToEdge = Math.min(this.x, this.bounds.w - this.x, this.y, this.bounds.h - this.y);
        this.inputs[5] = clamp(1 - (distToEdge / 80), 0, 1);

        // 5. Hunger
        this.inputs[6] = clamp(this.hunger, 0, 1);

        // 6. Vertical Velocity
        this.inputs[7] = clamp(this.vy / 100, -1, 1);

        // 7. Overall Energy Drain Input (1.0 when outputs are fully firing)
        const [steer, slither, gulp] = this.outputs;
        const steerExertion = Math.abs(steer - 0.5) * 2;
        this.energyDrainRate = clamp(slither * 0.7 + steerExertion * 0.2 + (gulp > 0.5 ? 0.1 : 0), 0, 1);
        this.inputs[8] = this.energyDrainRate;

        // Record rolling buffer
        this.recentInputBuffer.push(Float32Array.from(this.inputs));
        if (this.recentInputBuffer.length > 25) this.recentInputBuffer.shift();

        this.outputs = this.brain.activate(this.inputs);
    }

    performScheduledThink(carcasses = [], jellies = [], predators = []) {
        this.needsThink = false;
        this.think(carcasses, jellies, predators);
    }

    /**
     * @param {number} dt 
     * @param {Array<Carcass>} carcasses 
     * @param {Array<Jellyfish>} jellies 
     * @param {Array<PredatorFish>} predators 
     */
    act(dt, carcasses = [], jellies = [], predators = []) {
        if (this.dead) return;

        this.age += dt;
        this.score = (this.foodEaten * 120) + Math.floor(this.age);
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        // Size factor (Range ~0.7 to 1.35)
        const sizeFactor = this.size / 28;

        // Progressive Age Progression: Elders slow down slightly (-20%) but burn 25% less hunger!
        const ageFactor = clamp(this.age / 130, 0, 1);
        const ageMetabolicMultiplier = 1.0 - (ageFactor * 0.25);
        const ageSpeedMultiplier = 1.0 - (ageFactor * 0.20);

        // Dynamic Metabolism: Reduced hunger when idling, higher when actively slithering/turning
        const [steer, slither, gulp] = this.outputs;
        const steerExertion = Math.abs(steer - 0.5) * 2;
        const baseIdleBurn = 0.008;
        const activeOutputBurn = (slither * 0.022 + steerExertion * 0.008 + (gulp > 0.5 ? 0.004 : 0)) * sizeFactor;
        this.hunger += (baseIdleBurn + activeOutputBurn) * ageMetabolicMultiplier * dt;

        if (this.hunger >= 1.0) {
            this.dead = true;
            return;
        }

        // Edge entry
        if (this.enteringScreen) {
            this.x += Math.cos(this.entryDir) * 65 * dt;
            if (this.x > 25 && this.x < this.bounds.w - 25) {
                this.enteringScreen = false;
            }
            return;
        }

        // Think step (Enqueues into FIFO thinkQueue or sets needsThink)
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            if (typeof thinkQueue !== "undefined" && !this.inThinkQueue) {
                this.inThinkQueue = true;
                thinkQueue.push(this);
            } else {
                this.needsThink = true;
            }
        }

        this.mouthOpen = gulp > 0.5;

        // --- Approximate Interleaved Interaction Physics (30 Hz Sub-rate) ---
        this.frameTick = (this.frameTick || 0) + 1;
        const doInteractions = (this.frameTick % 2) === 0;

        // Catch sinking falling carcasses (consumes at most 1 item per interaction tick)
        if (doInteractions && this.mouthOpen) {
            const mouthRadius = this.size * 0.42;
            for (let i = 0; i < carcasses.length; i++) {
                const c = carcasses[i];
                if (c.state === "sinking") {
                    const maxR = mouthRadius + c.radius;
                    const dx = c.x - this.x;
                    const dy = c.y - this.y;
                    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                    if (dx * dx + dy * dy < maxR * maxR) {
                        c.state = "dead";
                        this.foodEaten++;
                        this.hunger = Math.max(0, this.hunger - 0.52);
                        this._captureHighlight();
                        break;
                    }
                }
            }
        }

        // Turning
        const turnIntensity = this.maxTurnSpeed * (1.0 - ageFactor * 0.15) * dt;
        if (steer < 0.4) {
            this.angle -= turnIntensity * ((0.4 - steer) / 0.4);
        } else if (steer > 0.6) {
            this.angle += turnIntensity * ((steer - 0.6) / 0.4);
        }

        if (this.angle < 0) this.angle += Math.PI * 2;
        if (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;

        // Forward slithering motion
        if (slither > 0.05) {
            const speed = slither * this.maxSpeed * ageSpeedMultiplier;
            this.vx = Math.cos(this.angle) * speed;
            this.vy = Math.sin(this.angle) * speed;

            this.x += this.vx * dt;
            this.y += this.vy * dt;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        const half = this.size * 0.35;
        this.x = clamp(this.x, half, this.bounds.w - half);
        this.y = clamp(this.y, half, this.bounds.h - half);

        // Update Serpentine S-Curve Spine Segments
        this.spine[0] = { x: this.x, y: this.y };
        const sinA = Math.sin(this.angle);
        const cosA = Math.cos(this.angle);

        for (let i = 1; i < this.numSegments; i++) {
            const prev = this.spine[i - 1];
            const curr = this.spine[i];
            const dx = prev.x - curr.x;
            const dy = prev.y - curr.y;
            const dSq = dx * dx + dy * dy;
            const invD = dSq > 0.0001 ? this.segmentSpacing / Math.sqrt(dSq) : 0;
            
            // Constrain distance between segments
            curr.x = prev.x - dx * invD;
            curr.y = prev.y - dy * invD;

            // Add S-curve lateral wave undulation
            const waveOffset = Math.sin(this.age * 10 - i * 0.8) * (this.size * 0.07) * (i / this.numSegments);
            curr.x += -sinA * waveOffset;
            curr.y += cosA * waveOffset;
        }

        // Apply Hydrodynamic Fluid Slipstream onto Nearby Jellyfish (Only when moving)
        if (Math.abs(this.vx) > 5 || Math.abs(this.vy) > 5) {
            const draftRadius = 75 + this.size * 1.6;
            const draftRadiusSq = draftRadius * draftRadius;
            const draftStrength = 0.40 * Math.pow(sizeFactor, 1.4);
            for (let i = 0; i < jellies.length; i++) {
                const j = jellies[i];
                if (j.dead) continue;
                const dx = j.x - this.x;
                const dy = j.y - this.y;
                if (Math.abs(dx) > draftRadius || Math.abs(dy) > draftRadius) continue;
                const dSq = dx * dx + dy * dy;
                if (dSq < draftRadiusSq) {
                    const d = Math.sqrt(dSq);
                    const draftFactor = (1 - (d / draftRadius)) * draftStrength;
                    j.applyCurrent(this.vx * draftFactor, (this.vy - 16 * sizeFactor) * draftFactor, dt);
                }
            }
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.dead) return;

        ctx.save();

        // 6 Discrete Skin Color Tiers
        const hungerTier = Math.min(5, Math.max(0, Math.floor(this.hunger * 6)));
        const style = EEL_COLOR_TIERS[hungerTier];

        // Invulnerability Shield Shimmer (Solid Cyan)
        if (this.invulnerableTimer > 0) {
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.45, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 1. Draw Trailing Serpentine Ribbon Body as Continuous Tapered Strip
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Main body spine stroke
        ctx.strokeStyle = style.fill;
        for (let i = this.numSegments - 1; i >= 1; i--) {
            const p1 = this.spine[i];
            const p0 = this.spine[i - 1];
            const segW = (this.size * 0.56) * (1.0 - (i / this.numSegments) * 0.65);

            ctx.lineWidth = segW;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }

        // 1 Continuous Dorsal Crest Polyline Pass
        ctx.strokeStyle = style.dorsal;
        ctx.lineWidth = Math.max(1.0, this.size * 0.12);
        ctx.beginPath();
        ctx.moveTo(this.spine[0].x, this.spine[0].y);
        for (let i = 1; i < this.numSegments; i++) {
            ctx.lineTo(this.spine[i].x, this.spine[i].y);
        }
        ctx.stroke();

        // 2. Draw Head
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const headR = this.size * 0.28;
        ctx.fillStyle = style.fill;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 1.1;

        ctx.beginPath();
        ctx.ellipse(0, 0, headR * 1.2, headR * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Gaping Mouth Animation
        if (this.mouthOpen) {
            ctx.fillStyle = "#0a141e";
            ctx.beginPath();
            ctx.ellipse(headR * 0.9, 0, headR * 0.45, headR * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Expressive Eyes
        const eyeR = Math.max(1.8, headR * 0.3);
        const eyeX = headR * 0.35;
        const eyeY = headR * 0.45;

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(eyeX, -eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0a141e";
        ctx.beginPath();
        ctx.arc(eyeX + eyeR * 0.3, -eyeY, eyeR * 0.55, 0, Math.PI * 2);
        ctx.arc(eyeX + eyeR * 0.3, eyeY, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
