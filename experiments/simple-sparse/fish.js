// a turny fish thing with sparse neural network
class TurnFish {
    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {Object} bounds 
     */
    constructor(x, y, bounds) {
        this.x = x;
        this.y = y;
        this.bounds = bounds;
        this.name = uid("Fish");
        this.size = 40;

        // think constraints
        this.acc = 0;
        this.accMax = 0.3;

        //
        this.angle = 0;
        this.brainFarts = 0;

        this.inputs = [
            0, // orientation
        ];

        this.outputs = [
            0, // steering (0-0.3 left, 0.3-0.6 noop, 0.6-1 right)
            0, // turn speed
            0, // forward motion
        ];

        this._initBrain();
        this.think();
    }

    _initBrain() {
        this.brain = new SparseNetwork({
            name: this.name,
            numInputs: this.inputs.length,
            numOutputs: this.outputs.length,
            initialHidden: 4,
            initialConnectivity: 1,
            inputLabels: ["Angle"],
            outputLabels: ["Turn", "Torque", "Thrust"]
        });
    }

    onResize(canvas) {
        this.bounds = { w: canvas.width || canvas.w, h: canvas.height || canvas.h };
    }

    think() {
        // normalize radian angle, value clamped in act
        this.inputs[0] = this.angle / (Math.PI * 2);

        this.outputs = this.brain.activate(this.inputs);
    }

    act(dt) {
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think();
        }

        const [turn, turnSpeed, thrust] = this.outputs;

        // turn
        const ts = turnSpeed * Math.PI * 2 * dt;
        if (turn < 0.3) {
            this.angle -= ts;
            if (this.angle < 0) {
                this.angle += Math.PI * 2;
            }
        } else if (turn > 0.6) {
            this.angle += ts;
            if (this.angle > Math.PI * 2) {
                this.angle -= Math.PI * 2;
            }
        }

        // TODO
        // move
        if (thrust > 0.25) {
            this.x += Math.cos(this.angle) * thrust * 60 * dt;
            this.y += Math.sin(this.angle) * thrust * 60 * dt;
        }

        // constrain to bounds
        this.x = clamp(this.x, 0, this.bounds.w - this.size);
        this.y = clamp(this.y, 0, this.bounds.h - this.size);
    }

    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        // draw fish body and outline
        ctx.beginPath();
        ctx.fillStyle = "#00aaff";
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#00eeff";
        ctx.stroke();

        // draw eye
        ctx.fillStyle = "black"
        ctx.fillRect(
            -5 + this.x + Math.cos(this.angle) * 10, 
            -5 + this.y + Math.sin(this.angle) * 10,
            10, 
            10
        );
    }
}
