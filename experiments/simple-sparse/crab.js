// Crab - Benthic Scavenger & Floor Cleaner with 9 Discrete Sizes & Quantized Rendering

// 9 Discrete Size Constants: 3 Small, 3 Medium, 3 Large
const CRAB_SIZES = [
    12.0, 13.5, 15.0, // Small (S1, S2, S3)
    17.0, 19.0, 21.0, // Medium (M1, M2, M3)
    24.0, 27.0, 30.0  // Large/Titan (L1, L2, L3)
];

// Pre-computed 6 Discrete Carapace Armor Color Tiers
const CRAB_COLOR_TIERS = [
    { fill: "#e03e2e", stroke: "#a62115", leg: "#8a160d" }, // 0: Fresh Scarlet
    { fill: "#d95325", stroke: "#9e3511", leg: "#80270a" }, // 1: Crimson Rust
    { fill: "#c45a27", stroke: "#8a3a14", leg: "#6e2a0b" }, // 2: Burnt Amber
    { fill: "#a85028", stroke: "#703013", leg: "#57210a" }, // 3: Hardened Chitin
    { fill: "#7e3828", stroke: "#522014", leg: "#3d1309" }, // 4: Deep Garnet Elder
    { fill: "#4a2428", stroke: "#2e1215", leg: "#200a0d" }  // 5: Obsidian Titan Elder
];

class Crab {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     * @param {SparseNetwork} [inheritedBrain] 
     * @param {number} [customSize]
     */
    constructor(x, y, bounds, inheritedBrain = null, customSize = null, stagnation = 0) {
        this.species = "Crab";
        this.bounds = bounds;
        this.name = uid("Crab");
        this.stagnation = stagnation || 0;

        // 9 Discrete Size Tier Selection (3 Small, 3 Medium, 3 Large)
        if (typeof customSize === "number") {
            let closestIdx = 0;
            let minDist = 999;
            for (let i = 0; i < CRAB_SIZES.length; i++) {
                const d = Math.abs(CRAB_SIZES[i] - customSize);
                if (d < minDist) {
                    minDist = d;
                    closestIdx = i;
                }
            }
            this.sizeIndex = closestIdx;
        } else {
            this.sizeIndex = Math.floor(Math.random() * CRAB_SIZES.length);
        }

        this.size = CRAB_SIZES[this.sizeIndex];
        this.radius = this.size / 2;
        this.sizeTier = this.sizeIndex < 3 ? "small" : (this.sizeIndex < 6 ? "medium" : "large");

        // Perimeter Position along U-trench (Left 25% wall -> Seafloor -> Right 25% wall)
        const wallH = this.bounds.h * 0.25;
        this.s = clamp(wallH + x, 0, wallH * 2 + this.bounds.w);
        this.x = x;
        this.y = bounds.h - this.radius;

        // Airborne ballistic fling state
        this.isAirborne = false;
        this.vx = 0;
        this.vy = 0;
        this.spin = 0;

        // Lifecycle, Invulnerability & Scoring
        this.age = 0;
        this.foodEaten = 0;
        this.score = 0;
        this.dead = false;
        this.invulnerableTimer = 2.5;

        // Muscle Strain & Fatigue System
        this.muscleStrain = 0; // 0 (fresh) to 1 (maxed strain)
        this.isStrained = false; // Lockout state: active when >= 1.0 until falling below 0.60

        // Gluttony State (slows crawl speed and impairs duel power)
        this.gluttony = 0;
        this.energyDrainRate = 0;

        // Highlight reel recording buffer
        this.recentInputBuffer = [];
        this.highlightClips = [];

        // Edge entry state
        this.enteringScreen = (x < 0 || x > bounds.w);
        this.entryDir = x < 0 ? 1 : -1;

        // Think constraints
        this.acc = Math.random() * 0.18;
        this.accMax = 0.20;

        // Hunger & Metabolism
        this.hunger = 0.2;

        // Animation states
        this.mouthOpen = false;
        this.pincerActive = false;
        this.pincerCooldown = 0;
        this.time = 0;

        // 11 Sensory Inputs:
        // 0: Target Detritus/Carcass Dir (-1 to +1)
        // 1: Target Detritus/Carcass Dist (0 to 1)
        // 2: Floor Jelly Dir (-1 to +1)
        // 3: Floor Jelly Dist (0 to 1)
        // 4: Rival Crab Proximity (0 to 1)
        // 5: Wall Climb Limit Proximity (0 to 1)
        // 6: Predator Threat (0 to 1)
        // 7: Hunger (0 to 1)
        // 8: Muscle Strain (0 to 1)
        // 9: Gluttony Bloat (0 to 1)
        // 10: Energy Drain (0 to 1)
        this.inputs = new Array(11).fill(0);

        // 3 Outputs: Crawl, Mouth Munch, Pincer Strike
        this.outputs = [0.5, 0, 0];

        this._initBrain(inheritedBrain);
        this.think([], [], [], [], []);
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
                    "Target Dir", "Target Dist",
                    "Jelly Dir", "Jelly Dist",
                    "Rival Near", "Wall Climb",
                    "Pred Threat", "Hunger",
                    "Strain", "Gluttony",
                    "Energy Drain"
                ],
                outputLabels: ["Crawl", "Munch", "Pincer"]
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

