// Crab - Benthic Scavenger & Floor Cleaner

class Crab {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     * @param {SparseNetwork} [inheritedBrain] 
     * @param {number} [customSize]
     */
    constructor(x, y, bounds, inheritedBrain = null, customSize = null) {
        this.species = "Crab";
        this.bounds = bounds;
        this.name = uid("Crab");

        // Variable Size & Trade-offs (Range 11 to 19, baseline 15)
        this.size = customSize || randRange(11, 19);
        this.radius = this.size / 2;
        this.sizeTier = this.size < 13.5 ? "small" : (this.size < 16.5 ? "medium" : "large");

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
            this.brain.mutate(0.12, { strength: 0.25, addConnectionRate: 0.04, addNodeRate: 0.015 });
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

        // 3. Rival Crab Proximity
        let minRivalDist = Infinity;
        for (const c of crabs) {
            if (c === this || c.dead || c.isAirborne) continue;
            const d = dist(this, c);
            if (d < minRivalDist) minRivalDist = d;
        }
        this.inputs[4] = minRivalDist < 50 ? clamp(1 - (minRivalDist / 50), 0, 1) : 0;

        // 4. Wall Climb Limit Proximity
        const wallH = this.bounds.h * 0.25;
        const totalLen = wallH * 2 + this.bounds.w;
        const nearEdge = Math.min(this.s, totalLen - this.s);
        this.inputs[5] = nearEdge < 35 ? clamp(1 - (nearEdge / 35), 0, 1) : 0;

        // 5. Predator Threat
        let maxPThreat = 0;
        for (const p of predators) {
            if (p.dead) continue;
            const d = dist(this, p);
            if (d < 140) {
                const t = (1 - (d / 140)) * (p.size / 30);
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

        // Dynamic Metabolism: Idling consumes 60% less hunger
        const [crawl, munch, pincer] = this.outputs;
        const crawlExertion = Math.abs(crawl - 0.5) * 2;
        const baseIdleBurn = 0.012;
        const activeOutputBurn = crawlExertion * 0.018 + (this.mouthOpen ? 0.008 : 0) + (this.pincerActive ? 0.012 : 0);
        this.hunger += (baseIdleBurn + activeOutputBurn) * dt;

        if (this.hunger >= 1.0) {
            this.dead = true;
            return;
        }

        // Dissipate gluttony bloat
        if (this.gluttony > 0) {
            this.gluttony = Math.max(0, this.gluttony - 0.035 * dt);
        }

        // Edge entry
        if (this.enteringScreen) {
            const wallH = this.bounds.h * 0.25;
            this.s += this.entryDir * 50 * dt;
            const pos = this._sToPos(this.s);
            this.x = pos.x; this.y = pos.y;
            if (this.x > 20 && this.x < this.bounds.w - 20) {
                this.enteringScreen = false;
            }
            return;
        }

        // Think step
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think(foods, carcasses, crabs, predators, jellies);
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

        // Active mouth munching (consumes at most 1 item per frame)
        if (this.mouthOpen) {
            let ate = false;

            // Eat settled food detritus
            for (const f of foods) {
                if (f.state === "settled" && dist(this, f) < this.size * 1.2) {
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

            // Eat fallen carcasses
            if (!ate) {
                for (const c of carcasses) {
                    if (c.state !== "dead" && dist(this, c) < this.size * 1.3) {
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

            // Nibble beached jellyfish tentacles
            if (!ate) {
                for (const j of jellies) {
                    if (!j.dead && dist(this, j) < this.size + (j.size || 22) * 0.5) {
                        j.takeDamage(0.25 * dt);
                        this.hunger = Math.max(0, this.hunger - 0.15 * dt);
                        this._captureHighlight();
                        break;
                    }
                }
            }
        }

        // Pincer Strike & Dueling (Can duel rival crabs or toss floor-dwelling jellies!)
        if (this.pincerActive && this.pincerCooldown <= 0) {
            let tossedJelly = false;

            // 1. Toss floor-dwelling jellyfish into vulnerable tumbling state & spawn food!
            for (const j of jellies) {
                if (j.dead) continue;
                const isNearFloor = j.y >= this.bounds.h - (j.size || 22) * 2.4;
                if (isNearFloor && dist(this, j) < this.size * 1.35 + j.radius) {
                    j.tossedTimer = 3.5;
                    j.vy = -randRange(175, 240);
                    j.vx = randRange(-70, 70);
                    this.pincerCooldown = 1.0;
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

            // 2. Pincer Duel Collision with rival Crabs (Impairs power by gluttony)
            if (!tossedJelly) {
                for (const c of crabs) {
                    if (c === this || c.dead || c.isAirborne) continue;
                    if (dist(this, c) < this.size * 1.15) {
                        const myPower = pincer * (1.0 + this.hunger) * (this.size / 15) * (1.0 - this.gluttony * 0.45);
                        const rivalPower = c.outputs[2] * (1.0 + c.hunger) * (c.size / 15) * (1.0 - c.gluttony * 0.45);

                        this.hunger += 0.08 * (this.size / 15);
                        c.hunger += 0.08 * (c.size / 15);

                        if (myPower >= rivalPower) {
                            c.launch();
                            this.pincerCooldown = 1.0;
                            this._captureHighlight();
                        } else {
                            this.launch();
                            c.pincerCooldown = 1.0;
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

        // Visual Hunger Tweening (Ruby Red -> Dusty Sandstone)
        const hue = lerp(0, 30, this.hunger);
        const sat = lerp(85, 35, this.hunger);
        const lum = lerp(48, 65, this.hunger);

        // Invulnerability Shield Shimmer
        if (this.invulnerableTimer > 0) {
            const shieldAlpha = (Math.sin(this.age * 12) + 1) * 0.35;
            ctx.strokeStyle = `rgba(100, 240, 255, ${shieldAlpha})`;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size * 0.65, this.size * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lum}%)`;
        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${lum - 15}%)`;
        ctx.lineWidth = 1.1;

        // Rounded crab carapace (swells slightly with gluttony)
        const bloatScale = 1.0 + this.gluttony * 0.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, (this.size / 2) * bloatScale, (this.size / 2.8) * bloatScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Flashing black dot when mouth is actively munching (toggles every ~125ms)
        if (this.mouthOpen && (Math.floor(this.time * 8) % 2 === 0)) {
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1.6, this.size * 0.14), 0, Math.PI * 2);
            ctx.fill();
        }

        // Walking legs
        ctx.beginPath();
        const legS = this.size * 0.35;
        ctx.moveTo(-legS * 0.8, 2); ctx.lineTo(-legS * 1.5, legS);
        ctx.moveTo(-legS * 0.3, 3); ctx.lineTo(-legS * 0.8, legS * 1.1);
        ctx.moveTo(legS * 0.3, 3); ctx.lineTo(legS * 0.8, legS * 1.1);
        ctx.moveTo(legS * 0.8, 2); ctx.lineTo(legS * 1.5, legS);
        ctx.stroke();

        // Snapping Pincers / Claws: Active rhythmic opening and closing animation!
        const clawDist = this.size * 0.55;
        const clawRad = Math.max(2.2, this.size * 0.18);
        
        let snapSpread = 0.3;
        if (this.pincerActive) {
            snapSpread = 0.5 + Math.abs(Math.sin(this.time * 16)) * 2.8;
        } else if (this.mouthOpen) {
            snapSpread = 0.4 + Math.abs(Math.sin(this.time * 8)) * 1.2;
        } else if (this.isStrained) {
            snapSpread = 0.15; // Exhausted droop
        }

        const drawSplitClaw = (cx, cy) => {
            ctx.beginPath();
            ctx.arc(cx, cy - snapSpread, clawRad, Math.PI, 0, false);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy + snapSpread, clawRad, 0, Math.PI, false);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        // Muscle Strain Visual: Tween claw color from natural hue to exhausted stone gray
        const strainRatio = this.isStrained ? 1.0 : clamp(this.muscleStrain, 0, 1);
        const clawSat = lerp(sat, 0, strainRatio);
        const clawLum = lerp(lum - 8, 48, strainRatio);

        ctx.fillStyle = `hsl(${hue}, ${clawSat}%, ${clawLum}%)`;
        ctx.strokeStyle = `hsl(${hue}, ${clawSat}%, ${clawLum - 14}%)`;
        drawSplitClaw(-clawDist, -this.size * 0.3);
        drawSplitClaw(clawDist, -this.size * 0.3);

        // Eyes on stalks
        const eyeOff = this.size * 0.2;
        ctx.fillStyle = "white";
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
