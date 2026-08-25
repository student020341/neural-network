// Aquarium Ecosystem Controller & Evolution Engine

/** @type CanvasRenderingContext2D */
const ctx = canvasContext2D;

// 1. Responsive World Setup
function setupResponsiveWorld() {
    const isLandscape = window.innerWidth >= window.innerHeight;
    if (isLandscape) {
        setWorld(800, 520, 'fit', true);
    } else {
        setWorld(520, 800, 'fit', true);
    }
}
setupResponsiveWorld();
window.addEventListener("resize", setupResponsiveWorld);

let bounds = getWorldBounds();
resizeCallbacks.push((b) => {
    bounds = b;
    for (const list of [turnFishes, crabs, jellies, predators, eels, foods, carcasses]) {
        list.forEach(e => e.onResize && e.onResize(bounds));
    }
});

// 2. Evolutionary Lineage Registry with Size Classifications & Highlight Clips
// 2. Evolutionary Lineage Registry with Size Classifications, Stagnation & Score Decay
const bestBrains = {
    TurnFish: {
        small: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        medium: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        large: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] }
    },
    Crab: {
        small: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        medium: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        large: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] }
    },
    Jellyfish: {
        small: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        medium: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        large: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] }
    },
    Predator: {
        small: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        medium: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        large: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] }
    },
    Eel: {
        small: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        medium: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] },
        large: { brain: null, score: 0, allTimeScore: 0, stagnation: 0, highlights: [] }
    }
};

// 3. Ecosystem Populations & Caps
const CAPS = {
    TurnFish: 46,
    Crab: 14,
    Jellyfish: 14,
    Predator: 7,
    Eel: 10,
    Global: 95
};

const turnFishes = [];
const crabs = [];
const jellies = [];
const predators = [];
const eels = [];
const foods = [];
const carcasses = [];

// Shared FIFO Brain Scheduler Queue
const thinkQueue = [];

let predatorKillCount = 0;
let foodSpawnTimer = 0;
let creatureSpawnTimer = 0;

// Cached DOM HUD element references & throttled timer (~6 Hz)
const domHUD = {
    popTotal: document.getElementById("pop-total"),
    cntFish: document.getElementById("cnt-fish"),
    cntCrabs: document.getElementById("cnt-crabs"),
    cntJellies: document.getElementById("cnt-jellies"),
    cntPredators: document.getElementById("cnt-predators"),
    cntEels: document.getElementById("cnt-eels"),
    cntFood: document.getElementById("cnt-food"),
    cntKills: document.getElementById("cnt-kills"),
    // Ecosystem Performance Budget Pod Elements
    perfFpsBadge: document.getElementById("perf-fps-badge"),
    perfFrameTime: document.getElementById("perf-frame-time"),
    perfPhysTime: document.getElementById("perf-phys-time"),
    perfBrainTime: document.getElementById("perf-brain-time"),
    perfDrawTime: document.getElementById("perf-draw-time"),
    perfQueueDepth: document.getElementById("perf-queue-depth"),
    perfBrainRate: document.getElementById("perf-brain-rate")
};
let hudUpdateTimer = 0;

// Subsystem Performance Profiling Telemetry
const perfStats = {
    physTime: 0,
    brainTime: 0,
    drawTime: 0,
    brainTicksInWindow: 0,
    windowTime: 0,
    smoothedFps: 60
};

// Helper to record champion brains with adaptive score decay & stagnation tracking
function recordDeath(creature) {
    const species = creature.species;
    const tier = creature.sizeTier || "medium";
    if (!species || !bestBrains[species] || !bestBrains[species][tier]) return;

    const record = bestBrains[species][tier];

    // Check if creature dethrones the reigning champion threshold
    if (creature.score > record.score || !record.brain) {
        record.score = creature.score;
        if (creature.score > record.allTimeScore) {
            record.allTimeScore = creature.score;
        }
        record.stagnation = 0; // Reset stagnation on crowning
        record.brain = creature.brain.clone();
        record.highlights = creature.highlightClips && creature.highlightClips.length > 0 
            ? creature.highlightClips.map(c => [...c]) 
            : [];
        updateChampionButtons();
    } else {
        // Stagnation progression: failed to beat champion
        record.stagnation++;
        // Decay effective reigning score by 1.2% per failed generation (floor at 50)
        record.score = Math.max(50, Math.floor(record.score * 0.988));
        if (record.stagnation % 4 === 0) {
            updateChampionButtons();
        }
    }

    // Convert dead creatures into sinking floor carcasses (unless exploded or split via fission)
    if (!creature.exploded && !creature.split) {
        carcasses.push(new Carcass(creature.x, creature.y, creature.size, species, bounds));
    }
}

