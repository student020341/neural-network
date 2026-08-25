/**
 * Dense (Fully-Connected) Feedforward Neural Network
 * Optimized with contiguous TypedArrays and zero-allocation forward passes.
 */
class DenseNetwork {
    /**
     * @param {number[]} layers [inputs, ...hiddenLayers, outputs]
     */
    constructor(layers) {
        if (layers && typeof layers === 'object' && !Array.isArray(layers)) {
            this.name = layers.name || "";
            this.inputLabels = layers.inputLabels || null;
            this.outputLabels = layers.outputLabels || null;
            layers = layers.layerSizes || layers.layers || [];
        }
        this.layerSizes = Array.isArray(layers) ? [...layers] : [];
        this.weights = [];
        this.biases = [];
        this.activations = [];

        if (this.layerSizes.length > 1) {
            this._initializeNetwork(this.layerSizes);
        }
    }

    _initializeNetwork(layers) {
        this.layerSizes = [...layers];
        this.weights = [];
        this.biases = [];
        this.activations = [];

        // Preallocate activation buffers for each layer (prevents garbage collection during activate)
        for (let i = 0; i < layers.length; i++) {
            this.activations.push(new Float32Array(layers[i]));
        }

        // Initialize weights and biases between adjacent layers
        for (let l = 0; l < layers.length - 1; l++) {
            const inSize = layers[l];
            const outSize = layers[l + 1];

            // Flat 1D weights array of size (outSize * inSize)
            const w = new Float32Array(outSize * inSize);
            for (let i = 0; i < w.length; i++) {
                w[i] = Math.random() * 2 - 1;
            }
            this.weights.push(w);

            // Biases for output neurons in layer l + 1
            const b = new Float32Array(outSize);
            for (let i = 0; i < b.length; i++) {
                b[i] = Math.random() * 2 - 1;
            }
            this.biases.push(b);
        }
    }

    /**
     * Re-randomize all synaptic weights and neuron biases.
     */
    scramble() {
        for (let l = 0; l < this.weights.length; l++) {
            const w = this.weights[l];
            for (let i = 0; i < w.length; i++) {
                w[i] = Math.random() * 2 - 1;
            }
            const b = this.biases[l];
            for (let i = 0; i < b.length; i++) {
                b[i] = Math.random() * 2 - 1;
            }
        }
    }

    _initWeights() {
        this.scramble();
    }

    /**
     * Highly optimized forward feed calculation.
     * Zero memory allocations / garbage collection during execution.
     * 
     * @param {number[] | Float32Array} inputs array of input values for the input nodes
     * @returns {Float32Array} output layer activations
     */
    activate(inputs) {
        const numLayers = this.layerSizes.length;
        if (numLayers < 2) return null;

        const inputSize = this.layerSizes[0];
        if (inputs.length !== inputSize) {
            console.warn(`Expected ${inputSize} input neurons but got ${inputs.length}`);
            return null;
        }

        // Copy inputs into the first layer's activation buffer
        const inputLayer = this.activations[0];
        for (let i = 0; i < inputSize; i++) {
            inputLayer[i] = inputs[i];
        }

        // Forward feed through each layer
        for (let l = 0; l < numLayers - 1; l++) {
            const prevLayer = this.activations[l];
            const nextLayer = this.activations[l + 1];
            const inSize = this.layerSizes[l];
            const outSize = this.layerSizes[l + 1];
            const w = this.weights[l];
            const b = this.biases[l];
            const isOutputLayer = (l === numLayers - 2);

            let weightIdx = 0;
            for (let i = 0; i < outSize; i++) {
                let total = b[i]; // Start with the neuron's bias
                for (let j = 0; j < inSize; j++) {
                    total += prevLayer[j] * w[weightIdx++];
                }
                
                if (isOutputLayer) {
                    // Fast Sigmoid: smooth algebraic S-curve in (0, 1), no Math.exp
                    nextLayer[i] = 0.5 + 0.5 * (total / (1 + (total < 0 ? -total : total)));
                } else {
                    // Hidden layers: Fast Tanh (smooth bounded [-1, 1], zero-allocation)
                    nextLayer[i] = total / (1 + (total < 0 ? -total : total));
                }
            }
        }

        // Return the final layer activations directly (supports [out0, out1] destructuring and index access)
        return this.activations[numLayers - 1];
    }

    /**
     * Fast deep copy of network parameters using raw memory copy.
     * @returns {DenseNetwork}
     */
    clone() {
        const cloneNet = new DenseNetwork({
            layerSizes: this.layerSizes,
            name: this.name,
            inputLabels: this.inputLabels ? [...this.inputLabels] : null,
            outputLabels: this.outputLabels ? [...this.outputLabels] : null
        });
        for (let l = 0; l < this.weights.length; l++) {
            cloneNet.weights[l].set(this.weights[l]);
            cloneNet.biases[l].set(this.biases[l]);
        }
        return cloneNet;
    }

    /**
     * Randomly mutate weights and biases in-place.
     * @param {number} rate Probability of each weight/bias mutating [0, 1]
     * @param {number} strength Max range of perturbation (default: 0.2)
     */
    mutate(rate, strength = 0.2) {
        const halfStrength = strength / 2;

        // Mutate weights
        for (let l = 0; l < this.weights.length; l++) {
            const w = this.weights[l];
            for (let i = 0; i < w.length; i++) {
                if (Math.random() < rate) {
                    w[i] += Math.random() * strength - halfStrength;
                }
            }
        }

        // Mutate biases
        for (let l = 0; l < this.biases.length; l++) {
            const b = this.biases[l];
            for (let i = 0; i < b.length; i++) {
                if (Math.random() < rate) {
                    b[i] += Math.random() * strength - halfStrength;
                }
            }
        }
    }

    /**
     * Export network structure and weights as a serializable JSON object.
     */
    toJSON() {
        return {
            type: 'DenseNetwork',
            name: this.name,
            inputLabels: this.inputLabels,
            outputLabels: this.outputLabels,
            layerSizes: this.layerSizes,
            weights: this.weights.map(w => Array.from(w)),
            biases: this.biases.map(b => Array.from(b)),
        };
    }

    /**
     * Import JSON configuration into this network.
     * @param {string | object} jsonStr
     */
    importJSON(jsonStr) {
        let obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (!obj || !obj.layerSizes) return;

        this.name = obj.name || this.name;
        this.inputLabels = obj.inputLabels || this.inputLabels;
        this.outputLabels = obj.outputLabels || this.outputLabels;
        this._initializeNetwork(obj.layerSizes);
        if (obj.weights) {
            for (let l = 0; l < obj.weights.length; l++) {
                if (this.weights[l]) this.weights[l].set(obj.weights[l]);
            }
        }
        if (obj.biases) {
            for (let l = 0; l < obj.biases.length; l++) {
                if (this.biases[l]) this.biases[l].set(obj.biases[l]);
            }
        }
    }
}
