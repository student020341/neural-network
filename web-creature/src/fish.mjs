import { Network } from "./network.mjs";

// TODO utils and vectors

const radVec = (a) => [Math.cos(a), Math.sin(a)];

const maxFishSpeed = 100;
const maxFishIdle = 5;
const maxAngle = Math.PI * 2;

export default class Fish {
    constructor(size, layers, thought_delay) {
        // spawn somewhere along the middle-bottom
        this.position = {
            x: Math.random() * 800,
            y: 300 + Math.random() * 200
        };

        this.dir = 0;
        this.accel = 0;
        this.accel_speed = maxFishSpeed / 10;
        this.decel = maxFishSpeed / 20;

        this.size = size;
        this.brainCooldownMax = thought_delay;
        this.motivation = this.brainCooldownMax; // allow initial activation
        this.flag_dead = false; // used in main loop

        /**
         * actual literal brain, poggers
         * 
         * inputs
         *  idle time (0 = doing something, 1 = approaching idle limit)
         *  direction in radians (0 to 1, 0 to 2pi)
         *  accel (0 to 1 accel vs max)
         * 
         * outputs
         *  turn (0 to 0.5 left, 0.5 to 1 right)
         *  move forward (0 to 1 % speed)
         * 
         */
        this.brain = new Network([4, ...layers, 2]);

        // concern related
        //
        //
        this.idle_time = 0;
        this.boring_time = 0;
        this.boring_pos = { x: this.position.x, y: this.position.y };

        this.concerns = {
            idle: 0,
            direction: 0,
            accel: 0,
            boring: 0
        };
    }

    /**
     * 
     * @param {any} target something with a position (x,y)
     */
    doSomething(dt) {
        // every frame
        //
        //
        this.exist(dt);

        // think
        //
        //
        this.motivation += dt;
        if (this.motivation <= this.brainCooldownMax) {
            return;
        }
        this.motivation = 0; // TODO random?
        this.beConcernedAboutThings(dt);

        const brain_stuff = this.brain.activate([
            this.concerns.idle,
            this.concerns.direction,
            this.concerns.accel,
            this.concerns.boring
        ]);

        // do something with brain output
        //
        //
        this.interpretBrain(brain_stuff);
    }

    //
    exist(dt) {
        // move
        if (this.accel > 0) {
            const [mx, my] = radVec(this.dir);
            this.position.x += mx * this.accel * dt;
            this.position.y += my * this.accel * dt;
            this.accel -= this.decel * dt;
            this.idle_time = 0;
        } else {
            // death if idle too long
            this.idle_time += dt;
            if (this.idle_time >= maxFishIdle) {
                this.flag_dead = true;
            }
        }

        // strive for more than swimming into a wall
        if (Math.abs(this.position.x - this.boring_pos.x) > this.size || Math.abs(this.position.y - this.boring_pos.y) > this.size) {
            this.boring_time = 0;
            this.boring_pos.x = this.position.x;
            this.boring_pos.y = this.position.y;
        } else {
            // death if boring too long
            this.boring_time += dt;
            if (this.boring_time >= maxFishIdle) {
                this.flag_dead = true;
            }
        }

        // keep within bounds
        if (this.position.x < 0) {
            this.position.x = 0;
        } else if (this.position.x > 800 - this.size) {
            this.position.x = 800 - this.size;
        }

        if (this.position.y < 0) {
            this.position.y = 0;
        } else if (this.position.y > 600 - this.size) {
            this.position.y = 600 - this.size;
        }
    }

    // concern functions
    //
    //
    beConcernedAboutThings() {
        //
        this.concerns.idle = 1 - ((maxFishIdle - this.idle_time) / maxFishIdle);
        this.concerns.direction = 1 - ((maxAngle - this.dir) / maxAngle);
        this.concerns.accel = 1 - ((maxFishSpeed - this.accel) / maxFishSpeed);
        this.concerns.boring = 1 - ((maxFishIdle - this.boring_time) / maxFishIdle);
    }

    //
    interpretBrain(outputs) {
        const [turn, move_forward] = outputs;
        // turning
        if (turn < 0.4) {
            this.dir -= 0.2;
            if (this.dir < 0) {
                this.dir += maxAngle;
            }
        } else if (turn > 0.6) {
            this.dir += 0.2;
            if (this.dir > maxAngle) {
                this.dir -= maxAngle;
            }
        }

        // move forward
        this.accel += move_forward * this.accel_speed;
        if (this.accel > maxFishSpeed) {
            this.accel = maxFishSpeed;
        }
    }

    /** draw the fish
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        const half_size = this.size / 2;
        const quarter_size = this.size / 4;
        const x_off = this.position.x + half_size;
        const y_off = this.position.y + half_size;

        // idle concern
        ctx.fillStyle = `rgba(0, 0, 0, ${this.concerns.idle})`;
        ctx.beginPath();
        ctx.arc(x_off, y_off, half_size, 0, Math.PI * 2);
        ctx.fill();

        // body outline
        ctx.beginPath();
        ctx.arc(x_off, y_off, half_size, 0, Math.PI * 2);
        ctx.stroke();

        // draw direction
        const [dirX, dirY] = radVec(this.dir);
        ctx.strokeRect(x_off + quarter_size * dirX, y_off + quarter_size * dirY, 12, 12);
    }
}
