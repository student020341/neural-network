/**
 * Neural Network Engine Entry Point & Compatibility Bridge
 * 
 * Provides:
 * - DenseNetwork: Layered feedforward neural network (optimized with Float32Array)
 * - SparseNetwork: Topology-evolving sparse network with recurrent memory loops
 * - Network: Alias to DenseNetwork for 100% backward compatibility with existing creatures.
 */

// If loaded directly without HTML script tags (e.g. Node/bundle), define the alias
if (typeof DenseNetwork !== 'undefined') {
    var Network = DenseNetwork;
}

if (typeof window !== 'undefined') {
    if (typeof DenseNetwork !== 'undefined') window.Network = DenseNetwork;
}
