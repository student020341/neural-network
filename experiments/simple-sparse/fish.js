// TurnFish (Spinner Fish) - Primary Pelagic Forager & Prey

class TurnFish {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     * @param {SparseNetwork} [inheritedBrain] 
     * @param {number} [customSize]
     */
    constructor(x, y, bounds, inheritedBrain = null, customSize = null, stagnation = 0) {
        this.species = "TurnFish";
        this.x = x;
        this.y = y;
        this.bounds = bounds;
        this.name = uid("TurnFish");
        this.stagnation = stagnation || 0;

        // Variable Size & Trade-offs (Range 12 to 22, baseline 16)
        this.size = customSize || randRange(12, 22);
        this.sizeTier = this.size < 15.5 ? "small" : (this.size < 19 ? "medium" : "large");

        const sizeRatio = (this.size - 16) / 6; // -1 to +1
        this.baseMaxSpeed = 115 + sizeRatio * 15;
        this.maxSpeed = this.baseMaxSpeed;
        this.maxTurnSpeed = (Math.PI * 1.9) - sizeRatio * (Math.PI * 0.5);

        // Lifecycle, Invulnerability & Scoring
        this.age = 0;
        this.foodEaten = 0;
        this.score = 0;
        this.dead = false;
        this.invulnerableTimer = 2.5; // 2.5s spawn grace period

        // Mouth & Gluttony Weight State
        this.mouthOpen = false;
        this.gluttony = 0; // 0 to 1 (weighs down fish when > 0)
        this.energyDrainRate = 0;

        // Highlight reel recording buffer
        this.recentInputBuffer = [];
        this.highlightClips = [];

        // Edge-entry spawner state
        this.enteringScreen = (x < 0 || x > bounds.w);
        this.entryDir = x < 0 ? 0 : Math.PI;
        this.angle = this.enteringScreen ? this.entryDir : Math.random() * Math.PI * 2;

        // Think constraints (staggered)
        this.acc = Math.random() * 0.15;
        this.accMax = 0.18;

        this.sightDist = 110 + sizeRatio * 20;
        this.feelerAngles = [-Math.PI / 4, 0, Math.PI / 4];
        this.feelerDistances = [this.sightDist, this.sightDist, this.sightDist];

        // Hunger & Metabolism
        this.hunger = 0.15;

        // Target references
        this.nearestFood = null;
        this.nearestTumblingCrab = null;
        this.nearestPredator = null;
        this.nearestJelly = null;

        // 13 Sensory Inputs
        this.inputs = new Array(13).fill(0);

        // 4 Outputs: Steer, Torque, Thrust, Gulp Mouth
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
                initialHidden: 4,
                initialConnectivity: 0.45,
                maxComplexity: 5.5,
                inputLabels: [
                    "Food Angle", "Food Dist", "Food Nutrition",
                    "Crab Angle", "Crab Dist",
                    "Wall L", "Wall C", "Wall R",
                    "Hunger", "Gluttony",
                    "Pred Threat", "Jelly Dist",
                    "Energy Drain"
                ],
                outputLabels: ["Steer", "Torque", "Thrust", "Gulp Mouth"]
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

    _castRayToBounds(rayAngle, maxDist) {
        const cos = Math.cos(rayAngle);
        const sin = Math.sin(rayAngle);
        let minDist = maxDist;

        if (cos > 0.0001) {
            const d = (this.bounds.w - this.x) / cos;
            if (d > 0 && d < minDist) minDist = d;
        } else if (cos < -0.0001) {
            const d = -this.x / cos;
            if (d > 0 && d < minDist) minDist = d;
        }

        if (sin > 0.0001) {
            const d = (this.bounds.h - this.y) / sin;
            if (d > 0 && d < minDist) minDist = d;
        } else if (sin < -0.0001) {
            const d = -this.y / sin;
            if (d > 0 && d < minDist) minDist = d;
        }

        return Math.min(minDist, maxDist);
    }

    /**
     * @param {Array<Food>} foods 
     * @param {Array<Crab>} crabs 
     * @param {Array<PredatorFish>} predators 
     * @param {Array<Jellyfish>} jellies 
     */
    think(foods = [], crabs = [], predators = [], jellies = []) {
        const maxDetectDist = Math.hypot(this.bounds.w, this.bounds.h) * 0.45;
        const maxDetectDistSq = maxDetectDist * maxDetectDist;

        // 1. Food Sensing (Angle, Dist, Nutrition Value) via fast distSq
        let nearestF = null, minFDistSq = maxDetectDistSq;
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (f.state !== "drifting") continue;
            const dx = f.x - this.x;
            const dy = f.y - this.y;
            if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minFDistSq) { minFDistSq = dSq; nearestF = f; }
        }
        this.nearestFood = nearestF;
        if (nearestF) {
            const minFDist = Math.sqrt(minFDistSq);
            let diff = Math.atan2(nearestF.y - this.y, nearestF.x - this.x) - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.inputs[0] = diff / Math.PI;
            this.inputs[1] = clamp(1 - (minFDist / maxDetectDist), 0, 1);
            this.inputs[2] = clamp(nearestF.nutrition || 0.5, 0, 1);
        } else {
            this.inputs[0] = 0; this.inputs[1] = 0; this.inputs[2] = 0;
        }