// 4. Edge Spawning Hierarchy with Size Stratification, Novelty Injection & Stagnation Temperature
function spawnEdgeEntity(species) {
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -25 : bounds.w + 25;
    const startY = randRange(40, bounds.h - 60);

    // 1 in 5 chance (20%) to inject a completely random/fresh brain for genetic novelty
    const isNovelExplorer = Math.random() < 0.20;

    if (species === "TurnFish") {
        const size = randRange(12, 22);
        const tier = size < 15.5 ? "small" : (size < 19 ? "medium" : "large");
        const record = bestBrains.TurnFish[tier];
        const template = isNovelExplorer ? null : record.brain;
        turnFishes.push(new TurnFish(startX, startY, bounds, template, size, record.stagnation));
    } else if (species === "Crab") {
        const size = randRange(11, 19);
        const tier = size < 13.5 ? "small" : (size < 16.5 ? "medium" : "large");
        const record = bestBrains.Crab[tier];
        const template = isNovelExplorer ? null : record.brain;
        crabs.push(new Crab(startX, bounds.h - 10, bounds, template, size, record.stagnation));
    } else if (species === "Jellyfish") {
        const size = randRange(22, 58);
        const tier = size < 32 ? "small" : (size < 46 ? "medium" : "large");
        const topY = randRange(-20, 60);
        const record = bestBrains.Jellyfish[tier];
        const template = isNovelExplorer ? null : record.brain;
        jellies.push(new Jellyfish(startX, topY, bounds, template, size, record.stagnation));
    } else if (species === "Predator") {
        const size = randRange(24, 68);
        const tier = size < 36 ? "small" : (size < 52 ? "medium" : "large");
        const record = bestBrains.Predator[tier];
        const template = isNovelExplorer ? null : record.brain;
        predators.push(new PredatorFish(startX, startY, bounds, template, size, record.stagnation));
    } else if (species === "Eel") {
        const size = randRange(20, 38);
        const tier = size < 25 ? "small" : (size < 32 ? "medium" : "large");
        const record = bestBrains.Eel[tier];
        const template = isNovelExplorer ? null : record.brain;
        eels.push(new RibbonEel(startX, startY, bounds, template, size, record.stagnation));
    }
}

// Initial Starter Population
for (let i = 0; i < 16; i++) {
    const size = randRange(12, 22);
    turnFishes.push(new TurnFish(randRange(50, bounds.w - 50), randRange(50, bounds.h - 100), bounds, null, size));
}
for (let i = 0; i < 8; i++) {
    foods.push(new Food(randRange(40, bounds.w - 40), randRange(0, bounds.h * 0.5), bounds));
}

// 5. Telemetry, Slide-out Drawer & Highlight Reel Engine
const fpsMeter = new FPSMeter({ position: 'bottom-right' });
const visualizer = new BrainVisualizer({ width: 480, height: 320, open: false });

const drawer = document.getElementById("drawer");
const drawerHandle = document.getElementById("drawer-handle");
const replayBanner = document.getElementById("replay-banner");
const championsContainer = document.getElementById("champions-container");

// Drawer toggle
drawerHandle.addEventListener("click", () => {
    drawer.classList.toggle("open");
});

// Highlight Replayer State
let activeReplay = null; // { species, tier, brain, previewEntity, timer }

function stopHighlightReplay() {
    if (activeReplay) {
        if (activeReplay.timer) clearInterval(activeReplay.timer);
        activeReplay = null;
    }
    if (replayBanner) {
        replayBanner.style.display = "none";
    }
    document.querySelectorAll(".champ-btn").forEach(b => b.classList.remove("active"));
}

