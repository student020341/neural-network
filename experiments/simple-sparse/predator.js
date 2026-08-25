// Predator - Big-Circle Gulper / Abyssal Hunter with 9 Discrete Sizes & Quantized Rendering

// 9 Discrete Size Constants: 3 Small, 3 Medium, 3 Large
const PREDATOR_SIZES = [
    26.0, 29.0, 32.0, // Small (S1, S2, S3)
    36.0, 39.0, 42.0, // Medium (M1, M2, M3)
    46.0, 50.0, 54.0  // Large/Apex (L1, L2, L3)
];

// Pre-computed 6 Discrete Hunter Color Tiers
const PREDATOR_COLOR_TIERS = [
    { fill: "#1e70bf", stroke: "#58a6ff", fin: "#155390" }, // 0: Satiated Deep Azure
    { fill: "#2563eb", stroke: "#60a5fa", fin: "#1d4ed8" }, // 1: Hungry Marine Blue
    { fill: "#4f46e5", stroke: "#818cf8", fin: "#3730a3" }, // 2: Indigo Hunter
    { fill: "#7c3aed", stroke: "#a78bfa", fin: "#5b21b6" }, // 3: Violet Apex
    { fill: "#9333ea", stroke: "#c084fc", fin: "#6b21a8" }, // 4: Royal Purple
    { fill: "#c026d3", stroke: "#e879f9", fin: "#86198f" }  // 5: Starving Frenzy Magenta
];

class PredatorFish {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     * @param {SparseNetwork} [inheritedBrain] 
     * @param {number} [customSize]
     */
    constructor(x, y, bounds, inheritedBrain = null, customSize = null, stagnation = 0) {
        this.species = "Predator";
        this.x = x;
        this.y = y;
        this.bounds = bounds;
        this.name = uid("Predator");
        this.stagnation = stagnation || 0;

        // 9 Discrete Size Tier Selection (3 Small, 3 Medium, 3 Large)
        if (typeof customSize === "number") {
            let closestIdx = 0;
            let minDist = 999;
            for (let i = 0; i < PREDATOR_SIZES.length; i++) {
                const d = Math.abs(PREDATOR_SIZES[i] - customSize);
                if (d < minDist) {
                    minDist = d;
                    closestIdx = i;
                }
            }
            this.sizeIndex = closestIdx;
        } else {
            this.sizeIndex = Math.floor(Math.random() * PREDATOR_SIZES.length);
        }

        this.size = PREDATOR_SIZES[this.sizeIndex];
        this.radius = this.size / 2;
        this.sizeTier = this.sizeIndex < 3 ? "small" : (this.sizeIndex < 6 ? "medium" : "large");

        const sizeFactor = this.size / 38;
        this.maxSpeed = 115 + sizeFactor * 20;
        this.maxTurnSpeed = (Math.PI * 1.8) - Math.min(Math.PI * 0.8, sizeFactor * 0.4);
        this.sinkGravity = 26 + sizeFactor * 5;

        this.angle = Math.random() * Math.PI * 2;
        this.vx = 0;
        this.vy = 0;

        // Lifecycle, Invulnerability & Scoring
        this.age = 0;
        this.foodEaten = 0; // Kills
        this.score = 0;
        this.dead = false;
        this.exploded = false;
        this.invulnerableTimer = 2.5;

        // Gluttony / Bloat Meter (0 to 1) - fills when eating while > 70% full (hunger < 0.30)
        this.gluttony = 0;

        // Gaping Gulper Mouth State
        this.mouthOpen = false;
        this.mouthAperture = 0; // 0 (closed) to 1 (fully unhinged)
        this.swallowCooldown = 0;
        this.energyDrainRate = 0;

        // Highlight reel recording buffer
        this.recentInputBuffer = [];
        this.highlightClips = [];

        // Edge entry state
        this.enteringScreen = (x < 0 || x > bounds.w);
        this.entryDir = x < 0 ? 0 : Math.PI;

        // Think constraints
        this.acc = Math.random() * 0.16;
        this.accMax = 0.16;

        // Hunger & Metabolism
        this.hunger = 0.25;

        // Target references
        this.nearestPrey = null;
        this.nearestJelly = null;

        // 9 Sensory Inputs:
        // 0: Prey Angle, 1: Prey Dist
        // 2: Jelly Angle, 3: Jelly Dist
        // 4: Vert Velocity, 5: Depth Dist
        // 6: Hunger, 7: Bloat, 8: Energy Drain
        this.inputs = new Array(9).fill(0);

        // 4 Outputs: Steer, Forward Thrust, Swim Up Lift, Gape/Chomp Mouth
        this.outputs = [0.5, 0.5, 0.5, 0.0];

        this._initBrain(inheritedBrain);
        this.think([], [], [], []);
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
                initialHidden: 5,
                initialConnectivity: 0.55,
                maxComplexity: 5.5,
                inputLabels: [
                    "Prey Angle", "Prey Dist",
                    "Jelly Angle", "Jelly Dist",
                    "Vert Velocity", "Depth Dist",
                    "Hunger", "Bloat", "Energy Drain"
                ],
                outputLabels: ["Steer", "Thrust", "Swim Up", "Gape Jaws"]
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
     * @param {Array<TurnFish>} turnFishes 
     * @param {Array<Crab>} crabs 
     * @param {Array<Jellyfish>} jellies 
     * @param {Array<PredatorFish>} predators 
     */
    think(turnFishes = [], crabs = [], jellies = [], predators = []) {
        const maxDetectDist = Math.hypot(this.bounds.w, this.bounds.h) * 0.5;
        const maxDetectDistSq = maxDetectDist * maxDetectDist;

        // 1. Prey Detection via distSq
        let nearestP = null, minPDistSq = maxDetectDistSq;

        for (let i = 0; i < turnFishes.length; i++) {
            const f = turnFishes[i];
            if (f.dead || f.invulnerableTimer > 0) continue;
            const dx = f.x - this.x;
            const dy = f.y - this.y;
            if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minPDistSq) { minPDistSq = dSq; nearestP = f; }
        }

        for (let i = 0; i < crabs.length; i++) {
            const c = crabs[i];
            if (c.dead || c.invulnerableTimer > 0) continue;
            const dx = c.x - this.x;
            const dy = c.y - this.y;
            if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
            const dSq = dx * dx + dy * dy;
            const effectiveDSq = c.isAirborne ? dSq * 0.49 : dSq;
            if (effectiveDSq < minPDistSq) { minPDistSq = effectiveDSq; nearestP = c; }
        }

        for (let i = 0; i < predators.length; i++) {
            const p = predators[i];
            if (p === this || p.dead || p.invulnerableTimer > 0) continue;
            if (this.size > p.size * 1.3) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
                const dSq = dx * dx + dy * dy;
                if (dSq < minPDistSq) { minPDistSq = dSq; nearestP = p; }
            }
        }