        // 2. Tumbling/Airborne Crab Sensing
        let nearestC = null, minCDistSq = maxDetectDistSq;
        for (let i = 0; i < crabs.length; i++) {
            const c = crabs[i];
            if (c.dead || !c.isAirborne) continue;
            const dx = c.x - this.x;
            const dy = c.y - this.y;
            if (Math.abs(dx) > maxDetectDist || Math.abs(dy) > maxDetectDist) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < minCDistSq) { minCDistSq = dSq; nearestC = c; }
        }
        this.nearestTumblingCrab = nearestC;
        if (nearestC) {
            const minCDist = Math.sqrt(minCDistSq);
            let diff = Math.atan2(nearestC.y - this.y, nearestC.x - this.x) - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.inputs[3] = diff / Math.PI;
            this.inputs[4] = clamp(1 - (minCDist / maxDetectDist), 0, 1);
        } else {
            this.inputs[3] = 0; this.inputs[4] = 0;
        }

        // 3. Wall Feelers
        for (let i = 0; i < this.feelerAngles.length; i++) {
            const rayAngle = this.angle + this.feelerAngles[i];
            const rayDist = this._castRayToBounds(rayAngle, this.sightDist);
            this.feelerDistances[i] = rayDist;
            this.inputs[5 + i] = clamp(1 - (rayDist / this.sightDist), 0, 1);
        }

        // 4. Hunger & Gluttony
        this.inputs[8] = clamp(this.hunger, 0, 1);
        this.inputs[9] = clamp(this.gluttony, 0, 1);

        // 5. Predator Threat (Danger Sensor)
        let minPThreat = 0;
        const threatRadius = 180;
        const threatRadiusSq = threatRadius * threatRadius;
        for (let i = 0; i < predators.length; i++) {
            const p = predators[i];
            if (p.dead) continue;
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            if (Math.abs(dx) > threatRadius || Math.abs(dy) > threatRadius) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < threatRadiusSq) {
                const d = Math.sqrt(dSq);
                const threat = (1 - (d / threatRadius)) * (p.size / 30);
                if (threat > minPThreat) minPThreat = threat;
            }
        }
        this.inputs[10] = clamp(minPThreat, 0, 1);

        // 6. Jellyfish Sanctuary & Coverage Sensing
        let maxJellyNear = 0;
        for (let i = 0; i < jellies.length; i++) {
            const j = jellies[i];
            if (j.dead) continue;
            const coverageRadius = 130 + (j.size || 22) * 2;
            const dx = j.x - this.x;
            const dy = j.y - this.y;
            if (Math.abs(dx) > coverageRadius || Math.abs(dy) > coverageRadius) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < coverageRadius * coverageRadius) {
                const d = Math.sqrt(dSq);
                const coverageFactor = (j.size || 22) / 22;
                const proximity = (1 - (d / coverageRadius)) * coverageFactor;
                if (proximity > maxJellyNear) maxJellyNear = proximity;
            }
        }
        this.inputs[11] = clamp(maxJellyNear, 0, 1);

        // 7. Overall Energy Drain Input (1.0 when thrust, steer, and gulp are maxed)
        const [steer, torque, thrust, gulp] = this.outputs;
        const steerExertion = Math.abs(steer - 0.5) * 2;
        this.energyDrainRate = clamp(thrust * 0.55 + steerExertion * 0.25 + torque * 0.15 + (gulp > 0.5 ? 0.05 : 0), 0, 1);
        this.inputs[12] = this.energyDrainRate;

        // Record rolling input snapshot for champion highlights
        this.recentInputBuffer.push(Float32Array.from(this.inputs));
        if (this.recentInputBuffer.length > 25) this.recentInputBuffer.shift();

        this.outputs = this.brain.activate(this.inputs);
    }

    /**
     * @param {number} dt 
     * @param {Array<Food>} foods 
     * @param {Array<Crab>} crabs 
     * @param {Array<PredatorFish>} predators 
     * @param {Array<Jellyfish>} jellies 
     */
    act(dt, foods = [], crabs = [], predators = [], jellies = []) {
        if (this.dead) return;

        this.age += dt;
        this.score = (this.foodEaten * 100) + Math.floor(this.age);
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        const [steer, torque, thrust, gulp] = this.outputs;
        const steerExertion = Math.abs(steer - 0.5) * 2;

        // Progressive Age Progression: Elders slow down slightly (-25%) but burn 30% less hunger!
        const ageFactor = clamp(this.age / 120, 0, 1);
        const ageMetabolicMultiplier = 1.0 - (ageFactor * 0.30);
        const ageSpeedMultiplier = 1.0 - (ageFactor * 0.25);
        const ageTurnMultiplier = 1.0 - (ageFactor * 0.20);

        // Dynamic Metabolism: Idling consumes 60% less hunger, elder fish consume 30% less basal hunger!
        const baseIdleBurn = 0.012;
        const activeOutputBurn = (thrust * 0.026 + steerExertion * 0.008 + (gulp > 0.5 ? 0.004 : 0));
        this.hunger += (baseIdleBurn + activeOutputBurn) * ageMetabolicMultiplier * dt;

        if (this.hunger >= 1.0) {
            this.dead = true;
            return;
        }

        // Slowly digest gluttony bloat
        if (this.gluttony > 0) {
            this.gluttony = Math.max(0, this.gluttony - 0.04 * dt);
        }

        // Edge-entry behavior
        if (this.enteringScreen) {
            this.x += Math.cos(this.entryDir) * 60 * dt;
            if (this.x > 25 && this.x < this.bounds.w - 25) {
                this.enteringScreen = false;
            }
            return;
        }

        // Brain Think Step
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think(foods, crabs, predators, jellies);
        }

        this.mouthOpen = gulp > 0.5;

        // Spinners eat at most 1 item per frame, and ONLY if mouth is open!
        if (this.mouthOpen) {
            const mouthRadius = this.size * 0.48;

            for (let i = 0; i < foods.length; i++) {
                const f = foods[i];
                if (f.state !== "drifting") continue;
                const maxRange = mouthRadius + f.radius;
                const dx = f.x - this.x;
                const dy = f.y - this.y;
                if (Math.abs(dx) > maxRange || Math.abs(dy) > maxRange) continue;
                if (dx * dx + dy * dy < maxRange * maxRange) {
                    f.state = "dead";
                    this.foodEaten++;
                    const nutr = f.nutrition || 0.4;
                    this.hunger = Math.max(0, this.hunger - nutr * 0.55);

                    // Gluttony accumulation if already full (> 70% full)
                    if (this.hunger < 0.30) {
                        this.gluttony = Math.min(1.0, this.gluttony + 0.30 * nutr);
                    }

                    this._captureHighlight();
                    break; // Consume at most 1 item per frame
                }
            }

            // Check eating tumbling crabs
            for (let i = 0; i < crabs.length; i++) {
                const c = crabs[i];
                if (!c.dead && c.isAirborne) {
                    const maxRange = mouthRadius + c.radius;
                    const dx = c.x - this.x;
                    const dy = c.y - this.y;
                    if (Math.abs(dx) > maxRange || Math.abs(dy) > maxRange) continue;
                    if (dx * dx + dy * dy < maxRange * maxRange) {
                        c.die();
                        this.foodEaten += 2;
                        this.hunger = Math.max(0, this.hunger - 0.6);
                        if (this.hunger < 0.30) {
                            this.gluttony = Math.min(1.0, this.gluttony + 0.45);
                        }
                        this._captureHighlight();
                        break;
                    }
                }
            }
        }

        // Gluttony Consequence: Sinking weight inertia + speed reduction (with Age Modifier)
        this.maxSpeed = this.baseMaxSpeed * (1.0 - this.gluttony * 0.25) * ageSpeedMultiplier;
        this.y += this.gluttony * 36 * dt; // Heavy downward pull when full

        // Turn mechanics
        const turnIntensity = torque * this.maxTurnSpeed * ageTurnMultiplier * dt;
        if (steer < 0.4) {
            this.angle -= turnIntensity * ((0.4 - steer) / 0.4);
        } else if (steer > 0.6) {
            this.angle += turnIntensity * ((steer - 0.6) / 0.4);
        }

        if (this.angle < 0) this.angle += Math.PI * 2;
        if (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;

        // Forward motion
        if (thrust > 0.05) {
            const speed = thrust * this.maxSpeed * dt;
            this.x += Math.cos(this.angle) * speed;
            this.y += Math.sin(this.angle) * speed;
        }

        const half = this.size / 2;
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

        // Visual Hunger & Gluttony Tweening
        const hue = lerp(195, 40, this.hunger);
        const sat = lerp(90, 20, this.hunger);
        const lum = lerp(55, 65, this.hunger);

        // Invulnerability Shield Shimmer
        if (this.invulnerableTimer > 0) {
            const shieldAlpha = (Math.sin(this.age * 12) + 1) * 0.35;
            ctx.strokeStyle = getRgba(100, 240, 255, shieldAlpha);
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size * 0.65, this.size * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = getHsl(hue, sat, lum);
        ctx.strokeStyle = getHsl(hue, sat + 5, lum + 15);
        ctx.lineWidth = 1.1;

        // Teardrop fish body (Swells slightly with gluttony bloat)
        const bloatScale = 1.0 + this.gluttony * 0.22;
        ctx.beginPath();
        ctx.ellipse(0, 0, (this.size / 2) * bloatScale, (this.size / 3.2) * bloatScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Gulping Mouth Animation
        if (this.mouthOpen) {
            ctx.fillStyle = "#0c1824";
            ctx.beginPath();
            ctx.ellipse(this.size * 0.48 * bloatScale, 0, 2.2, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Wagging tail fin
        const finSize = this.size * 0.25;
        ctx.beginPath();
        ctx.moveTo(-this.size / 2, 0);
        ctx.lineTo(-this.size / 2 - finSize, -finSize * 0.8);
        ctx.lineTo(-this.size / 2 - finSize, finSize * 0.8);
        ctx.closePath();
        ctx.fillStyle = getHsl(hue, sat, lum - 10);
        ctx.fill();

        // Eye
        const eyeRadius = Math.max(1.8, this.size * 0.12);
        const eyeOffset = this.size * 0.25;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(eyeOffset, -eyeRadius, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eyeOffset, eyeRadius, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(eyeOffset + eyeRadius * 0.4, -eyeRadius, eyeRadius * 0.5, 0, Math.PI * 2);
        ctx.arc(eyeOffset + eyeRadius * 0.4, eyeRadius, eyeRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