// Helper to create an animated preview creature avatar for champion replays
function createPreviewCreature(species, tier) {
    let size = 18.5;
    if (species === "TurnFish") {
        size = tier === "small" ? 13.5 : (tier === "medium" ? 18.5 : 24.0);
        const f = new TurnFish(0, 0, bounds, null, size);
        f.invulnerableTimer = 0;
        return f;
    } else if (species === "Crab") {
        size = tier === "small" ? 13.5 : (tier === "medium" ? 19.0 : 27.0);
        const c = new Crab(0, 0, bounds, null, size);
        c.invulnerableTimer = 0;
        return c;
    } else if (species === "Jellyfish") {
        size = tier === "small" ? 23.0 : (tier === "medium" ? 36.0 : 50.0);
        const j = new Jellyfish(0, 0, bounds, null, size);
        j.invulnerableTimer = 0;
        return j;
    } else if (species === "Predator") {
        size = tier === "small" ? 29.0 : (tier === "medium" ? 39.0 : 50.0);
        const p = new PredatorFish(0, 0, bounds, null, size);
        p.invulnerableTimer = 0;
        return p;
    } else if (species === "Eel") {
        size = tier === "small" ? 22.5 : (tier === "medium" ? 31.0 : 42.0);
        const e = new RibbonEel(0, 0, bounds, null, size);
        e.invulnerableTimer = 0;
        return e;
    }
    return null;
}

function playChampionHighlights(species, tier) {
    stopHighlightReplay();

    const record = bestBrains[species]?.[tier];
    if (!record || !record.brain) {
        return;
    }

    const brain = record.brain.clone();
    const clips = record.highlights || [];

    const previewEntity = createPreviewCreature(species, tier);
    if (previewEntity) {
        previewEntity.score = record.score;
        previewEntity.hunger = 0.15;
    }

    const label = `🏆 Champion ${species} [${tier.toUpperCase()}]`;
    visualizer.inspect(label, previewEntity || { brain }, () => brain, null, true);

    if (replayBanner) {
        replayBanner.style.display = "block";
        replayBanner.innerHTML = clips.length > 0 
            ? `▶ <strong>Replaying Champion Highlights (${clips.length} Clips)</strong> • Score: ${record.score}`
            : `⚡ <strong>Live Synaptic Stream</strong> • Score: ${record.score}`;
    }

    let clipIdx = 0;
    let frameIdx = 0;
    let synthTime = 0;

    const timer = setInterval(() => {
        let inputSnapshot = null;

        if (clips.length > 0) {
            const currentClip = clips[clipIdx];
            if (currentClip && currentClip[frameIdx]) {
                inputSnapshot = currentClip[frameIdx];
            }
            frameIdx++;
            if (frameIdx >= currentClip.length) {
                frameIdx = 0;
                clipIdx = (clipIdx + 1) % clips.length;
            }
        } else {
            // Synthetic harmonic wave signal if no clips recorded yet
            synthTime += 0.08;
            const numIn = brain.numInputs;
            const inputs = new Float32Array(numIn);
            for (let i = 0; i < numIn; i++) {
                inputs[i] = Math.sin(synthTime + i * 1.2) * 0.5 + 0.5;
            }
            inputSnapshot = inputs;
        }

        if (inputSnapshot) {
            const outputs = brain.activate(inputSnapshot);

            // Reenact physical movements in preview creature avatar with time advancement
            if (outputs && previewEntity) {
                previewEntity.time += 0.06;
                previewEntity.age += 0.06;
                previewEntity.outputs = outputs;

                if (species === "TurnFish") {
                    const steer = outputs[0];
                    const torque = outputs[1] || 0.5;
                    if (steer < 0.4) previewEntity.angle -= (0.4 - steer) * torque * 0.9;
                    else if (steer > 0.6) previewEntity.angle += (steer - 0.6) * torque * 0.9;
                    previewEntity.mouthOpen = outputs[3] > 0.5;
                } else if (species === "Predator") {
                    const steer = outputs[0];
                    const torque = outputs[1] || 0.5;
                    if (steer < 0.4) previewEntity.angle -= (0.4 - steer) * torque * 0.9;
                    else if (steer > 0.6) previewEntity.angle += (steer - 0.6) * torque * 0.9;
                    previewEntity.mouthOpen = outputs[3] > 0.5;
                    const targetAperture = previewEntity.mouthOpen ? 1.0 : 0.0;
                    previewEntity.mouthAperture += (targetAperture - previewEntity.mouthAperture) * 0.4;
                } else if (species === "Crab") {
                    previewEntity.mouthOpen = outputs[1] > 0.6;
                    previewEntity.pincerActive = outputs[2] > 0.5;
                } else if (species === "Jellyfish") {
                    if (outputs[0] > 0.45) previewEntity.pulsePower = 1.0;
                    if (previewEntity.pulsePower > 0) previewEntity.pulsePower = Math.max(0, previewEntity.pulsePower - 0.15);
                    const tilt = outputs[1] || 0.5;
                    const maxLean = Math.PI / 3;
                    previewEntity.tiltAngle = (tilt - 0.5) * 2 * maxLean;
                    previewEntity.jetActive = outputs[2] > 0.5;
                    if (previewEntity.jetActive) previewEntity.jetTimer = 0.22;
                    if (previewEntity.jetTimer > 0) previewEntity.jetTimer -= 0.04;
                } else if (species === "Eel") {
                    const steer = outputs[0];
                    if (steer < 0.4) previewEntity.angle -= (0.4 - steer) * 0.8;
                    else if (steer > 0.6) previewEntity.angle += (steer - 0.6) * 0.8;
                    previewEntity.mouthOpen = outputs[2] > 0.5;
                }
            }
        }
    }, 60); // ~16 FPS neural pulse replay

    activeReplay = { species, tier, brain, previewEntity, timer };
}

