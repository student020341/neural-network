export default async function(logic, render) {
    while(true) {
        let t2 = performance.now();
        await new Promise(resolve => requestAnimationFrame(t1 => {
            // delta time
            const dt = (t1 - t2) / 1000;
            // do not run latency greater than 1 second
            if (dt > 1) {
                resolve();
                return;
            }

            logic(dt);

            render(dt);

            resolve();
        }));
    }
}
