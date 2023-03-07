import { v4 as uuid } from "uuid";

// copy of neural network class from js project with training related stuff removed

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

class Neuron {
    /**
     * 
     * @param {number | undefined} bias optional bias
     */
    constructor(bias) {
        this.id = uuid();
        this.bias = bias == undefined ? Math.random() * 2 - 1 : bias;
        this.output = 0;
    }
}

export class Network {
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
                    this.neurons[nid].output = inputs[i2];
                } else {
                    let prev_layer = this.layers[i-1];
                    let upstream_total = 0;
                    prev_layer.forEach(upid => {
                        upstream_total += this.neurons[upid].output * this.weights[upid][nid];
                    });

                    this.neurons[nid].output = sigmoid(upstream_total);
                }
            });
        }

        // return outputs
        return this.layers[this.layers.length - 1].map(id => this.neurons[id].output);
    }
}