// Populate Champion Buttons in Drawer
function updateChampionButtons() {
    if (!championsContainer) return;

    const speciesList = [
        { key: "TurnFish", label: "🐟 Spinner" },
        { key: "Crab", label: "🦀 Crab" },
        { key: "Jellyfish", label: "🪼 Jelly" },
        { key: "Predator", label: "🦈 Predator" },
        { key: "Eel", label: "🐍 Eel" }
    ];

    championsContainer.innerHTML = speciesList.map(s => {
        const sm = bestBrains[s.key].small;
        const md = bestBrains[s.key].medium;
        const lg = bestBrains[s.key].large;

        const formatBtn = (rec, label) => {
            const hasBrain = rec.brain !== null;
            const scoreText = hasBrain ? rec.score : '-';
            const heat = rec.stagnation > 8 ? ' 🔥' : (rec.stagnation > 3 ? ' ⚡' : '');
            const tooltip = hasBrain 
                ? `${label} Champion\nReigning Threshold: ${rec.score}\nAll-Time Record: ${rec.allTimeScore}\nStagnation Heat: ${rec.stagnation}`
                : `${label} (No champion yet)`;
            return `<button class="champ-btn" data-sp="${s.key}" data-tier="${label.toLowerCase()}" title="${tooltip}">${label[0]} ${scoreText}${heat}</button>`;
        };

        return `
            <div class="champ-row">
                <span class="champ-name">${s.label}</span>
                <div class="btn-group">
                    ${formatBtn(sm, "Small")}
                    ${formatBtn(md, "Medium")}
                    ${formatBtn(lg, "Large")}
                </div>
            </div>
        `;
    }).join("");

    championsContainer.querySelectorAll(".champ-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const sp = btn.getAttribute("data-sp");
            const tier = btn.getAttribute("data-tier");
            playChampionHighlights(sp, tier);
            btn.classList.add("active");
        });
    });
}
updateChampionButtons();

