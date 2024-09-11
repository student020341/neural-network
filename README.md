A simple neural network project

A demonstration is live at https://student020341.github.io/neural-network/

A more advanced demonstration is available at https://student020341.github.io/neural-network/swarm.html

View main.js for an organization of the data (declarations, render functions, etc) and check out hopper.js, flower.js, or fish.js for the drawing and logic of each creature.
The constructors detail what the inputs and outputs are.

# Hopper brain details
- input 0 (top bar) is considering the current distance to the ground
- input 1 (second bar) is considering the current fall velocity
- input 2 (third bar) is considering the time spent not doing anything (small movements may make this appear to jitter)
- output 0 (bottom bar) is controlling extension of the "legs" and the creature will "hop" if there is a big difference in that value between think frames


# Flower brain details
- input 0 (left bar) distance to the star
- output 0 (right bar) grow or shrink


# Fish brain details
- input 0 (bottom fin) considers closeness to whatever wall is in front of it (hsl green to red), the distance it can consider is visualized with a grey sight line
- input 1 (top fin) considers how close the fish is to the ceiling of its bounds
- output 0 (fish direction) facing right if this value is >= 0.5 otherwise facing left
- output 1 (forward velocity) forward fish motion, this value is multiplied by the max fish speed
- output 2 (upward velocity) if the fish gives >= 0.5 on this output it will swim up, otherwise it will sink. Upward swim visualized by bubbles below fish


The age of the fish is also visualized by the color fading. When that resets to a deep blue, the neural network is scrambled, and the behavior may change. This is not visualized
on the other creatures, but their brains are also on short scrambling timers. This can be observed by sudden changes in their outputs. The creatures' behaviors are limited in how
interesting they can be since they are mostly considering factors that are static or affected by their own outputs. I may add a more complex creature in the future, possibly
on its own page.

# Swarm

Still under development, but is currently creatures represented by green dots that are vaguely aware of resources in the environment represented by red dots
