import { v4 as uuid } from "uuid";

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const _sigmoid = (x) => sigmoid(x) * (1 - sigmoid(x));
const cmpsyn = (s, a, b) => (s.a == a && s.b == b) || (s.a == b && s.b == a);

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

class Synapse {
    constructor(a, b, weight) {
        /** @type string | null */
        this.a = a || null;
        /** @type string | null */
        this.b = b || null;
        /** @type number */
        this.weight = weight == undefined ? Math.random() * 2 - 1 : weight;
    }
}

class Network {
    /**
     * 
     * @param {number} inputs number of inputs
     * @param {number} outputs number of outputs
     */
    constructor(inputs, outputs) {
        /** @type Object<string,Neuron> */
        this.neurons = {};
        /** @type Array<Synapse> */
        this.synapses = [];

        /** @type Array<Array<Synapse>>
         * 
         * sequence of nodes to activate
         */
        this.phases = [];

        this._initializeNetwork(inputs, outputs);
    }

    _initializeNetwork(num_in, num_out) {
        this.neurons = {};
        this.synapses = [];
        this.phases = [];

        const inputs = Array.from(new Array(num_in)).map(() => new Neuron());
        const outputs = Array.from(new Array(num_out)).map(() => new Neuron());

        // set network neurons
        this.neurons = [...inputs, ...outputs].reduce((acc, next) => Object.assign(acc, { [next.id]: next }), {});
        // create initial synapses straight from inputs to outputs
        this.synapses = this.denseConnect(inputs, outputs);
    }

    getSynapseIndex(a, b) {
        return this.synapses.findIndex(s => cmpsyn(s, a, b));
    }

    getSynapseIndexByAEnd(a) {
        return this.synapses.reduce((acc, next, index) => {
            if (next.a == a) {
                acc.push(index);
            }
            return acc;
        }, []);
    }

    getSynapseIndexByBEnd(b) {
        return this.synapses.reduce((acc, next, index) => {
            if (next.b == b) {
                acc.push(index);
            }
            return acc;
        }, []);
    }

    /**
     * connect all neurons in col1 to col2
     * 
     * @param {Neuron[]} col1 
     * @param {Neuron[]} col2 
     * @returns 
     */
    denseConnect(col1, col2) {
        let syn = [];

        col1.forEach(n1 => {
            col2.forEach(n2 => {
                syn.push(new Synapse(n1.id, n2.id));
            });
        });

        return syn;
    }

    // returns true if new synapse is made
    connect(a, b, weight) {
        // prevent connection to inputs, because inputs are defined as not existing as any synapse b end
        const inputs = this.getInputs();
        if (inputs.includes(b)) {
            return false;
        }

        // prevent connection to outputs, because outputs are defined as not existing as any synapse a end
        const outputs = this.getOutputs();
        if (outputs.includes(a)) {
            return false;
        }

        const existing = this.getSynapseIndex(a, b);
        if (existing != -1) {
            return false;
        }

        this.synapses.push(new Synapse(a, b, weight));
        return true;
    }

    // returns list of all neurons that are not directly connected
    getNotConnected() {
        // TODO this needs to also check that infinite loops aren't created
        const all_neurons = Object.keys(this.neurons);
        const not_connected = [];
        for(let i = 0;i < all_neurons.length-1;i++) {
            for(let j = i+1;j < all_neurons.length; j++) {
                const n1 = all_neurons[i];
                const n2 = all_neurons[j];
                const existing_synapse = this.getSynapseIndex(n1, n2);
                if (existing_synapse == -1) {
                    not_connected.push([n1, n2]);
                }
            }
        }
        return not_connected;
    }

    /**
     * 
     * @param {number} si index of synapse to split
     * @param {number | undefined} bias
     * @param {number | undefined} weightA weight from neuron A to new neuron, undefined to use existing
     * @param {number | undefined} weightB weight from new neuron to B neuron, undefined to use existing
     */
    insertNeuron(si, bias, weightA, weightB) {
        const w1 = weightA == undefined ? this.synapses[si].weight : weightA;
        const w2 = weightB == undefined ? this.synapses[si].weight : weightB;
        // get synapse and remove it from list
        const [synapse] = this.synapses.splice(si, 1);
        // create 2 new synapses with new neuron at center
        const n = new Neuron(bias);
        this.neurons[n.id] = n;
        this.synapses.push(
            new Synapse(synapse.a, n.id, w1),
            new Synapse(n.id, synapse.b, w2)
        );

        return n;
    }

    // an input is a neuron that has outputs but no inputs
    getInputs() {
        return Object.keys(this.neurons).filter(id => !this.synapses.some(s => s.b == id));
    }

    //
    getOutputs() {
        return Object.keys(this.neurons).filter(id => !this.synapses.some(s => s.a == id));
    }

    // compute and cache phases, the sequence to look up and activate neurons without repeated filter calls to the synapses array on every call
    computePhases() {
        let phase = this.getInputs();
        let phases = [phase];
        while (phase.length > 0) {
            phase = Array.from(new Set(this.synapses.filter(s => phase.some(p => p == s.a)).map(s => s.b)));
            // console.log({phase});
            // console.log({phases});
            if (phases.some(p => {
                if (p.length == phase.length) {
                    for (let i = 0;i < p.length;i++) {
                        if (p[i] != phase[i]) {
                            return false;
                        }
                    }
                    return true;
                }
                return false;
            })) {
                break;
            }
            if (phase.length > 0) {
                phases.push(phase);
            }
        }

        this.phases = phases;
        return this.phases;
    }

    /**
     * 
     * @param {number[]} inputs array of input values for the input nodes
     */
    activate(inputs) {
        const input_nodes = this.getInputs();
        if (inputs.length != input_nodes.length) {
            console.log("input length does not match number of inputs");
            return;
        }
        
        // activate inputs
        input_nodes.forEach((inode, i) => {
            this.neurons[inode]._output = 1;
            this.neurons[inode].output = inputs[i];
        });

        // activate hidden layers, following phases

        // activate outputs
        let neurons = [];
    }
}

const gt = new Network(2, 1);

// randomly add new neurons to split synapses and also randomly add new connections
for (let i = 20; i > 0; i--) {
    const randomSynapseIndex = Math.floor(Math.random() * gt.synapses.length);
    // console.log(`split synapse ${gt.synapses[randomSynapseIndex].a}->${gt.synapses[randomSynapseIndex].b}`);
    gt.insertNeuron(randomSynapseIndex);

    const not_connected = gt.getNotConnected();
    const random_candidate = Math.floor(Math.random() * not_connected.length);
    const [pair] = not_connected.splice(random_candidate, 1);
    // console.log(`connect ${pair[0]} to ${pair[1]}`);
    gt.connect(pair[0], pair[1]);
}

// recompute
gt.computePhases();

// activate
gt.activate([0.2, 0.6]);

//
gt.phases.forEach((p, i) => {
    console.log(i, p);
});
console.log("\n\n");
gt.synapses.forEach((s, i) => {
    console.log(i, s);
});