// Click creature to inspect live brain, or click empty space to drop food
canvas.addEventListener("click", (e) => {
    stopHighlightReplay();

    const mouseWorld = screenToWorld(e.clientX, e.clientY);
    const clickX = mouseWorld.x;
    const clickY = mouseWorld.y;

    const allCreatures = [...predators, ...eels, ...jellies, ...crabs, ...turnFishes];
    let clickedCreature = null;

    for (const c of allCreatures) {
        if (!c.dead && dist({ x: clickX, y: clickY }, c) < (c.size || 20) * 1.2) {
            clickedCreature = c;
            break;
        }
    }

    if (clickedCreature) {
        const label = `${clickedCreature.species} (${clickedCreature.sizeTier}, S:${Math.round(clickedCreature.size)})`;
        visualizer.inspect(label, clickedCreature, (ent) => ent.brain);
    } else {
        foods.push(new Food(clickX, clickY, bounds));
    }
});

// 6. Simulation Logic Step
const logic = (dt) => {
    const totalCreatures = turnFishes.length + crabs.length + jellies.length + predators.length + eels.length;

    // A. Food Spawning
    foodSpawnTimer += dt;
    if (foodSpawnTimer >= 0.55 && foods.length < 22) {
        foodSpawnTimer = 0;
        foods.push(new Food(randRange(30, bounds.w - 30), 0, bounds));
    }

    // B. Hierarchical Edge Spawning
    creatureSpawnTimer += dt;
    if (creatureSpawnTimer >= 0.75 && totalCreatures < CAPS.Global) {
        creatureSpawnTimer = 0;

        // Condition 1: TurnFish (Foundation)
        if (turnFishes.length < CAPS.TurnFish) {
            spawnEdgeEntity("TurnFish");
        }

        // Condition 2: Crabs (Unlock if detritus or carcasses on floor)
        const settledDebris = foods.filter(f => f.state === "settled").length + carcasses.filter(c => c.state === "settled").length;
        if (settledDebris > 0 && crabs.length < CAPS.Crab) {
            spawnEdgeEntity("Crab");
        }

        // Condition 3: Predators (Unlock when prey population is thriving)
        if (turnFishes.length >= 4 && crabs.length >= 1 && predators.length < CAPS.Predator) {
            spawnEdgeEntity("Predator");
        }

        // Condition 4: Jellyfish (Unlock after Predator makes a kill)
        if (predatorKillCount >= 1 && jellies.length < CAPS.Jellyfish) {
            spawnEdgeEntity("Jellyfish");
        }

        // Condition 5: Ribbon Eels (Unlock whenever carcasses appear in the tank)
        if (carcasses.length > 0 && eels.length < CAPS.Eel) {
            spawnEdgeEntity("Eel");
        }
    }

    // C. Seafloor Sediment Sinking
    const floorItems = [...foods.filter(f => f.state === "settled"), ...carcasses.filter(c => c.state === "settled")];
    if (floorItems.length > 8) {
        for (const item of floorItems) {
            item.y += 2.5 * dt;
        }
    }

    // D. Update Foods & Carcasses
    for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        f.update(dt, bounds);
        if (f.state === "dead") foods.splice(i, 1);
    }
    for (let i = carcasses.length - 1; i >= 0; i--) {
        const c = carcasses[i];
        c.update(dt, bounds);
        if (c.state === "dead") carcasses.splice(i, 1);
    }

    // E. Scheduled Brain Think Passes via Fair FIFO Queue (Max 16 neural evaluations per frame)
    const tBrainStart = performance.now();
    const thinkBatch = Math.min(thinkQueue.length, 16);
    for (let i = 0; i < thinkBatch; i++) {
        const creature = thinkQueue.shift();
        if (!creature) continue;
        creature.inThinkQueue = false;
        if (creature.dead) continue;

        if (creature.species === "TurnFish") {
            creature.performScheduledThink(foods, crabs, predators, jellies);
        } else if (creature.species === "Crab") {
            creature.performScheduledThink(foods, carcasses, crabs, predators, jellies);
        } else if (creature.species === "Jellyfish") {
            creature.performScheduledThink(foods, jellies);
        } else if (creature.species === "Predator") {
            creature.performScheduledThink(turnFishes, crabs, jellies, predators);
        } else if (creature.species === "Eel") {
            creature.performScheduledThink(carcasses, jellies, predators);
        }
    }
    const brainDur = performance.now() - tBrainStart;
    perfStats.brainTime = perfStats.brainTime * 0.8 + brainDur * 0.2;
    perfStats.brainTicksInWindow += thinkBatch;
    perfStats.windowTime += dt;

    // F. Update Physics and Actions (Full 60 FPS)
    const tPhysStart = performance.now();

    // TurnFish
    for (let i = turnFishes.length - 1; i >= 0; i--) {
        const f = turnFishes[i];
        f.act(dt, foods, crabs, predators, jellies);
        if (f.dead) {
            recordDeath(f);
            turnFishes.splice(i, 1);
        }
    }

    // Crabs
    for (let i = crabs.length - 1; i >= 0; i--) {
        const c = crabs[i];
        c.act(dt, foods, carcasses, crabs, predators, jellies, (crab, tossedJelly) => {
            foods.push(new Food(tossedJelly.x, tossedJelly.y, bounds));
        });
        if (c.dead) {
            recordDeath(c);
            crabs.splice(i, 1);
        }
    }

    // Jellyfish
    for (let i = jellies.length - 1; i >= 0; i--) {
        const j = jellies[i];
        j.act(dt, foods, jellies);
        if (j.dead) {
            recordDeath(j);

            // Cascading Fission on Death:
            const isFissionExplorer = Math.random() < 0.20;
            if (j.sizeTier === "large" && jellies.length + 1 < CAPS.Jellyfish * 1.5) {
                j.split = true;
                const medTemplate = isFissionExplorer ? null : (bestBrains.Jellyfish.medium.brain || j.brain.clone());
                for (let k = 0; k < 2; k++) {
                    const offset = k === 0 ? -16 : 16;
                    const child = new Jellyfish(clamp(j.x + offset, 25, bounds.w - 25), j.y, bounds, medTemplate, randRange(34, 44));
                    child.hunger = 0.20;
                    child.vx = offset * 2.5;
                    child.invulnerableTimer = 2.0;
                    jellies.push(child);
                }
            } else if (j.sizeTier === "medium" && jellies.length + 1 < CAPS.Jellyfish * 1.5) {
                j.split = true;
                const smallTemplate = isFissionExplorer ? null : (bestBrains.Jellyfish.small.brain || j.brain.clone());
                for (let k = 0; k < 2; k++) {
                    const offset = k === 0 ? -12 : 12;
                    const child = new Jellyfish(clamp(j.x + offset, 20, bounds.w - 20), j.y, bounds, smallTemplate, randRange(22, 28));
                    child.hunger = 0.20;
                    child.vx = offset * 2.5;
                    child.invulnerableTimer = 2.0;
                    jellies.push(child);
                }
            }

            jellies.splice(i, 1);
        }
    }

    // Ribbon Eels
    for (let i = eels.length - 1; i >= 0; i--) {
        const e = eels[i];
        e.act(dt, carcasses, jellies, predators);
        if (e.dead) {
            recordDeath(e);
            eels.splice(i, 1);
        }
    }

    // Predator Fish
    for (let i = predators.length - 1; i >= 0; i--) {
        const p = predators[i];
        p.act(dt, turnFishes, crabs, jellies, predators, 
            (hunter, prey) => {
                predatorKillCount++;
            },
            (explodedPredator) => {
                const numPellets = Math.floor(randRange(10, 16));
                for (let k = 0; k < numPellets; k++) {
                    const ang = (k / numPellets) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                    const spread = randRange(12, explodedPredator.radius * 1.6);
                    const px = clamp(explodedPredator.x + Math.cos(ang) * spread, 10, bounds.w - 10);
                    const py = clamp(explodedPredator.y + Math.sin(ang) * spread, 10, bounds.h - 15);
                    foods.push(new Food(px, py, bounds));
                }
            }
        );
        if (p.dead) {
            recordDeath(p);
            predators.splice(i, 1);
        }
    }

    const physDur = performance.now() - tPhysStart;
    perfStats.physTime = perfStats.physTime * 0.8 + physDur * 0.2;

    // G. Throttled Telemetry HUD Counters (~6 Hz to avoid DOM layout thrashing)
    hudUpdateTimer += dt;
    if (hudUpdateTimer >= 0.16) {
        hudUpdateTimer = 0;
        if (domHUD.popTotal) domHUD.popTotal.textContent = `${totalCreatures}/${CAPS.Global}`;
        if (domHUD.cntFish) domHUD.cntFish.textContent = turnFishes.length;
        if (domHUD.cntCrabs) domHUD.cntCrabs.textContent = crabs.length;
        if (domHUD.cntJellies) domHUD.cntJellies.textContent = jellies.length;
        if (domHUD.cntPredators) domHUD.cntPredators.textContent = predators.length;
        if (domHUD.cntEels) domHUD.cntEels.textContent = eels.length;
        if (domHUD.cntFood) domHUD.cntFood.textContent = foods.length;
        if (domHUD.cntKills) domHUD.cntKills.textContent = predatorKillCount;

        // Update Ecosystem Performance & Budget Pod in Collapsible Drawer
        const fps = 1 / Math.max(0.001, dt);
        perfStats.smoothedFps = perfStats.smoothedFps * 0.7 + fps * 0.3;
        const brainRate = (perfStats.brainTicksInWindow / Math.max(0.001, perfStats.windowTime));
        const totalFrameTime = perfStats.physTime + perfStats.brainTime + perfStats.drawTime;

        if (domHUD.perfFpsBadge) {
            const roundedFps = Math.round(perfStats.smoothedFps);
            domHUD.perfFpsBadge.textContent = `${roundedFps} FPS`;
            domHUD.perfFpsBadge.className = "perf-badge" + (roundedFps >= 55 ? "" : (roundedFps >= 35 ? " yellow" : " red"));
        }
        if (domHUD.perfFrameTime) domHUD.perfFrameTime.textContent = `${totalFrameTime.toFixed(1)}ms`;
        if (domHUD.perfPhysTime) domHUD.perfPhysTime.textContent = `${perfStats.physTime.toFixed(1)}ms`;
        if (domHUD.perfBrainTime) domHUD.perfBrainTime.textContent = `${perfStats.brainTime.toFixed(1)}ms`;
        if (domHUD.perfDrawTime) domHUD.perfDrawTime.textContent = `${perfStats.drawTime.toFixed(1)}ms`;
        if (domHUD.perfQueueDepth) domHUD.perfQueueDepth.textContent = thinkQueue.length;
        if (domHUD.perfBrainRate) domHUD.perfBrainRate.textContent = `${Math.round(brainRate)} Hz`;

        perfStats.brainTicksInWindow = 0;
        perfStats.windowTime = 0;
    }
};

