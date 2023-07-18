const makeid = ((id=0) => () => id++)();
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

class Neuron {
    /**
     * 
     * @param {number | undefined} bias optional bias
     */
    constructor(bias) {
        this.id = makeid();
        this.bias = bias == undefined ? Math.random() * 2 - 1 : bias;
        this.output = 0;
    }
}

export class Network {
    /**
     * 
     * @param {number[]} layers [inputs, ...layers, outputs]
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

        if (Array.isArray(layers) && layers.length > 1) {
            this._initializeNetwork(layers);
        }
    }

    _initializeNetwork(layers) {
        this.neurons = {};
        layers.forEach((num, i) => {
            let prev_layer = i > 0 ? this.layers[i - 1] : [];
            let new_neurons = [];
            for (let i = 0; i < num; i++) {
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

        for (let i = 0; i < this.layers.length; i++) {
            this.layers[i].forEach((nid, i2) => {
                if (i == 0) {
                    // inputs
                    this.neurons[nid].output = inputs[i2];
                } else {
                    let prev_layer = this.layers[i - 1];
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

    importJSON(jstr) {
        let obj;
        try {
            obj = JSON.parse(jstr);
        } catch (_) {
            obj = {};
        }

        const { neurons, layers, weights } = obj;
        if (neurons) {
            this.neurons = neurons;
        }
        if (layers) {
            this.layers = layers;
        }
        if (weights) {
            this.weights = weights;
        }
    }

    clone() {
        const clone = new Network();
        clone.neurons = JSON.parse(JSON.stringify(this.neurons));
        clone.weights = JSON.parse(JSON.stringify(this.weights));
        clone.layers = JSON.parse(JSON.stringify(this.layers));
        return clone;
    }

    mutate(rate) {
        // Loop through all the neurons in the network
        for (let nid in this.neurons) {
            // Get the neuron object
            let neuron = this.neurons[nid];
            // Generate a random number between 0 and 1
            let r = Math.random();
            // If the random number is less than the mutation rate
            if (r < rate) {
                // Mutate the bias of the neuron by adding a small random value
                neuron.bias += Math.random() * 0.2 - 0.1;
            }
        }
        // Loop through all the weights in the network
        for (let pid in this.weights) {
            for (let cid in this.weights[pid]) {
                // Get the weight value
                let weight = this.weights[pid][cid];
                // Generate a random number between 0 and 1
                let r = Math.random();
                // If the random number is less than the mutation rate
                if (r < rate) {
                    // Mutate the weight by adding a small random value
                    weight += Math.random() * 0.2 - 0.1;
                    this.weights[pid][cid] = weight;
                }
            }
        }
    }
}
