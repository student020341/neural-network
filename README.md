# Neural Network Experiments

A zero-dependency neural network and artificial life simulation project written in vanilla JavaScript and HTML5 Canvas.

**Live Demos**:
- **Main Hub**: [https://student020341.github.io/neural-network/](https://student020341.github.io/neural-network/)
- **Simple Dense Creatures**: [https://student020341.github.io/neural-network/experiments/simple-dense/](https://student020341.github.io/neural-network/experiments/simple-dense/)

---

## Project Structure

```text
├── index.html                  # Main experiments hub / landing page
├── utils.js                    # Math, vector helpers, interpolation & collision utilities
├── lib.js                      # High-DPI canvas setup, virtual world scaling & zero-allocation game loop
├── networks/
│   ├── dense_network.js        # Optimized layered MLP with Leaky ReLU & Fast Sigmoid
│   └── sparse_network.js       # Topology-evolving sparse network with recurrent memory loops
├── tools/
│   └── brain_visualizer.js     # Real-time Picture-in-Picture interactive brain HUD (pan/zoom/filter)
└── experiments/
    ├── simple-dense/           # Multi-creature simulation (Hopper, Flower, Fish)
    │   ├── index.html
    │   ├── hopper.js
    │   ├── flower.js
    │   ├── fish.js
    │   └── main.js
    ├── swarm/                  # Multi-agent resource foraging simulation
    │   ├── index.html
    │   └── swarm.js
    └── visualizer-sandbox/     # Brain visualizer stress workbench & custom topology lab
        ├── index.html
        └── sandbox.js
```

---

## Experiments

### 1. Simple Dense Creatures (`experiments/simple-dense/`)
Simulates three distinct biological organisms with on-canvas neural state telemetry:

#### Hopper
* **Input 0** (top bar): Distance to the ground.
* **Input 1** (second bar): Current fall/jump velocity.
* **Input 2** (third bar): Idle time without moving.
* **Output 0** (bottom bar): Leg extension. Hops are triggered when there is a rapid positive delta change in leg extension.

#### Flower
* **Input 0** (left bar): Distance to the star.
* **Output 0** (right bar): Growth rate (grow if $> 0.55$, shrink if $< 0.45$).

#### Fish
* **Input 0** (bottom fin): Distance to the wall ahead (visualized by sight line and HSL fin color).
* **Input 1** (top fin): Distance to the ceiling.
* **Output 0**: Facing direction ($\ge 0.5$ right, $< 0.5$ left).
* **Output 1**: Forward propulsion velocity scalar.
* **Output 2**: Upward swimming thrust (fires bubble emissions when active; sinks otherwise).

---

## Neural Network Architectures

### `DenseNetwork` (`networks/dense_network.js`)
* Contiguous `Float32Array` buffers with zero heap allocations during `activate()`.
* Non-saturating **Leaky ReLU** for hidden layers and **Fast Algebraic Sigmoid** for bounded $[0, 1]$ output activations.
* High-speed `clone()` via raw buffer copies (`memcpy`) and in-place `mutate()`.

### `SparseNetwork` (`networks/sparse_network.js`)
* Flat-graph sparse network supporting arbitrary node connectivity.
* **Reflex Skip-Connections**: Sensors can connect directly to actuators for instantaneous reflexes.
* **Recurrent Memory Loops**: Retains temporal state buffers (`previousValues`) across ticks to support short-term memory echoes, latch switches, and oscillating biological clocks (CPGs).
