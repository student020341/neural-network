// Jellyfish - Floating Sanctuary & Lethal Hazard

class Jellyfish {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     * @param {SparseNetwork} [inheritedBrain] 
     * @param {number} [customSize]
     */
    constructor(x, y, bounds, inheritedBrain = null, customSize = null, stagnation = 0) {
        this.species = "Jellyfish";
        this.x = x;
        this.y = y;
        this.bounds = bounds;
        this.name = uid("Jelly");
        this.stagnation = stagnation || 0;

        // Variable Size & Growth (Range 22 to 58, min is max spinner size, up to ~3x)
        this.size = customSize || randRange(22, 58);
        this.radius = this.size / 2;
        this.sizeTier = this.size < 32 ? "small" : (this.size < 46 ? "medium" : "large");

        // Physics & Motion
        const sizeRatio = (this.size - 22) / 36;
        this.vx = 0;
        this.vy = 10 + sizeRatio * 6;
        this.tiltAngle = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulsePower = 0;
        this.buoyancy = 0.35; // Water density / buoyancy factor

        // Tossed Vulnerable State (disarmed and edible by predators while > 0)
        this.tossedTimer = 0;

        // Water Jet Shockwave Dueling State
        this.jetActive = false;
        this.jetTimer = 0;

        // Hydrodynamic Eel Current Sensing Vector
        this.currentFx = 0;
        this.currentFy = 0;

        // Lifecycle, Invulnerability & Scoring
        this.age = 0;
        this.foodEaten = 0;
        this.score = 0;
        this.dead = false;
        this.invulnerableTimer = 2.5;

        // Highlight reel recording buffer
        this.recentInputBuffer = [];
        this.highlightClips = [];

        // Edge entry state
        this.enteringScreen = (x < 0 || x > bounds.w || y < 0);
        this.entryDirX = x < 0 ? 1 : (x > bounds.w ? -1 : 0);

        // Think constraints
        this.acc = Math.random() * 0.2;
        this.accMax = 0.22;

        // Hunger & Health
        this.hunger = 0.2;
        this.energyDrainRate = 0;
        this.health = 1.0;

        // 13 Sensory Inputs:
        // 0: Ceiling, 1: Floor, 2: Left Wall, 3: Right Wall
        // 4: Food Near, 5: Food Nutrition
        // 6: Rival Dist, 7: Rival Angle
        // 8: Hunger, 9: Buoyancy
        // 10: Current Dir, 11: Current Force, 12: Energy Drain
        this.inputs = new Array(13).fill(0);

        // 3 Outputs: Pulse Thrust, Tilt Steer (up to 60 deg lean), Water Jet Repel
        this.outputs = [0.5, 0.5, 0.0];

        this._initBrain(inheritedBrain);
        this.think([], []);
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
                    "Ceiling Dist", "Floor Dist",
                    "Left Wall", "Right Wall",
                    "Food Near", "Food Nutrition",
                    "Rival Dist", "Rival Angle",
                    "Hunger", "Buoyancy",
                    "Current Dir", "Current Force",
                    "Energy Drain"
                ],
                outputLabels: ["Pulse", "Tilt", "Water Jet"]
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

    applyCurrent(fx, fy, dt) {
        this.vx += fx * dt;
        this.vy += fy * dt;
        this.currentFx = (this.currentFx * 0.7) + (fx * 0.3);
        this.currentFy = (this.currentFy * 0.7) + (fy * 0.3);
    }

