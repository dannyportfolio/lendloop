import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Dispatches pending outbox events to n8n webhook receiver every 1 minute
crons.interval(
  "dispatch-outbox-events",
  { minutes: 1 },
  internal.automation.dispatchPendingEvents,
  { maxBatchSize: 20 }
);

// Recovers events locked in 'processing' state if worker crashed (> 5 minutes)
crons.interval(
  "recover-stale-outbox-events",
  { minutes: 5 },
  internal.automation.recoverStaleProcessingEvents,
  {}
);

export default crons;
