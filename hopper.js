
// a thing that hops
class Hopper {
    constructor(x, y, bounds) {
        this.x = x;
        this.y = y;
        this.size = 40;
        this.bounds = bounds;

        this.accMax = 0.1;
        this.acc = 0;

        // every 3 seconds, scramble the brain
        this.brainScrambleMax = 3;
        this.brainScramble = 0;

        this.yVelMax = 300;
        this.yVel = 0;

        this.idleMax = 2;
        this.idle = 0;

        // nn related properties
        this.inputs = [
            0, // consideration of distance to ground
            0, // consideration of falling velocity
            0, // consideration of idle time
        ];
        this.outputs = [
            0, // extension of leg
        ];

        this.shouldJump = false;

        this.brain = new Network([
            this.inputs.length,
            Math.max(this.inputs.length, this.outputs.length) + 1,
            this.outputs.length
        ]);

        this.think();
    }

    onResize(canvas) {
        this.bounds = { w: canvas.width, h: canvas.height };
    }

    think() {
        // consider distance to ground
        const maxGroundDistanceConsideration = this.size * 2;
        const distanceToGround = Math.abs(this.bounds.h - this.y);
        const normalizedDistanceToGround = clamp(distanceToGround / maxGroundDistanceConsideration, 0, 1);
        this.inputs[0] = normalizedDistanceToGround;

        // consider falling velocity
        const normalizedFallingVelocity = clamp(this.yVel / this.yVelMax, 0, 1);
        this.inputs[1] = normalizedFallingVelocity;

        // consider idle time
        const normalizedIdleTime = clamp(this.idle / this.idleMax, 0, 1);
        this.inputs[2] = normalizedIdleTime;

        // activate
        const beforeExt = this.outputs[0];
        this.outputs = this.brain.activate(this.inputs);
        this.shouldJump = this.outputs[0] > beforeExt; // leg has extended
    }

    // frame update
    act(dt) {
        // think once per second
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think();
        }

        this.brainScramble += dt;
        if (this.brainScramble >= this.brainScrambleMax) {
            this.brainScramble = 0;
            this.brain = new Network([
                this.inputs.length,
                Math.max(this.inputs.length, this.outputs.length) + 1,
                this.outputs.length
            ])
        }

        // leg extension for other calculations
        const legExt = this.outputs[0] * this.size * 2; // hopper leg is 2x body size

        // ground logic
        if (this.y + this.size + legExt > this.bounds.h) {
            // ground / grounded
            this.y = this.bounds.h - this.size - legExt;
            this.yVel = 0;
        } else if (this.y < this.bounds.h - this.size - legExt || this.yVel < 0) {
            // falling or jumping
            this.yVel += dt * 98;
            this.yVel = clamp(this.yVel, -this.yVelMax, this.yVelMax);
            this.y += this.yVel * dt;
        }

        if (Math.abs(this.yVel) < 0.1) {
            this.idle = clamp(this.idle + dt, 0, this.idleMax);
            if (this.shouldJump) {
                this.yVel = -this.yVelMax * this.outputs[0];
            }
        } else {
            this.idle = 0;
        }

        this.shouldJump = false;
    }

    /**
     * draw a little green hopper
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        // draw body
        ctx.fillStyle = "green";
        ctx.fillRect(this.x, this.y, this.size, this.size);

        // draw leg
        ctx.strokeStyle = "green";
        const legExt = this.outputs[0] * this.size * 2;
        ctx.strokeRect(this.x, this.y+this.size, this.size, legExt);

        // draw neural net
        ctx.strokeStyle = "white";
        ctx.fillStyle = "white";
        for(let i = 0;i < this.inputs.length;i++) {
            ctx.fillRect(
                this.x + this.size + 4,
                this.y + i * 6,
                this.size * this.inputs[i],
                4
            );
            ctx.strokeRect(
                this.x + this.size + 4,
                this.y + i * 6,
                this.size,
                4
            );
        }

        for(let i = 0;i < this.outputs.length;i++) {
            const oi = i + this.inputs.length;
            ctx.fillRect(
                this.x + this.size + 4,
                this.y + oi * 6,
                this.size * this.outputs[i],
                4
            );
            ctx.strokeRect(
                this.x + this.size + 4,
                this.y + oi * 6,
                this.size,
                4
            );
        }
    }
}
