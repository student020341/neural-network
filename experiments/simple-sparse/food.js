// Food & Carcass Entities for the Aquarium Ecosystem with Discrete Classification & Batched Rendering

// Pre-computed discrete nutrition visual tiers (100% Solid Opaque - Zero Alpha Blending)
const FOOD_TIERS = [
    // Tier 0: Settled Detritus (Earthy amber sediment)
    {
        radius: 2.2,
        fill: "#b45309",
        stroke: "#f59e0b",
        lineWidth: 0.8,
        hasGlow: false
    },
    // Tier 1: Standard Drifting (Fresh Mint Green)
    {
        radius: 2.4,
        fill: "#10b981",
        stroke: "#6ee7b7",
        lineWidth: 1.0,
        hasGlow: false
    },
    // Tier 2: Nutritious Drifting (Bright Chartreuse)
    {
        radius: 2.8,
        fill: "#84cc16",
        stroke: "#bef264",
        lineWidth: 1.0,
        ringColor: "#4d7c0f",
        hasGlow: true,
        glowRadius: 4.6
    },
    // Tier 3: Peak Bloom Drifting (Brilliant Lime)
    {
        radius: 3.3,
        fill: "#a3e635",
        stroke: "#ecfccb",
        lineWidth: 1.2,
        ringColor: "#65a30d",
        hasGlow: true,
        glowRadius: 5.8
    }
];

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
        this.isDecayed = false;
        this.groundTimer = 0;
        this.groundLifetime = 10;
        this.depthOffset = 0;
        this.time = 0;
        this.nutrition = 0.35;
        this.tier = 1; // Discrete tier: 0..3
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
            const peakDist = Math.abs(depthRatio - 0.52) / 0.52;
            this.nutrition = clamp(1.0 - Math.pow(peakDist, 1.5) * 0.72, 0.28, 1.0);

            // Discrete Nutrition Classification (Tier 1, 2, or 3)
            if (this.nutrition < 0.45) {
                this.tier = 1;
            } else if (this.nutrition < 0.75) {
                this.tier = 2;
            } else {
                this.tier = 3;
            }

            const speedFactor = lerp(1.0, 0.32, (this.nutrition - 0.28) / 0.72);
            this.fallSpeed = this.baseFallSpeed * speedFactor;

            this.y += this.fallSpeed * dt;
            this.x = this.originX + Math.sin(this.phase + this.time * this.swayFreq) * this.swayAmp;
            this.x = clamp(this.x, 8, bounds.w - 8);

            this.radius = FOOD_TIERS[this.tier].radius;

            const floorY = bounds.h - this.radius - this.depthOffset;
            if (this.y >= floorY) {
                this.y = floorY;
                this.state = "settled";
                this.isDecayed = true;
                this.nutrition = 0.25;
                this.tier = 0; // Settled Detritus
            }
        } else if (this.state === "settled") {
            this.groundTimer += dt;
            this.tier = 0;
            if (this.y > bounds.h + 15 || this.groundTimer >= this.groundLifetime) {
                this.state = "dead";
            }
        }
    }

    /**
     * Draw all active food pellets in 4 batched fill/stroke passes total
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Array<Food>} foods 
     */
    static drawBatch(ctx, foods) {
        if (!foods || foods.length === 0) return;

        // Group pellets into 4 discrete tier buckets
        const tierPellets = [[], [], [], []];
        for (let i = 0; i < foods.length; i++) {
            const f = foods[i];
            if (f.state !== "dead") {
                tierPellets[f.tier].push(f);
            }
        }

        // Pass 1: Solid outline rings for High and Peak nutrition tiers
        for (let t = 2; t <= 3; t++) {
            const group = tierPellets[t];
            if (group.length === 0) continue;
            const style = FOOD_TIERS[t];

            ctx.lineWidth = 1.0;
            ctx.strokeStyle = style.ringColor;
            ctx.beginPath();
            for (let i = 0; i < group.length; i++) {
                const f = group[i];
                ctx.moveTo(f.x + style.glowRadius, f.y);
                ctx.arc(f.x, f.y, style.glowRadius, 0, Math.PI * 2);
            }
            ctx.stroke();
        }

        // Pass 2: Core pellets per tier
        for (let t = 0; t < 4; t++) {
            const group = tierPellets[t];
            if (group.length === 0) continue;
            const style = FOOD_TIERS[t];

            ctx.beginPath();
            for (let i = 0; i < group.length; i++) {
                const f = group[i];
                ctx.moveTo(f.x + style.radius, f.y);
                ctx.arc(f.x, f.y, style.radius, 0, Math.PI * 2);
            }
            ctx.fillStyle = style.fill;
            ctx.fill();

            ctx.lineWidth = style.lineWidth;
            ctx.strokeStyle = style.stroke;
            ctx.stroke();
        }
    }

    /**
     * Fallback single instance draw
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.state === "dead") return;
        const style = FOOD_TIERS[this.tier];

        if (style.hasGlow) {
            ctx.lineWidth = 1.0;
            ctx.strokeStyle = style.ringColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, style.glowRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, style.radius, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.stroke;
        ctx.stroke();
    }
}

// Pre-computed discrete carcass decay tiers (100% Solid Opaque Colors - Zero Alpha Blending)
const CARCASS_TIERS = [
    // Tier 0: Fresh Sinking (Solid Slate Blue/Gray)
    {
        fill: "#475569",
        stroke: "#94a3b8",
        eyeStroke: "#f8fafc"
    },
    // Tier 1: Skeletal Sinking (Dark Bone Slate)
    {
        fill: "#334155",
        stroke: "#64748b",
        eyeStroke: "#cbd5e1"
    },
    // Tier 2: Settled Bone (Deep Fossil Floor Sediment)
    {
        fill: "#1e293b",
        stroke: "#475569",
        eyeStroke: "#94a3b8"
    }
];

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
        this.groundLifetime = 24; // 24s persistent floor carcass
        this.depthOffset = 0;
        this.time = 0;
        this.tier = 0; // 0: Fresh, 1: Skeletal, 2: Settled Bone
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

            this.tier = this.time < 3 ? 0 : 1;

            const floorY = bounds.h - this.radius * 0.5 - this.depthOffset;
            if (this.y >= floorY) {
                this.y = floorY;
                this.state = "settled";
                this.tier = 2;
            }
        } else if (this.state === "settled") {
            this.groundTimer += dt;
            this.tier = 2;
            if (this.y > bounds.h + 20 || this.groundTimer >= this.groundLifetime) {
                this.state = "dead";
            }
        }
    }

    /**
     * Batched Carcass Rendering in 3 passes total
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Array<Carcass>} carcasses 
     */
    static drawBatch(ctx, carcasses) {
        if (!carcasses || carcasses.length === 0) return;

        ctx.lineWidth = 1.1;

        // Group by 3 decay tiers
        const groups = [[], [], []];
        for (let i = 0; i < carcasses.length; i++) {
            const c = carcasses[i];
            if (c.state !== "dead") {
                groups[c.tier].push(c);
            }
        }

        for (let t = 0; t < 3; t++) {
            const group = groups[t];
            if (group.length === 0) continue;
            const style = CARCASS_TIERS[t];

            // 1. Carcass bodies
            ctx.beginPath();
            for (let i = 0; i < group.length; i++) {
                const c = group[i];
                ctx.moveTo(c.x + c.size * 0.45, c.y);
                ctx.ellipse(c.x, c.y, c.size * 0.45, c.size * 0.22, 0, 0, Math.PI * 2);
            }
            ctx.fillStyle = style.fill;
            ctx.fill();
            ctx.strokeStyle = style.stroke;
            ctx.stroke();

            // 2. X eyes
            ctx.beginPath();
            ctx.strokeStyle = style.eyeStroke;
            for (let i = 0; i < group.length; i++) {
                const c = group[i];
                const eyeX = c.x + c.size * 0.22;
                const eyeSize = Math.max(1.8, c.size * 0.08);
                ctx.moveTo(eyeX - eyeSize, c.y - eyeSize);
                ctx.lineTo(eyeX + eyeSize, c.y + eyeSize);
                ctx.moveTo(eyeX + eyeSize, c.y - eyeSize);
                ctx.lineTo(eyeX - eyeSize, c.y + eyeSize);
            }
            ctx.stroke();
        }
    }

    /**
     * Fallback single instance draw
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        if (this.state === "dead") return;
        const style = CARCASS_TIERS[this.tier];

        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 0.45, this.size * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.strokeStyle = style.stroke;
        ctx.stroke();

        const eyeX = this.x + this.size * 0.22;
        const eyeSize = Math.max(1.8, this.size * 0.08);
        ctx.strokeStyle = style.eyeStroke;
        ctx.beginPath();
        ctx.moveTo(eyeX - eyeSize, this.y - eyeSize);
        ctx.lineTo(eyeX + eyeSize, this.y + eyeSize);
        ctx.moveTo(eyeX + eyeSize, this.y - eyeSize);
        ctx.lineTo(eyeX - eyeSize, this.y + eyeSize);
        ctx.stroke();
    }
}