// 7. Layered Render Step
const render = (_, cw, ch) => {
    const tDrawStart = performance.now();
    // Clear entire screen (including letterbox/pillarbox margins where edge entities enter)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Subtle Sandy Seafloor Line
    ctx.fillStyle = "rgba(180, 150, 90, 0.15)";
    ctx.fillRect(0, bounds.h - 10, bounds.w, 10);
    ctx.strokeStyle = "rgba(210, 180, 120, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bounds.h - 10);
    ctx.lineTo(bounds.w, bounds.h - 10);
    ctx.stroke();

    // Layer 1: Sunken Carcasses (Batched in 3 passes total)
    Carcass.drawBatch(ctx, carcasses);

    // Layer 2: Food Pellets (Batched in 4 passes total)
    Food.drawBatch(ctx, foods);

    // Layer 3: Crabs (Crawling floor perimeter)
    for (const c of crabs) c.draw(ctx);

    // Layer 4: TurnFish (Spinners - Pelagic swimmers)
    for (const f of turnFishes) f.draw(ctx);

    // Layer 5: Ribbon Eels (Sinuous mid-water carcass hunters)
    for (const e of eels) e.draw(ctx);

    // Layer 6: Jellyfish (Translucent bells rendering OVER TurnFish & Eels)
    for (const j of jellies) j.draw(ctx);

    // Layer 7: Predator Fish (Apex hunters in foreground)
    for (const p of predators) p.draw(ctx);

    const drawDur = performance.now() - tDrawStart;
    perfStats.drawTime = perfStats.drawTime * 0.8 + drawDur * 0.2;
};

// Start Main Game Loop
loop([logic, render]);
