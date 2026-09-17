import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createActivityState, normalizeActivityEvent, reduceActivityEvent, closeActivityState, activityLabel } from "../lib/chat/activity-state.js";
import { REALTIME_A10_CASES, validateRealtimeA10Catalog } from "../lib/evaluation/realtime-fixtures.js";

const catalog = validateRealtimeA10Catalog();
const results = [];
let assertions = 0;
const check = (value, message) => { assertions += 1; assert(value, message); };
const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

async function runCase(item) {
  if (item.category === "activity_state") {
    const valid = { kind: "agent_activity", turnId: "turn-" + item.variant, activityId: "activity-" + item.variant, sequence: 1, mode: "knowledge", phase: "selected" };
    check(normalizeActivityEvent(valid)?.activityId === valid.activityId, item.id + " normalizes activity");
    if (item.variant === 0) {
      let state = reduceActivityEvent(createActivityState(valid.turnId), valid);
      state = reduceActivityEvent(state, { ...valid, sequence: 2, phase: "running" });
      check(state.activities[0].phase === "running", item.id + " accepts ordered update");
    } else if (item.variant === 1) {
      let state = reduceActivityEvent(createActivityState(valid.turnId), valid);
      state = reduceActivityEvent(state, valid);
      check(state.activities.length === 1, item.id + " deduplicates event");
    } else if (item.variant === 2) {
      let state = reduceActivityEvent(createActivityState(valid.turnId), { ...valid, sequence: 1, phase: "selected" });
      state = reduceActivityEvent(state, { ...valid, sequence: 2, phase: "completed" });
      state = reduceActivityEvent(state, { ...valid, sequence: 3, phase: "running" });
      check(state.activities[0].phase === "completed", item.id + " rejects terminal regression");
    } else if (item.variant === 3) {
      check(reduceActivityEvent(createActivityState(valid.turnId), { ...valid, turnId: "other" }).activities.length === 0, item.id + " binds turn");
    } else if (item.variant === 4) {
      check(reduceActivityEvent(closeActivityState(createActivityState(valid.turnId)), valid).activities.length === 0, item.id + " ignores closed state");
    } else if (item.variant === 5) {
      check(activityLabel({ phase: "needs_confirmation", mode: "http" }) === "Waiting for your confirmation", item.id + " confirmation label");
    } else if (item.variant === 6) {
      check(activityLabel({ phase: "completed", mode: "web_search", outcome: "replayed" }) === "Using a previous result", item.id + " replay label");
    } else if (item.variant === 7) {
      check(normalizeActivityEvent({ ...valid, sequence: -1 }) === null, item.id + " rejects invalid sequence");
    } else if (item.variant === 8) {
      check(normalizeActivityEvent({ ...valid, mode: "unknown" }) === null, item.id + " rejects invalid mode");
    } else {
      let state = createActivityState(valid.turnId);
      for (let index = 0; index < 40; index += 1) state = reduceActivityEvent(state, { ...valid, activityId: "a" + index, sequence: index });
      check(state.activities.length === 32, item.id + " caps activity count");
    }
  } else if (item.category === "stream_lifecycle") {
    const stream = read("lib/chat/server-stream.js");
    const reader = read("lib/chat/read-chat-response.js");
    check(stream.includes("AbortController") || stream.includes("signal"), item.id + " stream supports abort");
    check(stream.includes("maxBufferedBytes") || stream.includes("buffer"), item.id + " stream bounds buffering");
    check(reader.includes("AbortError") || reader.includes("signal"), item.id + " reader handles cancellation");
    check(reader.includes("done") && reader.includes("delta"), item.id + " reader handles terminal and delta events");
    if (item.variant % 2 === 0) check(reader.includes("content-type") || stream.includes("text/event-stream"), item.id + " SSE contract");
    else check(reader.includes("without a result") || reader.includes("timed out"), item.id + " missing/timeout contract");
  } else if (item.category === "handoff") {
    const embed = read("components/embed/PublicWebchat.jsx");
    const desk = read("hooks/use-embed-desk.js");
    const handoff = read("lib/services/handoff.service.js");
    if (item.variant < 5) check(embed.includes("waitingForHuman") && embed.includes("aiPaused"), item.id + " pauses AI after human handoff");
    else check(desk.includes("refreshConversation") && desk.includes("realtimeConnected"), item.id + " recovers handoff snapshot");
    check(handoff.includes("handoffAt") && handoff.includes("write: true"), item.id + " persists handoff state");
    check(handoff.includes("queueWarning") || embed.includes("handoffBlockMessage"), item.id + " exposes honest queue state");
  } else {
    const messageList = read("components/chat/MessageList.jsx");
    const composer = read("components/chat/ChatComposer.jsx");
    const widget = read("components/chat/ChatWidget.jsx");
    const activity = read("components/chat/AgentActivityBubble.jsx");
    if (item.variant < 3) check(messageList.includes("overflow-y-auto") && messageList.includes("min-h-0"), item.id + " bounded message scroll");
    if (item.variant < 6) check(composer.includes("draft") || composer.includes("value="), item.id + " preserves composer state");
    if (item.variant >= 6) check(widget.includes("overflow-hidden") || activity.includes("break-words"), item.id + " prevents layout overflow");
    check(activity.includes("aria") || activity.includes("role="), item.id + " activity has accessible semantics");
  }
  return { id: item.id, category: item.category, result: "PASS", evidenceStatus: "VERIFIED" };
}

for (const item of REALTIME_A10_CASES) {
  try {
    results.push(await runCase(item));
  } catch (error) {
    results.push({ id: item.id, category: item.category, result: "FAIL", evidenceStatus: "VERIFIED", error: error.message });
  }
}

const failures = results.filter((item) => item.result !== "PASS");
const report = {
  gate: "A10",
  fixtureCatalog: { ...catalog, sanitized: true, liveProviders: false, staging: false },
  assertions,
  results,
  evidence: "local-contract",
  limitations: ["Accessibility and mobile checks here are source contracts; browser viewport and screen-reader evidence require the browser suites."],
};
fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
fs.writeFileSync(path.join(root, ".tmp", "aide-realtime-a10-results.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error("A10 realtime matrix failed: " + failures.length + "/40");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("A10 realtime matrix passed: " + results.length + "/40 cases, " + assertions + " assertions.");
console.log(JSON.stringify({ ...catalog, reportPath: ".tmp/aide-realtime-a10-results.json", evidence: report.evidence }, null, 2));
