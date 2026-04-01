if (import.meta.main) {
    const isWorker = typeof (globalThis as any).WorkerGlobalScope !== 'undefined';
    console.log("Is Worker:", isWorker);
    console.log("Constructor Name:", globalThis.constructor.name);
    if (!isWorker) {
        console.log("In Main, starting worker...");
        new Worker(import.meta.url, { type: "module" });
    } else {
        console.log("In Worker");
    }
}
