// Food & Carcass Entities for the Aquarium Ecosystem

class Food {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     */
    constructor(x, y, bounds) {
        this.x = x;
        this.y = y;
        this.bounds = bounds;
        this.baseRadius = 2.5;
        this.radius = 2.5;
        this.originX = x;
        this.phase = Math.random() * Math.PI * 2;
        this.baseFallSpeed = randRange(30, 38);
        this.swayAmp = randRange(10, 18);
        this.swayFreq = randRange(2.5, 3.8);
        this.state = "drifting"; // "drifting" | "settled" | "dead"
        this.isDecayed = false; // becomes decayed detritus once settled
        this.groundTimer = 0;
        this.groundLifetime = 10; // 10s on floor before decomposing
        this.depthOffset = 0; // for seafloor sediment sinking
        this.time = 0;

        // Dynamic Nutrition Value (0.25 to 1.0, peaking around depth 0.5 - 0.6)
        this.nutrition = 0.35;
    }

    /**
     * @param {number} dt 
     * @param {Object} bounds 
     */
    update(dt, bounds) {
        this.time += dt;
        this.bounds = bounds;

        if (this.state === "drifting") {
            const depthRatio = clamp(this.y / Math.max(1, bounds.h), 0, 1);
            
            // Peak nutrition curve around depth 0.52 (top 0.5 - 0.6 of tank)
            const peakDist = Math.abs(depthRatio - 0.52) / 0.52;
            this.nutrition = clamp(1.0 - Math.pow(peakDist, 1.5) * 0.72, 0.28, 1.0);

            // Fall speed inverse to nutrition (slows down to 1/3 speed near nutrition peak)
            const speedFactor = lerp(1.0, 0.32, (this.nutrition - 0.28) / 0.72);
            this.fallSpeed = this.baseFallSpeed * speedFactor;

            this.y += this.fallSpeed * dt;
            this.x = this.originX + Math.sin(this.phase + this.time * this.swayFreq) * this.swayAmp;
            this.x = clamp(this.x, 8, bounds.w - 8);

            this.radius = this.baseRadius * (0.85 + this.nutrition * 0.45);

            const floorY = bounds.h - this.radius - this.depthOffset;
            if (this.y >= floorY) {
                this.y = floorY;
                this.state = "settled";
                this.isDecayed = true;
                this.nutrition = 0.25;
            }
        } else if (this.state === "settled") {
            this.groundTimer += dt;
            // Floor sinking below screen
            if (this.y > bounds.h + 15 || this.groundTimer >= this.groundLifetime) {
                this.state = "dead";
            }
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.state === "dead") return;

        if (this.state === "drifting") {
            // High nutrition bloom: larger, glowing chartreuse-emerald pellet
            const normNutr = (this.nutrition - 0.28) / 0.72;
            const glow = (Math.sin(this.time * 6 + this.phase) + 1) * (1.2 + normNutr * 2.2);

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + glow, 0, Math.PI * 2);
            ctx.fillStyle = getRgba(130, 255, 100, 0.15 + normNutr * 0.28);
            ctx.fill();

            // Core pellet (shifts from soft mint to brilliant golden chartreuse)
            const hue = lerp(155, 85, normNutr);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = getHsl(hue, 100, lerp(55, 68, normNutr));
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = getHsl(hue, 100, 88);
            ctx.stroke();
        } else {
            // Settled decayed detritus: earthy amber tone fading over 10s
            const fade = Math.max(0.1, 1 - (this.groundTimer / this.groundLifetime));
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * (0.8 + 0.2 * fade), 0, Math.PI * 2);
            ctx.fillStyle = getRgba(180, 140, 60, fade * 0.9);
            ctx.fill();
            ctx.strokeStyle = getRgba(220, 180, 90, fade * 0.6);
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
    }
}

class Carcass {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     * @param {string} species 
     * @param {Object} bounds 
     */
    constructor(x, y, size, species, bounds) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.species = species;
        this.bounds = bounds;
        this.radius = size * 0.4;
        this.sinkSpeed = randRange(14, 22);
        this.swayPhase = Math.random() * Math.PI * 2;
        this.state = "sinking"; // "sinking" | "settled" | "dead"
        this.groundTimer = 0;
        this.groundLifetime = 14; // 14s on floor before decomposing
        this.depthOffset = 0;
        this.time = 0;
    }

    /**
     * @param {number} dt 
     * @param {Object} bounds 
     */
    update(dt, bounds) {
        this.time += dt;
        this.bounds = bounds;

        if (this.state === "sinking") {
            this.y += this.sinkSpeed * dt;
            this.x += Math.sin(this.time * 2 + this.swayPhase) * 4 * dt;
            this.x = clamp(this.x, this.radius, bounds.w - this.radius);

            const floorY = bounds.h - this.radius * 0.5 - this.depthOffset;
            if (this.y >= floorY) {
                this.y = floorY;
                this.state = "settled";
            }
        } else if (this.state === "settled") {
            this.groundTimer += dt;
            if (this.y > bounds.h + 20 || this.groundTimer >= this.groundLifetime) {
                this.state = "dead";
            }
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.state === "dead") return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const fade = this.state === "settled"
            ? Math.max(0.1, 1 - (this.groundTimer / this.groundLifetime))
            : 1.0;

        ctx.strokeStyle = getRgba(160, 175, 190, fade * 0.6);
        ctx.fillStyle = getRgba(100, 115, 130, fade * 0.35);
        ctx.lineWidth = 1.1;

        // Upside-down skeletal silhouette
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.45, this.size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // X for eyes (deceased indicator)
        const eyeX = this.size * 0.22;
        const eyeSize = Math.max(1.8, this.size * 0.08);
        ctx.strokeStyle = getRgba(220, 230, 240, fade * 0.8);
        ctx.beginPath();
        ctx.moveTo(eyeX - eyeSize, -eyeSize); ctx.lineTo(eyeX + eyeSize, eyeSize);
        ctx.moveTo(eyeX + eyeSize, -eyeSize); ctx.lineTo(eyeX - eyeSize, eyeSize);
        ctx.stroke();

        ctx.restore();
    }
}