    _sToPos(s) {
        const wallH = this.bounds.h * 0.25;
        const totalW = this.bounds.w;
        const half = this.radius;

        if (s < wallH) {
            return { x: half, y: this.bounds.h - wallH + s };
        } else if (s < wallH + totalW) {
            return { x: s - wallH, y: this.bounds.h - half };
        } else {
            const climb = s - (wallH + totalW);
            return { x: totalW - half, y: this.bounds.h - climb };
        }
    }

    launch() {
        this.isAirborne = true;
        this.vx = randRange(-45, 45);
        this.vy = -randRange(210, 260);
        this.spin = randRange(-7, 7);
    }

    die() {
        this.dead = true;
    }

    /**
     * @param {Array<Food>} foods 
     * @param {Array<Carcass>} carcasses 
     * @param {Array<Crab>} crabs 
     * @param {Array<PredatorFish>} predators 
     * @param {Array<Jellyfish>} jellies 
     */
    think(foods = [], carcasses = [], crabs = [], predators = [], jellies = []) {
        const maxDist = this.bounds.w * 0.6;

        // 1. Target Detritus or Carcass Sensing
        let nearestTarget = null, minTDist = Infinity;
        for (const f of foods) {
            if (f.state !== "settled") continue;
            const d = Math.abs(this.x - f.x);
            if (d < minTDist) { minTDist = d; nearestTarget = f; }
        }
        for (const c of carcasses) {
            if (c.state !== "settled") continue;
            const d = Math.abs(this.x - c.x);
            if (d < minTDist) { minTDist = d; nearestTarget = c; }
        }

        if (nearestTarget) {
            this.inputs[0] = clamp((nearestTarget.x - this.x) / 100, -1, 1);
            this.inputs[1] = clamp(1 - (minTDist / maxDist), 0, 1);
        } else {
            this.inputs[0] = 0; this.inputs[1] = 0;
        }

        // 2. Floor-Dwelling Jellyfish Detection (Toss Target!)
        let nearestJelly = null, minJDist = Infinity;
        for (const j of jellies) {
            if (j.dead) continue;
            const isNearFloor = j.y >= this.bounds.h - (j.size || 22) * 2.5;
            if (isNearFloor) {
                const d = Math.abs(this.x - j.x);
                if (d < minJDist) { minJDist = d; nearestJelly = j; }
            }
        }

        if (nearestJelly && minJDist < maxDist) {
            this.inputs[2] = clamp((nearestJelly.x - this.x) / 100, -1, 1);
            this.inputs[3] = clamp(1 - (minJDist / maxDist), 0, 1);
        } else {
            this.inputs[2] = 0; this.inputs[3] = 0;
        }

        // 3. Rival Crab Proximity via distSq
        let minRivalDistSq = 50 * 50;
        for (let i = 0; i < crabs.length; i++) {
            const c = crabs[i];
            if (c === this || c.dead || c.isAirborne) continue;
            const dx = c.x - this.x;
            const dy = c.y - this.y;
            if (Math.abs(dx) > 50 || Math.abs(dy) > 50) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minRivalDistSq) minRivalDistSq = dSq;
        }
        this.inputs[4] = minRivalDistSq < 2500 ? clamp(1 - (Math.sqrt(minRivalDistSq) / 50), 0, 1) : 0;

