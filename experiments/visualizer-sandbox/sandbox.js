// Brain Visualizer Sandbox & Stress Workbench

const entities = [];
const visualizer = new BrainVisualizer({ width: 540, height: 420 });

let signalMode = "harmonic";
let signalSpeed = 1.0;
let simTime = 0;
const twitchDecays = new Map(); // entity -> Float32Array
const noiseStates = new Map();

// Helper to spawn and track a test entity
function addEntity(label, brain) {
    const entity = {
        label,
        brain,
        manualInputs: new Float32Array(brain instanceof DenseNetwork ? brain.layerSizes[0] : brain.numInputs)
    };

    entities.push(entity);
    visualizer.track(label, entity, (e) => e.brain);
    updateManualSliders();
    return entity;
}

function clearAllEntities() {
    entities.length = 0;
    visualizer.clear();
    updateManualSliders();
}

function scrambleAll() {
    entities.forEach(e => {
        if (e.brain instanceof DenseNetwork) {
            e.brain._initWeights();
        } else if (e.brain instanceof SparseNetwork) {
            e.brain.connections.forEach(c => {
                c.weight = (Math.random() * 2 - 1) * 1.5;
            });
        }
    });
}

// --- Preset Generators ---

function spawnTinyDense() {
    clearAllEntities();
    const brain = new DenseNetwork({
        name: "Tiny Reflex Dense",
        layerSizes: [3, 2],
        inputLabels: ["Light Sensor", "Touch Sensor", "Energy Level"],
        outputLabels: ["Steer Left", "Steer Right"]
    });
    addEntity("🌱 Tiny Reflex", brain);
}

function spawnStandardDense() {
    clearAllEntities();
    const brain = new DenseNetwork({
        name: "Standard Creature",
        layerSizes: [4, 8, 3],
        inputLabels: ["Wall Distance", "Food Angle", "Velocity X", "Velocity Y"],
        outputLabels: ["Forward Thrust", "Turn Angle", "Bite / Eat"]
    });
    addEntity("🧠 Standard Agent", brain);
}

function spawnDeepDense() {
    clearAllEntities();
    const brain = new DenseNetwork({
        name: "Deep 5-Layer Cortex",
        layerSizes: [5, 16, 16, 16, 3],
        inputLabels: ["Eye Left", "Eye Center", "Eye Right", "Prey Distance", "Stamina"],
        outputLabels: ["Thrust", "Rudder", "Attack"]
    });
    addEntity("🌊 Deep Cortex", brain);
}

function spawnWideDense() {
    clearAllEntities();
    const brain = new DenseNetwork({
        name: "Wide Association Network",
        layerSizes: [8, 32, 4],
        inputLabels: [
            "Sensor N", "Sensor NE", "Sensor E", "Sensor SE",
            "Sensor S", "Sensor SW", "Sensor W", "Sensor NW"
        ],
        outputLabels: ["Move North", "Move East", "Move South", "Move West"]
    });
    addEntity("📊 Wide Network", brain);
}

function spawnSparseReflex() {
    clearAllEntities();
    const brain = new SparseNetwork({
        name: "Sparse Direct Reflex",
        numInputs: 4,
        numOutputs: 2,
        inputLabels: ["Ceiling Sensor", "Floor Sensor", "Wall Left", "Wall Right"],
        outputLabels: ["Jump Force", "Duck / Dive"]
    });

    // Add direct sensor-motor connections
    brain.addConnection(0, 5, 0.85);
    brain.addConnection(1, 4, -0.92);
    brain.addConnection(2, 4, 0.65);
    brain.addConnection(3, 5, 0.74);

    addEntity("🧬 Sparse Direct", brain);
}

function spawnSparseLoop() {
    clearAllEntities();
    const brain = new SparseNetwork({
        name: "Recurrent Memory Network",
        numInputs: 3,
        numOutputs: 2,
        inputLabels: ["Food Scent", "Danger Cue", "Internal Clock"],
        outputLabels: ["Flee Velocity", "Forage Velocity"]
    });

    // Inputs: 0, 1, 2. Outputs: 3, 4. Hidden: 5, 6, 7.
    const h0 = brain.addNode(); // 5
    const h1 = brain.addNode(); // 6
    const h2 = brain.addNode(); // 7

    brain.addConnection(0, h0, 0.75);
    brain.addConnection(1, h1, 0.95);
    brain.addConnection(2, h2, -0.6);

    // Forward to outputs
    brain.addConnection(h0, 4, 0.88);
    brain.addConnection(h1, 3, 0.92);
    brain.addConnection(h2, 3, -0.5);

    // Recurrent Memory Loops (src >= tgt)
    brain.addConnection(h1, h0, 0.65);  // Feedback loop
    brain.addConnection(h2, h2, 0.80);  // Self-memory loop!
    brain.addConnection(3, h1, -0.45);  // Motor-sensory feedback loop

    addEntity("↺ Recurrent Memory", brain);
}

