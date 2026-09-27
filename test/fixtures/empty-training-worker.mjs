// Exiting cleanly without a validated result/checkpoint must not complete a run.
process.on("message", () => process.exit(0));
