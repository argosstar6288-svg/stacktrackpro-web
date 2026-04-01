export function startTrendWorker() {
  const run = async () => {
    try {
      console.log("[worker:trends] refresh queued");
    } catch (error) {
      console.error("[worker:trends] failed", error);
    }
  };

  setInterval(run, 30 * 60 * 1000);
}