function spawnSparseComplex() {
    clearAllEntities();
    const brain = new SparseNetwork({
        name: "Complex Topological Graph",
        numInputs: 6,
        numOutputs: 3,
        inputLabels: ["Sonar L", "Sonar C", "Sonar R", "Current X", "Current Y", "Hunger"],
        outputLabels: ["Accelerate", "Turn Rudder", "Echo Chirp"]
    });

    // Add 10 hidden nodes
    const hidden = [];
    for (let i = 0; i < 10; i++) {
        hidden.push(brain.addNode());
    }

    // Connect input to hidden
    for (let i = 0; i < 6; i++) {
        const target = hidden[i % hidden.length];
        brain.addConnection(i, target, (Math.random() * 2 - 1) * 1.2);
    }

    // Hidden to hidden cross-links
    for (let i = 0; i < hidden.length - 1; i++) {
        brain.addConnection(hidden[i], hidden[i + 1], (Math.random() * 2 - 1) * 1.0);
    }

    // Recurrent feedback loops
    brain.addConnection(hidden[7], hidden[2], 0.75);
    brain.addConnection(hidden[5], hidden[5], 0.85); // self loop
    brain.addConnection(hidden[9], hidden[0], -0.6);

    // Connect to outputs (outputs start at index 6)
    brain.addConnection(hidden[8], 6, 0.9);
    brain.addConnection(hidden[9], 7, -0.85);
    brain.addConnection(hidden[4], 8, 0.7);

    addEntity("🕸️ Complex Mesh", brain);
}

function spawnMultiSwarm() {
    clearAllEntities();

    // 1. Scout Fish (Dense)
    const scout = new DenseNetwork({
        name: "Scout Fish",
        layerSizes: [4, 6, 2],
        inputLabels: ["Front Sonar", "Left Sonar", "Right Sonar", "Speed"],
        outputLabels: ["Thruster", "Steer"]
    });
    addEntity("🐟 Scout Fish", scout);

    // 2. Heavy Predator (Dense)
    const predator = new DenseNetwork({
        name: "Predator",
        layerSizes: [5, 12, 12, 3],
        inputLabels: ["Prey Scent", "Prey Angle", "Fatigue", "Light", "Depth"],
        outputLabels: ["Burst Sprint", "Jaw Snap", "Turn"]
    });
    addEntity("🦈 Apex Predator", predator);

    // 3. Autonomous Drone (Sparse Recurrent)
    const drone = new SparseNetwork({
        name: "Recon Drone",
        numInputs: 4,
        numOutputs: 3,
        inputLabels: ["Wind X", "Wind Y", "Altitude", "Battery"],
        outputLabels: ["Pitch", "Roll", "Throttle"]
    });
    const dh0 = drone.addNode();
    const dh1 = drone.addNode();
    drone.addConnection(0, dh0, 0.8);
    drone.addConnection(1, dh1, 0.8);
    drone.addConnection(2, 6, 0.95);
    drone.addConnection(dh0, 4, 0.7);
    drone.addConnection(dh1, 5, -0.6);
    drone.addConnection(dh1, dh0, 0.5); // feedback
    addEntity("🛸 Recon Drone", drone);

    // 4. Photosynthetic Flora (Sparse Reflex)
    const flora = new SparseNetwork({
        name: "Sun Flower",
        numInputs: 2,
        numOutputs: 2,
        inputLabels: ["Sunlight Angle", "Soil Moisture"],
        outputLabels: ["Petal Flare", "Stem Tilt"]
    });
    flora.addConnection(0, 3, 0.9);
    flora.addConnection(1, 2, 0.6);
    addEntity("🌻 Solar Flora", flora);
}

// --- Live Input Generation Loop ---

function runSimulationLoop() {
    simTime += 0.03 * signalSpeed;

    entities.forEach(entity => {
        const brain = entity.brain;
        const numInputs = brain instanceof DenseNetwork ? brain.layerSizes[0] : brain.numInputs;
        const inputs = new Float32Array(numInputs);

        if (signalMode === "harmonic") {
            for (let i = 0; i < numInputs; i++) {
                inputs[i] = Math.sin(simTime + i * 1.4) * 0.5 + 0.5;
            }
        } else if (signalMode === "twitch") {
            let decays = twitchDecays.get(entity);
            if (!decays || decays.length !== numInputs) {
                decays = new Float32Array(numInputs);
                twitchDecays.set(entity, decays);
            }

            for (let i = 0; i < numInputs; i++) {
                if (Math.random() < 0.03 * signalSpeed) {
                    decays[i] = 1.0;
                } else {
                    decays[i] = Math.max(0, decays[i] - 0.04 * signalSpeed);
                }
                inputs[i] = decays[i];
            }
        } else if (signalMode === "noise") {
            let nState = noiseStates.get(entity);
            if (!nState || nState.length !== numInputs) {
                nState = new Float32Array(numInputs).fill(0.5);
                noiseStates.set(entity, nState);
            }

            for (let i = 0; i < numInputs; i++) {
                nState[i] += (Math.random() - 0.5) * 0.1 * signalSpeed;
                nState[i] = Math.max(0, Math.min(1, nState[i]));
                inputs[i] = nState[i];
            }
        } else if (signalMode === "manual") {
            for (let i = 0; i < numInputs; i++) {
                inputs[i] = entity.manualInputs[i] || 0;
            }
        }

        // Feed forward into brain
        brain.activate(inputs);
    });

    requestAnimationFrame(runSimulationLoop);
}

