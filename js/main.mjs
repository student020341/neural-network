// import { v4 as uuid } from "uuid";

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const _sigmoid = (x) => sigmoid(x) * (1 - sigmoid(x));

const names = Array.from("abcdefghijklmnopqrstuvwxyz").reduce((acc, char) => {
    return acc.concat(Array.from(new Array(50)).map((_, n) => char + `${1 + n}`));
}, []);

class Neuron {
    /**
     * 
     * @param {number | undefined} bias optional bias
     */
    constructor(bias) {
        // this.id = uuid();
        this.id = names.shift();
        this.bias = bias == undefined ? Math.random() * 2 - 1 : bias;
        this.output = 0;
        this._output = 0;
        this.error = 0;
    }
}

class Network {
    /**
     * 
     * @param {number} inputs number of inputs
     * @param {number} outputs number of outputs
     * @param {number[]} hidden hidden layers
     */
    constructor(layers) {

        /** @type Object<string,Neuron> */
        this.neurons = {};

        // first layer is input, last layer is output, middle layers are hidden
        /** @type string[][] */
        this.layers = [];

        // weights[a][b]->weight
        /** @type Object<string, Object<string, number>> */
        this.weights = {};

        this._initializeNetwork(layers);
    }

    _initializeNetwork(layers) {
        this.neurons = {};
        layers.forEach((num, i) => {
            let prev_layer = i > 0 ? this.layers[i - 1] : [];
            let new_neurons = [];
            for(let i = 0;i < num;i++) {
                const n = new Neuron();
                this.neurons[n.id] = n;
                new_neurons.push(n.id);

                // weights
                prev_layer.forEach(pid => {
                    if (!this.weights[pid]) {
                        this.weights[pid] = {};
                    }
                    this.weights[pid][n.id] = Math.random() * 2 - 1;
                });
            }
            this.layers.push(new_neurons);
        });
    }

    /**
     * 
     * @param {number[]} inputs array of input values for the input nodes
     */
    activate(inputs) {
        if (inputs.length != this.layers[0].length) {
            console.log(`have ${this.layers[0].length} input neurons but got ${inputs.length} inputs`);
            return;
        }

        for (let i = 0;i < this.layers.length;i++) {
            this.layers[i].forEach((nid, i2) => {
                if (i == 0) {
                    // inputs
                    this.neurons[nid]._output = 1;
                    this.neurons[nid].output = inputs[i2];
                } else {
                    let prev_layer = this.layers[i-1];
                    let upstream_total = 0;
                    prev_layer.forEach(upid => {
                        upstream_total += this.neurons[upid].output * this.weights[upid][nid];
                    });

                    this.neurons[nid].output = sigmoid(upstream_total);
                    this.neurons[nid]._output = _sigmoid(upstream_total);
                }
            });
        }

        // return outputs
        return this.layers[this.layers.length - 1].map(id => this.neurons[id].output);
    }

    //
    propagate(targets, rate = 0.3) {
        if (this.layers[this.layers.length-1].length != targets.length) {
            console.log(`have ${this.layers[this.layers.length-1].length} output neurons but got ${targets.length} targets`);
            return;
        }

        for (let i = this.layers.length-1;i >= 0; i--) {
            this.layers[i].forEach((nid, i2) => {
                if (i == this.layers.length-1) {
                    // outputs
                    const sum = this.neurons[nid].output - targets[i2];
                    this.neurons[nid].error = sum * this.neurons[nid]._output;
                    this.neurons[nid].bias -= rate * this.neurons[nid].error;
                } else {
                    let next_layer = this.layers[i + 1];
                    let downstream_total = 0;
                    next_layer.forEach(dnip => {
                        const new_weight = this.weights[nid][dnip] - rate * this.neurons[dnip].error * this.neurons[nid].output;
                        this.weights[nid][dnip] = new_weight;
                        downstream_total += new_weight * this.neurons[dnip].error;
                    });

                    this.neurons[nid].error = downstream_total * this.neurons[nid]._output;
                    this.neurons[nid].bias -= rate * this.neurons[nid].error;
                }
            });
        }
    }

    //
    train(data, iter){
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                let temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
        }
        while(iter > 0) {
            shuffle(data);
            data.forEach((d) => {
                this.activate(d.inputs);
                this.propagate(d.outputs);
            });
            iter--;
        }
    }
}

// example of making a simple 2 x 3 x 1 dense network that approximates a "greater than" algorithm
// train
// const gtTrainingData = [];
// for (let i = 0; i < 1; i += 0.01) {
//   for (let z = 0; z < 1; z += 0.1) {
//     gtTrainingData.push({
//       inputs: [i, z],
//       outputs: [i > z ? 1 : 0]
//     });
//   }
// }

// const gt = new Network([2, 3, 1]);
// gt.train(gtTrainingData, 10);

// [
//     [0.5, 0.2],
//     [0.2, 0.4],
//     [0.1, 0.9],
//     [1, 0]
// ].forEach(([a, b]) => console.log(gt.activate([a, b])));
