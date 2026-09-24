/**
 * MCP tool risk is fail-closed: READ needs evidence; side-effect names are never READ.
 * Run: node scripts/test-mcp-risk-classification.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectMcpWriteRisk,
  inferMcpToolRisk,
  legacyInferMcpToolRisk,
  reclassifyStoredMcpToolRisk,
} from "../lib/mcp/client.js";

const risk = (name, annotations) => inferMcpToolRisk(name, annotations).riskLevel;

test("GitHub MCP side-effect tools previously stored as READ are WRITE", () => {
  for (const name of ["merge_pull_request", "push_files", "fork_repository", "request_copilot_review", "run_secret_scanning"]) {
    assert.equal(legacyInferMcpToolRisk(name).riskLevel, "READ", `${name} was READ before`);
    assert.equal(risk(name), "WRITE", name);
    assert.equal(inferMcpToolRisk(name).requiresConfirmation, true, name);
  }
});

test("GitHub MCP read tools stay READ; writes and deletes are classified", () => {
  const reads = ["get_me", "get_commit", "get_file_contents", "list_commits", "search_repositories", "issue_read", "pull_request_read", "list_pull_requests", "get_release_by_tag", "list_repository_collaborators", "search_code"];
  for (const name of reads) assert.equal(risk(name), "READ", name);
  const writes = ["create_branch", "add_issue_comment", "issue_write", "sub_issue_write", "pull_request_review_write", "update_pull_request_branch", "create_or_update_file"];
  for (const name of writes) assert.equal(risk(name), "WRITE", name);
  assert.equal(risk("delete_file"), "DESTRUCTIVE");
});

test("unknown names fail closed unless the server marks them read-only", () => {
  assert.equal(risk("aide_demo_get_time"), "WRITE");
  assert.equal(risk("aide_demo_get_time", { readOnlyHint: true }), "READ");
  assert.equal(risk("frobnicate_widget"), "WRITE");
  assert.equal(risk("frobnicate_widget", { destructiveHint: true }), "DESTRUCTIVE");
});

test("server annotations cannot downgrade a side-effect name", () => {
  assert.equal(risk("merge_pull_request", { readOnlyHint: true }), "WRITE");
  assert.equal(risk("delete_file", { readOnlyHint: true }), "DESTRUCTIVE");
});

test("stored rows: auto-seeded risk is reclassified, owner overrides only tighten", () => {
  assert.deepEqual(reclassifyStoredMcpToolRisk({ name: "merge_pull_request", riskLevel: "READ", requiresConfirmation: false }), { riskLevel: "WRITE", requiresConfirmation: true });
  // Owner deliberately made a read require confirmation: keep it.
  assert.deepEqual(reclassifyStoredMcpToolRisk({ name: "get_me", riskLevel: "READ", requiresConfirmation: true }), { riskLevel: "READ", requiresConfirmation: true });
  // Owner marked a write DESTRUCTIVE: never loosened.
  assert.equal(reclassifyStoredMcpToolRisk({ name: "create_branch", riskLevel: "DESTRUCTIVE", requiresConfirmation: true }).riskLevel, "DESTRUCTIVE");
  // Seeded legacy READ for a read-only-annotated unknown name stays READ with the annotation.
  assert.equal(reclassifyStoredMcpToolRisk({ name: "aide_demo_get_time", riskLevel: "READ", requiresConfirmation: false }, { readOnlyHint: true }).riskLevel, "READ");
});

test("runtime guard detects only evident side effects", () => {
  assert.equal(detectMcpWriteRisk("merge_pull_request"), "WRITE");
  assert.equal(detectMcpWriteRisk("delete_file"), "DESTRUCTIVE");
  assert.equal(detectMcpWriteRisk("pull_request_read"), null);
  assert.equal(detectMcpWriteRisk("aide_demo_get_time"), null);
});
