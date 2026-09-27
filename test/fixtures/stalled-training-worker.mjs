// Test-only unresponsive child: the supervising deadline must terminate this PID.
process.on("message", () => { for (;;) { /* intentionally synchronous */ } });