        // 4. Wall Climb Limit Proximity
        const wallH = this.bounds.h * 0.25;
        const totalLen = wallH * 2 + this.bounds.w;
        const nearEdge = Math.min(this.s, totalLen - this.s);
        this.inputs[5] = nearEdge < 35 ? clamp(1 - (nearEdge / 35), 0, 1) : 0;

        // 5. Predator Threat via distSq
        let maxPThreat = 0;
        const threatRadius = 140;
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
        this.inputs[6] = clamp(maxPThreat, 0, 1);

        // 6. Hunger
        this.inputs[7] = clamp(this.hunger, 0, 1);

        // 7. Muscle Strain
        this.inputs[8] = clamp(this.muscleStrain, 0, 1);

        // 8. Gluttony Bloat
        this.inputs[9] = clamp(this.gluttony, 0, 1);

        // 9. Overall Energy Drain Input (1.0 when crawling, munching, and pinching simultaneously)
        const [crawl, munch, pincer] = this.outputs;
        const crawlExertion = Math.abs(crawl - 0.5) * 2;
        this.energyDrainRate = clamp(crawlExertion * 0.4 + (munch > 0.6 ? 0.3 : 0) + (pincer > 0.5 ? 0.3 : 0), 0, 1);
        this.inputs[10] = this.energyDrainRate;

        // Record rolling buffer
        this.recentInputBuffer.push(Float32Array.from(this.inputs));
        if (this.recentInputBuffer.length > 25) this.recentInputBuffer.shift();

