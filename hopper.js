
// a thing that hops
class Hopper {
    constructor(x, y, bounds) {
        this.x = x;
        this.y = y;
        this.size = 40;
        this.bounds = bounds;

        // track think time
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
            0, // consideration of idle time (time without moving)
        ];
        this.outputs = [
            0, // extension of leg
        ];

        this.jumpValue = 0;

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
        const maxGroundDistanceConsideration = this.size * 4;
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
        const beforeExt = this.outputs[0]; // tracking before and after leg extension to measure a potential "jump"
        this.outputs = this.brain.activate(this.inputs);
        if (this.outputs[0] > 0.5 && this.outputs[0] > beforeExt) {
            this.jumpValue = this.outputs[0] - beforeExt;
        }
    }

    // frame update
    act(dt) {
        // think once per second
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think();
        }

        // give the frog a new neural network every 3 seconds
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

        // ground/falling logic
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
            if (this.jumpValue > 0) {
                this.yVel = -this.yVelMax * this.jumpValue;
            }
        } else {
            this.idle = 0;
        }

        this.jumpValue = 0;
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