// --- Manual Sliders UI ---

function updateManualSliders() {
    const container = document.getElementById("manual-sliders-container");
    const box = document.getElementById("sliders-box");
    box.innerHTML = "";

    if (signalMode !== "manual" || entities.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";

    entities.forEach((entity, eIdx) => {
        const brain = entity.brain;
        const numInputs = brain instanceof DenseNetwork ? brain.layerSizes[0] : brain.numInputs;

        const header = document.createElement("div");
        header.style.cssText = "font-weight: 600; color: #58a6ff; font-size: 11px; margin-top: 6px;";
        header.textContent = `🧠 ${entity.label}:`;
        box.appendChild(header);

        for (let i = 0; i < numInputs; i++) {
            const label = brain.inputLabels?.[i] || `In ${i}`;
            const row = document.createElement("div");
            row.className = "slider-row";
            row.innerHTML = `
                <span class="slider-name" title="${label}">${label}</span>
                <input type="range" min="0" max="1" step="0.05" value="${entity.manualInputs[i] || 0}" data-eidx="${eIdx}" data-inidx="${i}" />
                <span class="slider-val" id="val-${eIdx}-${i}">${(entity.manualInputs[i] || 0).toFixed(2)}</span>
            `;
            box.appendChild(row);
        }
    });

    box.querySelectorAll("input[type='range']").forEach(input => {
        input.addEventListener("input", (e) => {
            const eIdx = parseInt(e.target.getAttribute("data-eidx"));
            const inIdx = parseInt(e.target.getAttribute("data-inidx"));
            const val = parseFloat(e.target.value);
            entities[eIdx].manualInputs[inIdx] = val;
            document.getElementById(`val-${eIdx}-${inIdx}`).textContent = val.toFixed(2);
        });
    });
}

// --- Event Listeners ---

document.getElementById("preset-tiny-dense").addEventListener("click", spawnTinyDense);
document.getElementById("preset-standard-dense").addEventListener("click", spawnStandardDense);
document.getElementById("preset-deep-dense").addEventListener("click", spawnDeepDense);
document.getElementById("preset-wide-dense").addEventListener("click", spawnWideDense);
document.getElementById("preset-sparse-reflex").addEventListener("click", spawnSparseReflex);
document.getElementById("preset-sparse-loop").addEventListener("click", spawnSparseLoop);
document.getElementById("preset-sparse-complex").addEventListener("click", spawnSparseComplex);
document.getElementById("preset-multi-swarm").addEventListener("click", spawnMultiSwarm);

document.getElementById("btn-scramble-all").addEventListener("click", scrambleAll);
document.getElementById("btn-clear-all").addEventListener("click", clearAllEntities);

document.getElementById("signal-mode").addEventListener("change", (e) => {
    signalMode = e.target.value;
    updateManualSliders();
});

document.getElementById("signal-speed").addEventListener("input", (e) => {
    signalSpeed = parseFloat(e.target.value);
    document.getElementById("speed-val").textContent = `${signalSpeed.toFixed(1)}x`;
});

// Custom Brain Network Type toggle
document.getElementById("custom-type").addEventListener("change", (e) => {
    if (e.target.value === "dense") {
        document.getElementById("row-dense-layers").style.display = "flex";
        document.getElementById("row-sparse-nodes").style.display = "none";
    } else {
        document.getElementById("row-dense-layers").style.display = "none";
        document.getElementById("row-sparse-nodes").style.display = "flex";
    }
});

// Add Custom Brain
document.getElementById("btn-add-custom").addEventListener("click", () => {
    const name = document.getElementById("custom-name").value.trim() || "Custom Agent";
    const type = document.getElementById("custom-type").value;

    if (type === "dense") {
        const raw = document.getElementById("custom-layers").value;
        const layers = raw.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
        if (layers.length < 2) {
            alert("Dense networks require at least 2 layers (e.g. 4, 8, 2)");
            return;
        }
        const brain = new DenseNetwork({
            name,
            layerSizes: layers
        });
        addEntity(name, brain);
    } else {
        const raw = document.getElementById("custom-sparse-config").value;
        const parts = raw.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
        const numIn = parts[0] || 4;
        const numOut = parts[1] || 2;
        const numHidden = parts[2] || 4;

        const brain = new SparseNetwork({
            name,
            numInputs: numIn,
            numOutputs: numOut
        });

        for (let i = 0; i < numHidden; i++) {
            brain.addNode();
        }

        // Random starting connections
        const total = brain.totalNodes;
        for (let i = 0; i < numIn; i++) {
            const target = numIn + Math.floor(Math.random() * (total - numIn));
            brain.addConnection(i, target, (Math.random() * 2 - 1) * 1.2);
        }

        addEntity(name, brain);
    }
});

// Initial Spawn
spawnStandardDense();
runSimulationLoop();