        // Detect vulnerable tossed jellyfish as prime prey!
        for (let i = 0; i < jellies.length; i++) {
            const j = jellies[i];
            if (j.dead || j.invulnerableTimer > 0 || j.tossedTimer <= 0) continue;
            const dx = j.x - this.x;
            const dy = j.y - this.y;
            if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minPDistSq) { minPDistSq = dSq; nearestP = j; }
        }

        this.nearestPrey = nearestP;
        if (nearestP) {
            const minPDist = Math.sqrt(minPDistSq);
            let diff = Math.atan2(nearestP.y - this.y, nearestP.x - this.x) - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.inputs[0] = diff / Math.PI;
            this.inputs[1] = clamp(1 - (minPDist / maxDetectDist), 0, 1);
        } else {
            this.inputs[0] = 0; this.inputs[1] = 0;
        }

        // 2. Jellyfish Hazard Detection (Only hazardous if NOT tossed!)
        let nearestJ = null, minJDistSq = 220 * 220;
        for (let i = 0; i < jellies.length; i++) {
            const j = jellies[i];
            if (j.dead || j.tossedTimer > 0) continue;
            const dx = j.x - this.x;
            const dy = j.y - this.y;
            if (Math.abs(dx) > 220 || Math.abs(dy) > 220) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minJDistSq) { minJDistSq = dSq; nearestJ = j; }
        }
        this.nearestJelly = nearestJ;

        if (nearestJ) {
            const minJDist = Math.sqrt(minJDistSq);
            let diff = Math.atan2(nearestJ.y - this.y, nearestJ.x - this.x) - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.inputs[2] = diff / Math.PI;
            this.inputs[3] = clamp(1 - (minJDist / 220), 0, 1);
        } else {
            this.inputs[2] = 0; this.inputs[3] = 0;
        }

        // 3. Vertical Velocity
        this.inputs[4] = clamp(this.vy / 100, -1, 1);

        // 4. Floor Proximity
        this.inputs[5] = clamp((this.bounds.h - this.y) / this.bounds.h, 0, 1);

        // 5. Hunger
        this.inputs[6] = clamp(this.hunger, 0, 1);

        // 6. Gluttony Bloat Meter Awareness
        this.inputs[7] = clamp(this.gluttony, 0, 1);

        // 7. Overall Energy Drain Input (1.0 when thrust, lift, turn, and gape are all active)
        const [steer, thrust, swimUp, gape] = this.outputs;
        const steerExertion = Math.abs(steer - 0.5) * 2;
        this.energyDrainRate = clamp(thrust * 0.45 + swimUp * 0.3 + steerExertion * 0.15 + (gape > 0.5 ? 0.1 : 0), 0, 1);
        this.inputs[8] = this.energyDrainRate;

        // Record rolling buffer
        this.recentInputBuffer.push(Float32Array.from(this.inputs));
        if (this.recentInputBuffer.length > 25) this.recentInputBuffer.shift();

        this.outputs = this.brain.activate(this.inputs);
    }

    performScheduledThink(turnFishes = [], crabs = [], jellies = [], predators = []) {
        this.needsThink = false;
        this.think(turnFishes, crabs, jellies, predators);
    }

    /**
     * @param {number} dt 
     * @param {Array<TurnFish>} turnFishes 
     * @param {Array<Crab>} crabs 
     * @param {Array<Jellyfish>} jellies 
     * @param {Array<PredatorFish>} predators 
     * @param {Function} [onKillCallback]
     * @param {Function} [onExplodeCallback]
     */
    act(dt, turnFishes = [], crabs = [], jellies = [], predators = [], onKillCallback = null, onExplodeCallback = null) {
        if (this.dead) return;

        this.age += dt;
        this.score = (this.foodEaten * 150) + Math.floor(this.age);
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        const sizeFactor = this.size / 35;
        const [steer, thrust, swimUp, gape] = this.outputs;
        const steerExertion = Math.abs(steer - 0.5) * 2;

        // Progressive Age Progression: Elders slow down slightly (-25%) but burn 30% less basal hunger!
        const ageFactor = clamp(this.age / 140, 0, 1);
        const ageMetabolicMultiplier = 1.0 - (ageFactor * 0.30);
        const ageSpeedMultiplier = 1.0 - (ageFactor * 0.25);
        const ageTurnMultiplier = 1.0 - (ageFactor * 0.20);

        // Dynamic Metabolism: Low base idle burn + active output energy drain (scaled by age)
        const baseIdleBurn = 0.014;
        const activeOutputBurn = (thrust * 0.024 + swimUp * 0.026 + steerExertion * 0.008 + (gape > 0.5 ? 0.006 : 0)) * sizeFactor;
        this.hunger += (baseIdleBurn + activeOutputBurn) * ageMetabolicMultiplier * dt;

        if (this.hunger >= 1.0) {
            this.dead = true;
            return;
        }

        // Digest / slowly dissipate gluttony bloat over time
        if (this.gluttony > 0) {
            this.gluttony = Math.max(0, this.gluttony - 0.035 * dt);
        }

        // Edge entry
        if (this.enteringScreen) {
            this.x += Math.cos(this.entryDir) * 70 * dt;
            if (this.x > 30 && this.x < this.bounds.w - 30) {
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

        this.mouthOpen = gape > 0.5;

        // Smoothly animate mouth aperture unhinging (60 FPS)
        const targetAperture = this.mouthOpen ? 1.0 : 0.0;
        this.mouthAperture += (targetAperture - this.mouthAperture) * Math.min(1.0, dt * 14);

        // --- Approximate Interleaved Interaction Physics (30 Hz Sub-rate) ---
        this.frameTick = (this.frameTick || 0) + 1;
        const doInteractions = (this.frameTick % 2) === 0;

        // 1. Jellyfish Hazard: Predator is ONLY harmed if mouth is open during contact with an UNTOSSED jellyfish!
        const mouthRadius = this.radius * (1.0 + this.mouthAperture * 0.25);
        if (doInteractions && this.invulnerableTimer <= 0 && this.mouthOpen) {
            for (let i = 0; i < jellies.length; i++) {
                const j = jellies[i];
                if (!j.dead && j.tossedTimer <= 0) {
                    const maxR = mouthRadius + j.radius;
                    const dx = j.x - this.x;
                    const dy = j.y - this.y;
                    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                    if (dx * dx + dy * dy < maxR * maxR) {
                        this.dead = true;
                        return;
                    }
                }
            }
        }

        // Swallow digestion cooldown
        if (this.swallowCooldown === undefined) this.swallowCooldown = 0;
        if (this.swallowCooldown > 0) this.swallowCooldown -= dt;

        // 2. Hunting Prey: Predator can ONLY eat if mouth is open and not on swallow cooldown!
        if (doInteractions && this.mouthOpen && this.swallowCooldown <= 0) {
            let ate = false;

            // Helper to apply food & check gluttony overload
            const onEat = (killCountGain, hungerRecover, bloatAmount, preyEntity) => {
                if (this.hunger < 0.30) {
                    this.gluttony += bloatAmount;
                }

                this.foodEaten += killCountGain;
                this.hunger = Math.max(0, this.hunger - hungerRecover);
                this.swallowCooldown = 0.28; // Small cooldown to digest single item
                this._captureHighlight();

                if (typeof onKillCallback === "function") onKillCallback(this, preyEntity);

                // Overeating Gluttony Explosion Check!
                if (this.gluttony >= 1.0) {
                    this.dead = true;
                    this.exploded = true;
                    if (typeof onExplodeCallback === "function") {
                        onExplodeCallback(this);
                    }
                }
            };

            for (let i = 0; i < turnFishes.length; i++) {
                const f = turnFishes[i];
                if (!f.dead && f.invulnerableTimer <= 0) {
                    const maxR = mouthRadius + f.size * 0.4;
                    const dx = f.x - this.x;
                    const dy = f.y - this.y;
                    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                    if (dx * dx + dy * dy < maxR * maxR) {
                        f.dead = true;
                        onEat(1, 0.55, 0.38, f);
                        ate = true;
                        break;
                    }
                }
            }

            if (!ate && !this.dead) {
                for (let i = 0; i < crabs.length; i++) {
                    const c = crabs[i];
                    if (!c.dead && c.invulnerableTimer <= 0) {
                        const maxR = mouthRadius + c.radius;
                        const dx = c.x - this.x;
                        const dy = c.y - this.y;
                        if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                        if (dx * dx + dy * dy < maxR * maxR) {
                            c.die();
                            onEat(1, 0.55, 0.38, c);
                            ate = true;
                            break;
                        }
                    }
                }
            }

            if (!ate && !this.dead) {
                for (let i = 0; i < predators.length; i++) {
                    const p = predators[i];
                    if (p !== this && !p.dead && p.invulnerableTimer <= 0 && this.size > p.size * 1.3) {
                        const maxR = mouthRadius + p.size * 0.4;
                        const dx = p.x - this.x;
                        const dy = p.y - this.y;
                        if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                        if (dx * dx + dy * dy < maxR * maxR) {
                            p.dead = true;
                            onEat(2, 0.75, 0.55, p);
                            ate = true;
                            break;
                        }
                    }
                }
            }

            // Predator can consume tossed/vulnerable jellyfish!
            if (!ate && !this.dead) {
                for (let i = 0; i < jellies.length; i++) {
                    const j = jellies[i];
                    if (!j.dead && j.tossedTimer > 0) {
                        const maxR = mouthRadius + j.radius;
                        const dx = j.x - this.x;
                        const dy = j.y - this.y;
                        if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                        if (dx * dx + dy * dy < maxR * maxR) {
                            j.dead = true;
                            onEat(2, 0.70, 0.40, j);
                            ate = true;
                            break;
                        }
                    }
                }
            }
        }

        if (this.dead) return;

        // Turning (scaled by age)
        const turnIntensity = this.maxTurnSpeed * ageTurnMultiplier * dt;
        if (steer < 0.4) {
            this.angle -= turnIntensity * ((0.4 - steer) / 0.4);
        } else if (steer > 0.6) {
            this.angle += turnIntensity * ((steer - 0.6) / 0.4);
        }

        if (this.angle < 0) this.angle += Math.PI * 2;
        if (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;

        // Forward Thrust + Upward Swim Lift - Gravity Sink
        const forwardSpeed = thrust * this.maxSpeed * ageSpeedMultiplier;
        this.vx = Math.cos(this.angle) * forwardSpeed;

        const liftForce = swimUp * (95 + (this.size / 35) * 15);
        this.vy += this.sinkGravity * dt;
        this.vy -= liftForce * dt;
        this.vy = clamp(this.vy, -75, 75);

        this.x += this.vx * dt;
        this.y += (Math.sin(this.angle) * forwardSpeed * 0.6 + this.vy) * dt;

        const half = this.radius;
        this.x = clamp(this.x, half, this.bounds.w - half);
        this.y = clamp(this.y, half, this.bounds.h - half);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 6 Discrete Hunter Color Tiers
        const hungerTier = Math.min(5, Math.max(0, Math.floor(this.hunger * 6)));
        const style = PREDATOR_COLOR_TIERS[hungerTier];

        // Invulnerability Shield Shimmer (Discretized)
        if (this.invulnerableTimer > 0) {
            const phaseIdx = Math.min(3, Math.max(0, Math.floor(((Math.sin(this.age * 12) + 1) * 0.5) * 4)));
            ctx.strokeStyle = SHIELD_ALPHAS ? SHIELD_ALPHAS[phaseIdx] : "rgba(100, 240, 255, 0.50)";
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.35, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Swollen Bloated Body Radius
        const bloat = clamp(this.gluttony, 0, 1);
        const r = this.radius * (1.0 + bloat * 0.35);

        // 4 Discrete Jaw Aperture Stages: 0 (closed), 0.15, 0.35, 0.55 (wide)
        const gapeIdx = this.mouthAperture < 0.15 ? 0 : (this.mouthAperture < 0.45 ? 1 : (this.mouthAperture < 0.75 ? 2 : 3));
        const gapeAngle = [0.0, 0.18, 0.38, 0.55][gapeIdx];

        // Bloat warning pulse if near explosion threshold (> 65% bloat)
        if (bloat > 0.65) {
            ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = style.fill;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = Math.max(1.3, this.size * 0.045);

        // --- Big Circular Gulper Body with Extended Hinged Jaws ---
        ctx.beginPath();
        if (gapeAngle > 0.05) {
            ctx.arc(0, 0, r, gapeAngle, Math.PI * 2 - gapeAngle, false);
            const upperTipX = Math.cos(-gapeAngle) * (r * 1.18);
            const upperTipY = Math.sin(-gapeAngle) * (r * 1.18);
            ctx.lineTo(upperTipX, upperTipY);
            ctx.lineTo(r * 0.15, 0);
            const lowerTipX = Math.cos(gapeAngle) * (r * 1.18);
            const lowerTipY = Math.sin(gapeAngle) * (r * 1.18);
            ctx.lineTo(lowerTipX, lowerTipY);
        } else {
            ctx.arc(0, 0, r, 0, Math.PI * 2, false);
            ctx.lineTo(r * 1.12, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Dark gullet throat interior when mouth is gaping
        if (gapeAngle > 0.15) {
            ctx.fillStyle = "#070b12";
            ctx.beginPath();
            ctx.moveTo(r * 0.15, 0);
            ctx.lineTo(Math.cos(-gapeAngle) * (r * 1.14), Math.sin(-gapeAngle) * (r * 1.14));
            ctx.lineTo(Math.cos(gapeAngle) * (r * 1.14), Math.sin(gapeAngle) * (r * 1.14));
            ctx.closePath();
            ctx.fill();

            // Needle Teeth on Jaws
            ctx.fillStyle = "#ffffff";
            const numTeeth = Math.max(2, Math.floor(r * 0.12));
            for (let i = 1; i <= numTeeth; i++) {
                const t = i / (numTeeth + 1);
                const utx = lerp(r * 0.25, Math.cos(-gapeAngle) * (r * 1.1), t);
                const uty = lerp(0, Math.sin(-gapeAngle) * (r * 1.1), t);
                ctx.beginPath();
                ctx.moveTo(utx - 1.5, uty);
                ctx.lineTo(utx + 1.5, uty);
                ctx.lineTo(utx, uty + r * 0.18);
                ctx.closePath();
                ctx.fill();

                const ltx = lerp(r * 0.25, Math.cos(gapeAngle) * (r * 1.1), t);
                const lty = lerp(0, Math.sin(gapeAngle) * (r * 1.1), t);
                ctx.beginPath();
                ctx.moveTo(ltx - 1.5, lty);
                ctx.lineTo(ltx + 1.5, lty);
                ctx.lineTo(ltx, lty - r * 0.18);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Small Wagging Paddle Tail Fin
        const tailWave = Math.sin(this.age * 9);
        const finLen = r * 0.45;
        ctx.fillStyle = style.fin;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(-r - finLen, -finLen * 0.7 + tailWave * 2);
        ctx.lineTo(-r - finLen * 0.7, 0);
        ctx.lineTo(-r - finLen, finLen * 0.7 + tailWave * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Expressive Eye on upper front
        const eyeR = Math.max(2.4, r * 0.22);
        const eyeX = r * 0.35;
        const eyeY = -r * 0.45;

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0c131d";
        ctx.beginPath();
        ctx.arc(eyeX + eyeR * 0.35, eyeY, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