    takeDamage(amount) {
        if (this.invulnerableTimer > 0) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.dead = true;
        }
    }

    /**
     * @param {Array<Food>} foods 
     * @param {Array<Jellyfish>} jellies 
     */
    think(foods = [], jellies = []) {
        // 1. Ceiling Proximity (Sense ceiling up to 150px away)
        this.inputs[0] = clamp(1 - (this.y / 150), 0, 1);

        // 2. Floor Proximity
        const distFromFloor = this.bounds.h - this.y;
        this.inputs[1] = clamp(1 - (distFromFloor / 130), 0, 1);

        // 3. Lateral Screen Boundary Awareness (Left & Right Walls up to 140px away)
        this.inputs[2] = clamp(1 - (this.x / 140), 0, 1);
        this.inputs[3] = clamp(1 - ((this.bounds.w - this.x) / 140), 0, 1);

        // 4. Falling Food Proximity & Nutrition via distSq
        let maxFoodSignal = 0;
        let foodNutrition = 0;
        const filterRadius = 90 + this.radius;
        const filterRadiusSq = filterRadius * filterRadius;
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (f.state !== "drifting") continue;
            const dx = f.x - this.x;
            const dy = f.y - this.y;
            if (Math.abs(dx) > filterRadius || Math.abs(dy) > filterRadius) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < filterRadiusSq) {
                const signal = 1 - (Math.sqrt(dSq) / filterRadius);
                if (signal > maxFoodSignal) {
                    maxFoodSignal = signal;
                    foodNutrition = f.nutrition || 0.4;
                }
            }
        }
        this.inputs[4] = maxFoodSignal;
        this.inputs[5] = clamp(foodNutrition, 0, 1);

        // 5. Rival Jellyfish Proximity & Angle via distSq
        let nearestRival = null, minRDistSq = 140 * 140;
        for (let i = 0; i < jellies.length; i++) {
            const j = jellies[i];
            if (j === this || j.dead) continue;
            const dx = j.x - this.x;
            const dy = j.y - this.y;
            if (Math.abs(dx) > 140 || Math.abs(dy) > 140) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minRDistSq) { minRDistSq = dSq; nearestRival = j; }
        }

        if (nearestRival) {
            const minRDist = Math.sqrt(minRDistSq);
            let diff = Math.atan2(nearestRival.y - this.y, nearestRival.x - this.x);
            this.inputs[6] = clamp(1 - (minRDist / 140), 0, 1);
            this.inputs[7] = diff / Math.PI;
        } else {
            this.inputs[6] = 0;
            this.inputs[7] = 0;
        }

        // 6. Hunger
        this.inputs[8] = clamp(this.hunger, 0, 1);

        // 7. Water Density / Buoyancy Layer Sensing
        const depthRatio = clamp(this.y / Math.max(1, this.bounds.h), 0, 1);
        const peakDist = Math.abs(depthRatio - 0.52) / 0.52;
        this.buoyancy = clamp(1.0 - Math.pow(peakDist, 1.5) * 0.75, 0.25, 1.0);
        this.inputs[9] = clamp((this.buoyancy - 0.25) / 0.75, 0, 1);

        // 8. Hydrodynamic Eel Current Sensing (Direction & Magnitude)
        const currentMag = Math.hypot(this.currentFx, this.currentFy);
        if (currentMag > 0.5) {
            this.inputs[10] = Math.atan2(this.currentFy, this.currentFx) / Math.PI;
            this.inputs[11] = clamp(currentMag / 50, 0, 1);
        } else {
            this.inputs[10] = 0;
            this.inputs[11] = 0;
        }

        // 9. Overall Energy Drain Input (1.0 when pulse, tilt, and water jet are all firing)
        const [pulse, tilt, jet] = this.outputs;
        const tiltExertion = Math.abs(tilt - 0.5) * 2;
        this.energyDrainRate = clamp(pulse * 0.55 + tiltExertion * 0.25 + (jet > 0.5 ? 0.20 : 0), 0, 1);
        this.inputs[12] = this.energyDrainRate;

        // Record rolling buffer
        this.recentInputBuffer.push(Float32Array.from(this.inputs));
        if (this.recentInputBuffer.length > 25) this.recentInputBuffer.shift();

        this.outputs = this.brain.activate(this.inputs);
    }

    /**
     * @param {number} dt 
     * @param {Array<Food>} foods 
     * @param {Array<Jellyfish>} jellies 
     */
    act(dt, foods = [], jellies = []) {
        if (this.dead) return;

        this.age += dt;
        this.score = (this.foodEaten * 100) + Math.floor(this.age);
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
        if (this.jetTimer > 0) this.jetTimer -= dt;

        // Size ratio: 0 (small) to 1 (large)
        const sizeRatio = (this.size - 22) / 36;

        // Metabolism
        this.hunger += (0.010 + sizeRatio * 0.012) * dt;
        if (this.hunger >= 1.0) {
            this.dead = true;
            return;
        }

        // --- Tossed Tumbling Arc Physics (Launched by Crab) ---
        if (this.tossedTimer > 0) {
            this.tossedTimer -= dt;
            this.vy += 320 * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.tiltAngle += 4.5 * dt; // Tumbling spin

            this.x = clamp(this.x, this.radius, this.bounds.w - this.radius);
            if (this.y >= this.bounds.h - this.radius * 1.5) {
                this.y = this.bounds.h - this.radius * 1.5;
                this.tossedTimer = 0;
            }
            return;
        }

        // Dynamic Active Output Burn
        const [pulse, tilt, jet] = this.outputs;
        const tiltExertion = Math.abs(tilt - 0.5) * 2;
        const activeOutputBurn = (pulse * 0.030 + tiltExertion * 0.012 + (jet > 0.5 ? 0.018 : 0)) * (1.0 + sizeRatio * 0.4);
        this.hunger += activeOutputBurn * dt;

        // Surface Air Exposure Consequence (Repelling downward current)
        if (this.y < 35) {
            this.hunger += 0.08 * dt;
            this.vy += 65 * dt;
        }

        // Edge entry
        if (this.enteringScreen) {
            this.x += this.entryDirX * 35 * dt;
            this.y += 22 * dt;
            if (this.x > 30 && this.x < this.bounds.w - 30 && this.y > 30) {
                this.enteringScreen = false;
            }
            return;
        }

        // Gentle lateral wall buffer (prevents dead sticking to side glass)
        if (this.x < 35) this.vx += 35 * dt;
        if (this.x > this.bounds.w - 35) this.vx -= 35 * dt;

        // Dissipate external hydrodynamic current impulse
        this.currentFx *= Math.max(0, 1 - dt * 2.5);
        this.currentFy *= Math.max(0, 1 - dt * 2.5);

        // --- Nutrition Threshold Filter by Size Tier ---
        // Small jellies need N >= 0.28, Medium need N >= 0.48, Large need N >= 0.70!
        const minNutritionNeeded = 0.28 + sizeRatio * 0.44;

        // Catch falling food pellets (consumes at most 1 item per frame)
        for (const f of foods) {
            if (f.state === "drifting") {
                const dx = Math.abs(this.x - f.x);
                const dy = f.y - this.y;
                if (dx < this.radius + f.radius && dy > -this.radius * 0.5 && dy < this.radius * 2.5) {
                    f.state = "dead";
                    this.foodEaten++;
                    const nutr = f.nutrition || 0.35;

                    // If nutrition meets the size requirement, recover hunger
                    if (nutr >= minNutritionNeeded) {
                        const effectiveRecovery = (nutr - minNutritionNeeded + 0.25) * (0.85 - sizeRatio * 0.2);
                        this.hunger = Math.max(0, this.hunger - effectiveRecovery);
                    }

                    this._captureHighlight();
                    break;
                }
            }
        }

        // Think step
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think(foods, jellies);
        }

        // --- Water Jet Repel Dueling Mechanic ---
        this.jetActive = jet > 0.5;
        if (this.jetActive) {
            this.jetTimer = 0.22;
            const blastRadius = this.radius * 2.4;

            for (let i = 0; i < jellies.length; i++) {
                const rival = jellies[i];
                if (rival === this || rival.dead) continue;
                const maxR = blastRadius + rival.radius;
                const dx = rival.x - this.x;
                const dy = rival.y - this.y;
                if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
                const dSq = dx * dx + dy * dy;
                if (dSq < maxR * maxR) {
                    const d = Math.sqrt(dSq);
                    const ang = Math.atan2(dy, dx);
                    const pushPower = (1 - (d / maxR)) * (95 + this.size * 1.8);
                    
                    // Repel rival outward
                    rival.vx += Math.cos(ang) * pushPower * dt;
                    rival.vy += Math.sin(ang) * pushPower * dt;

                    // Subtle equal and opposite recoil
                    this.vx -= Math.cos(ang) * pushPower * 0.35 * dt;
                    this.vy -= Math.sin(ang) * pushPower * 0.35 * dt;
                }
            }
        }

        // 60-Degree Max Lean Pulse Steering
        const maxLean = Math.PI / 3; // 60 degrees
        const targetTilt = (tilt - 0.5) * 2 * maxLean;
        this.tiltAngle += (targetTilt - this.tiltAngle) * Math.min(1.0, dt * 8);

        // Hop / Contraction Pulse
        if (pulse > 0.45 && this.pulsePower <= 0.1) {
            this.pulsePower = 1.0;
            const hopForce = pulse * (75 + (this.size / 22) * 12);
            this.vy = -Math.cos(this.tiltAngle) * hopForce;
            this.vx = Math.sin(this.tiltAngle) * hopForce * 1.35;
        }

        if (this.pulsePower > 0) {
            this.pulsePower = Math.max(0, this.pulsePower - dt * 2.5);
        }

        // --- Water Density Stratification & Buoyancy Cushion ---
        const depthRatio = clamp(this.y / Math.max(1, this.bounds.h), 0, 1);
        const peakDist = Math.abs(depthRatio - 0.52) / 0.52;
        this.buoyancy = clamp(1.0 - Math.pow(peakDist, 1.5) * 0.75, 0.25, 1.0);
        const sinkMultiplier = lerp(1.0, 0.35, (this.buoyancy - 0.25) / 0.75);

        const baseGravity = (22 + sizeRatio * 6);
        this.vy += baseGravity * sinkMultiplier * dt;
        this.vx *= 0.985; // Low drag preserves angled horizontal glide
        this.vy = clamp(this.vy, -85, 30);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        const half = this.radius;
        this.x = clamp(this.x, half, this.bounds.w - half);
        this.y = clamp(this.y, 10, this.bounds.h - this.radius * 1.5);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.dead) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tiltAngle * 0.6);

        // Visual Hunger Tweening (Electric Neon Pink/Violet -> Ghostly Gray)
        const hue = lerp(290, 0, this.hunger);
        const sat = lerp(85, 0, this.hunger);
        const lum = lerp(65, 75, this.hunger);
        const alpha = lerp(0.72, 0.32, this.hunger);

        // Tossed Vulnerable Halo
        if (this.tossedTimer > 0) {
            const pulse = (Math.sin(this.age * 16) + 1) * 0.5;
            ctx.strokeStyle = getRgba(251, 191, 36, 0.6 + pulse * 0.35);
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * (1.35 + pulse * 0.15), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Invulnerability Shield Shimmer
        if (this.invulnerableTimer > 0) {
            const shieldAlpha = (Math.sin(this.age * 12) + 1) * 0.35;
            ctx.strokeStyle = getRgba(100, 240, 255, shieldAlpha);
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.25, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Water Jet Shockwave Ripple Rings
        if (this.jetTimer > 0) {
            const jetAlpha = (this.jetTimer / 0.22);
            ctx.strokeStyle = getRgba(120, 240, 255, jetAlpha * 0.6);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * (1.3 + (1 - jetAlpha) * 0.8), 0, Math.PI * 2);
            ctx.stroke();
        }

        const squeeze = 1.0 - this.pulsePower * 0.3;
        const stretch = 1.0 + this.pulsePower * 0.4;

        ctx.fillStyle = getHsla(hue, sat, lum, alpha);
        ctx.strokeStyle = getHsla(hue, sat, lum + 15, alpha + 0.2);
        ctx.lineWidth = 1.2;

        // Umbrella Bell
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * squeeze, Math.PI, 0, false);
        ctx.quadraticCurveTo(this.radius * 0.5 * squeeze, 5 * stretch, 0, 3 * stretch);
        ctx.quadraticCurveTo(-this.radius * 0.5 * squeeze, 5 * stretch, -this.radius * squeeze, 0);
        ctx.fill();
        ctx.stroke();

        // Inner glowing core
        const coreGlow = (this.buoyancy - 0.25) / 0.75;
        ctx.fillStyle = getHsla(hue + 20, sat, lum + 20, alpha * (0.85 + coreGlow * 0.15));
        ctx.beginPath();
        ctx.arc(0, -2, this.radius * 0.45 * squeeze, 0, Math.PI * 2);
        ctx.fill();

        // Trailing tentacles
        ctx.strokeStyle = getHsla(hue, sat, lum, alpha * 0.75);
        ctx.lineWidth = Math.max(0.8, this.size * 0.05);
        const tentacleLen = this.size * 0.8 * stretch;
        const wave = Math.sin(this.age * 7);
        const trailDrag = -this.vx * 0.18;

        const numTentacles = Math.max(4, Math.floor(this.size * 0.15));
        for (let i = -numTentacles; i <= numTentacles; i++) {
            const tx = i * (this.radius * (0.8 / numTentacles) * squeeze);
            ctx.beginPath();
            ctx.moveTo(tx, 3);
            ctx.quadraticCurveTo(tx + wave * 2.5 + trailDrag * 0.5, tentacleLen * 0.5, tx - wave * 2 + trailDrag, tentacleLen);
            ctx.stroke();
        }

        ctx.restore();
    }
}