        this.outputs = this.brain.activate(this.inputs);
    }

    performScheduledThink(foods = [], carcasses = [], crabs = [], predators = [], jellies = []) {
        this.needsThink = false;
        this.think(foods, carcasses, crabs, predators, jellies);
    }

    /**
     * @param {number} dt 
     * @param {Array<Food>} foods 
     * @param {Array<Carcass>} carcasses 
     * @param {Array<Crab>} crabs 
     * @param {Array<PredatorFish>} predators 
     * @param {Array<Jellyfish>} jellies 
     * @param {Function} [onTossJellyCallback]
     */
    act(dt, foods = [], carcasses = [], crabs = [], predators = [], jellies = [], onTossJellyCallback = null) {
        if (this.dead) return;

        this.time += dt;
        this.age += dt;
        this.score = (this.foodEaten * 100) + Math.floor(this.age);
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
        if (this.pincerCooldown > 0) this.pincerCooldown -= dt;

        // Airborne Ballistic Tumbling Physics
        if (this.isAirborne) {
            this.vy += 380 * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.x = clamp(this.x, this.radius, this.bounds.w - this.radius);

            if (this.y >= this.bounds.h - this.radius) {
                this.y = this.bounds.h - this.radius;
                this.isAirborne = false;
                const wallH = this.bounds.h * 0.25;
                this.s = wallH + this.x;
            }
            return;
        }

        const [crawl, munch, pincer] = this.outputs;
        const crawlExertion = Math.abs(crawl - 0.5) * 2;

        // Elder Titan Aging Dynamics
        const ageFactor = clamp(this.age / 120, 0, 1);
        const ageDuelPowerMultiplier = 1.0 + (ageFactor * 0.45);
        const ageCooldownDuration = lerp(1.0, 0.45, ageFactor);
        const ageMetabolicMultiplier = 1.0 + (ageFactor * 0.45);

        // Dynamic Metabolism: High exertion increases hunger burn
        const baseIdleBurn = 0.009;
        const activeOutputBurn = (crawlExertion * 0.016 + (munch > 0.6 ? 0.014 : 0) + (pincer > 0.5 ? 0.022 : 0)) * (this.size / 15);
        this.hunger += (baseIdleBurn + activeOutputBurn) * ageMetabolicMultiplier * dt;

        if (this.hunger >= 1.0) {
            this.dead = true;
            return;
        }

        // Slowly digest gluttony bloat
        if (this.gluttony > 0) {
            this.gluttony = Math.max(0, this.gluttony - 0.03 * dt);
        }

        // Edge entry
        if (this.enteringScreen) {
            this.s += this.entryDir * 50 * dt;
            const pos = this._sToPos(this.s);
            this.x = pos.x; this.y = pos.y;
            if (this.x > 20 && this.x < this.bounds.w - 20) {
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

        // --- Muscle Strain & Fatigue Mechanics ---
        const wantsMunch = munch > 0.6;
        const wantsPincer = pincer > 0.5;

        // Build up or dissipate muscle strain
        if (wantsPincer) {
            this.muscleStrain += 0.45 * dt;
        }
        if (wantsMunch) {
            this.muscleStrain += 0.25 * dt;
        }
        if (!wantsMunch && !wantsPincer) {
            this.muscleStrain = Math.max(0, this.muscleStrain - 0.35 * dt);
        }

        this.muscleStrain = clamp(this.muscleStrain, 0, 1);

        // Check strain lockout threshold
        if (this.muscleStrain >= 1.0) {
            this.isStrained = true;
        } else if (this.isStrained && this.muscleStrain <= 0.60) {
            this.isStrained = false; // Lockout lifted when strain falls below 60%
        }

        // Apply action state based on lockout
        this.mouthOpen = !this.isStrained && wantsMunch;
        this.pincerActive = !this.isStrained && wantsPincer;

        // --- Approximate Interleaved Interaction Physics (30 Hz Sub-rate) ---
        this.frameTick = (this.frameTick || 0) + 1;
        const doInteractions = (this.frameTick % 2) === 0;

        // Active mouth munching (consumes at most 1 item per interaction tick)
        if (doInteractions && this.mouthOpen) {
            let ate = false;

            // Eat settled food detritus
            for (let i = 0; i < foods.length; i++) {
                const f = foods[i];
                if (f.state === "settled") {
                    const maxR = this.size * 1.2;
                    const dx = f.x - this.x;
                    const dy = f.y - this.y;
                    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                    if (dx * dx + dy * dy < maxR * maxR) {
                        f.state = "dead";
                        this.foodEaten++;
                        this.hunger = Math.max(0, this.hunger - 0.45);
                        if (this.hunger < 0.30) {
                            this.gluttony = Math.min(1.0, this.gluttony + 0.32);
                        }
                        this._captureHighlight();
                        ate = true;
                        break;
                    }
                }
            }

            // Eat fallen carcasses
            if (!ate) {
                for (let i = 0; i < carcasses.length; i++) {
                    const c = carcasses[i];
                    if (c.state !== "dead") {
                        const maxR = this.size * 1.3;
                        const dx = c.x - this.x;
                        const dy = c.y - this.y;
                        if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                        if (dx * dx + dy * dy < maxR * maxR) {
                            c.state = "dead";
                            this.foodEaten += 2;
                            this.hunger = Math.max(0, this.hunger - 0.65);
                            if (this.hunger < 0.30) {
                                this.gluttony = Math.min(1.0, this.gluttony + 0.45);
                            }
                            this._captureHighlight();
                            ate = true;
                            break;
                        }
                    }
                }
            }

            // Nibble beached jellyfish tentacles
            if (!ate) {
                for (let i = 0; i < jellies.length; i++) {
                    const j = jellies[i];
                    if (!j.dead) {
                        const maxR = this.size + (j.size || 22) * 0.5;
                        const dx = j.x - this.x;
                        const dy = j.y - this.y;
                        if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                        if (dx * dx + dy * dy < maxR * maxR) {
                            j.takeDamage(0.5 * dt);
                            this.hunger = Math.max(0, this.hunger - 0.30 * dt);
                            this._captureHighlight();
                            break;
                        }
                    }
                }
            }
        }

        // Pincer Strike & Dueling (Can duel rival crabs or toss floor-dwelling jellies!)
        if (doInteractions && this.pincerActive && this.pincerCooldown <= 0) {
            let tossedJelly = false;

            // 1. Toss floor-dwelling jellyfish into vulnerable tumbling state & spawn food!
            for (let i = 0; i < jellies.length; i++) {
                const j = jellies[i];
                if (j.dead) continue;
                const isNearFloor = j.y >= this.bounds.h - (j.size || 22) * 2.4;
                if (isNearFloor) {
                    const maxR = this.size * 1.35 + j.radius;
                    const dx = j.x - this.x;
                    const dy = j.y - this.y;
                    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                    if (dx * dx + dy * dy < maxR * maxR) {
                        j.tossedTimer = 3.5;
                        j.vy = -randRange(175, 240);
                        j.vx = randRange(-70, 70);
                        this.pincerCooldown = ageCooldownDuration;
                        this.score += 60;
                        this.foodEaten++;
                        this.hunger = Math.max(0, this.hunger - 0.25);
                        this._captureHighlight();

                        if (typeof onTossJellyCallback === "function") {
                            onTossJellyCallback(this, j);
                        }
                        tossedJelly = true;
                        break;
                    }
                }
            }

            // 2. Pincer Duel Collision with rival Crabs (Impairs power by gluttony, boosted by Elder age!)
            if (!tossedJelly) {
                for (let i = 0; i < crabs.length; i++) {
                    const c = crabs[i];
                    if (c === this || c.dead || c.isAirborne) continue;
                    const maxR = this.size * 1.15;
                    const dx = c.x - this.x;
                    const dy = c.y - this.y;
                    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                    if (dx * dx + dy * dy < maxR * maxR) {
                        const rivalAgeFactor = clamp(c.age / 120, 0, 1);
                        const rivalDuelPowerMultiplier = 1.0 + (rivalAgeFactor * 0.45);

                        const myPower = pincer * (1.0 + this.hunger) * (this.size / 15) * (1.0 - this.gluttony * 0.45) * ageDuelPowerMultiplier;
                        const rivalPower = c.outputs[2] * (1.0 + c.hunger) * (c.size / 15) * (1.0 - c.gluttony * 0.45) * rivalDuelPowerMultiplier;

                        this.hunger += 0.08 * (this.size / 15);
                        c.hunger += 0.08 * (c.size / 15);

                        if (myPower >= rivalPower) {
                            c.launch();
                            this.pincerCooldown = ageCooldownDuration;
                            this._captureHighlight();
                        } else {
                            this.launch();
                            c.pincerCooldown = lerp(1.0, 0.45, rivalAgeFactor);
                            c._captureHighlight();
                        }
                        break;
                    }
                }
            }
        }

        // Crawl along perimeter U-track (slowed by gluttony)
        const wallH = this.bounds.h * 0.25;
        const totalLen = wallH * 2 + this.bounds.w;
        const crawlSpeed = (70 - (this.size - 15) * 2) * (1.0 - this.gluttony * 0.35) * dt;

        if (crawl < 0.4) {
            this.s -= crawlSpeed * ((0.4 - crawl) / 0.4);
        } else if (crawl > 0.6) {
            this.s += crawlSpeed * ((crawl - 0.6) / 0.4);
        }

        // Wall climb fatigue
        if (this.s < 18) this.s += 12 * dt;
        if (this.s > totalLen - 18) this.s -= 12 * dt;

        this.s = clamp(this.s, 0, totalLen);
        const pos = this._sToPos(this.s);
        this.x = pos.x;
        this.y = pos.y;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // 6 Discrete Carapace Armor Color Tiers (Modified by Age/Elder Status)
        const ageFactor = clamp(this.age / 120, 0, 1);
        const hungerIdx = Math.min(5, Math.max(0, Math.floor(this.hunger * 6)));
        const colorTier = Math.min(5, hungerIdx + Math.floor(ageFactor * 2));
        const style = CRAB_COLOR_TIERS[colorTier];

        // Invulnerability Shield Shimmer (Discretized)
        if (this.invulnerableTimer > 0) {
            const phaseIdx = Math.min(3, Math.max(0, Math.floor(((Math.sin(this.age * 12) + 1) * 0.5) * 4)));
            ctx.strokeStyle = SHIELD_ALPHAS ? SHIELD_ALPHAS[phaseIdx] : "rgba(100, 240, 255, 0.50)";
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size * 0.65, this.size * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Rounded crab carapace
        const bloatScale = 1.0 + this.gluttony * 0.20;
        const halfW = (this.size / 2) * bloatScale;
        const halfH = (this.size / 2.8) * bloatScale;

        ctx.beginPath();
        ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = style.stroke;
        ctx.stroke();

        // Flashing mouth munch indicator
        if (this.mouthOpen && (Math.floor(this.time * 8) % 2 === 0)) {
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1.6, this.size * 0.14), 0, Math.PI * 2);
            ctx.fill();
        }

        // Batched Walking Legs (Single Path)
        ctx.strokeStyle = style.leg;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        const legS = this.size * 0.35;
        ctx.moveTo(-legS * 0.8, 2); ctx.lineTo(-legS * 1.5, legS);
        ctx.moveTo(-legS * 0.3, 3); ctx.lineTo(-legS * 0.8, legS * 1.1);
        ctx.moveTo(legS * 0.3, 3); ctx.lineTo(legS * 0.8, legS * 1.1);
        ctx.moveTo(legS * 0.8, 2); ctx.lineTo(legS * 1.5, legS);
        ctx.stroke();

        // Snapping Pincers / Claws (Batched Pass)
        const clawDist = this.size * 0.55;
        const clawRad = Math.max(2.2, this.size * 0.18) * (1.0 + ageFactor * 0.30);
        
        let snapSpread = 0.3;
        if (this.pincerActive) {
            snapSpread = 0.5 + Math.abs(Math.sin(this.time * 16)) * 2.8;
        } else if (this.mouthOpen) {
            snapSpread = 0.4 + Math.abs(Math.sin(this.time * 8)) * 1.2;
        } else if (this.isStrained) {
            snapSpread = 0.15;
        }

        const clawColor = this.isStrained ? "#64748b" : style.fill;
        const clawStroke = this.isStrained ? "#475569" : style.stroke;

        ctx.fillStyle = clawColor;
        ctx.strokeStyle = clawStroke;
        ctx.lineWidth = 1.0;

        // Draw Left & Right Claws in 1 Combined Path
        ctx.beginPath();
        // Left claw top & bottom
        ctx.arc(-clawDist, -this.size * 0.3 - snapSpread, clawRad, Math.PI, 0, false);
        ctx.closePath();
        ctx.arc(-clawDist, -this.size * 0.3 + snapSpread, clawRad, 0, Math.PI, false);
        ctx.closePath();
        // Right claw top & bottom
        ctx.arc(clawDist, -this.size * 0.3 - snapSpread, clawRad, Math.PI, 0, false);
        ctx.closePath();
        ctx.arc(clawDist, -this.size * 0.3 + snapSpread, clawRad, 0, Math.PI, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eyes on stalks
        const eyeOff = this.size * 0.20;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-eyeOff, -this.size * 0.32, 1.8, 0, Math.PI * 2);
        ctx.arc(eyeOff, -this.size * 0.32, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(-eyeOff, -this.size * 0.32, 0.9, 0, Math.PI * 2);
        ctx.arc(eyeOff, -this.size * 0.32, 0.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
