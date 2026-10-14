import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { artifactPanelTab, artifactTabId, upsertArtifactTab } = await jiti.import("./artifact-tabs.ts");
const { publishSessionArtifacts, resetArtifactStore } = await jiti.import("@/lib/artifact-store");

test("keeps one tab per artifact and re-targets it on reopen", () => {
  let tabs = upsertArtifactTab([], { sessionId: "s", identifier: "a", title: "A" }, 1);
  tabs = upsertArtifactTab(tabs, { sessionId: "s", identifier: "a", title: "A", version: 1 }, 2);
  tabs = upsertArtifactTab(tabs, { sessionId: "s", identifier: "b", title: "B" }, 3);
  assert.deepEqual(tabs.map((tab) => tab.id), [artifactTabId("s", "a"), artifactTabId("s", "b")]);
  assert.deepEqual(tabs[0].versionRequest, { version: 1, nonce: 2 });
});

test("labels the tab with the newest version's title", () => {
  resetArtifactStore();
  const [tab] = upsertArtifactTab([], { sessionId: "s", identifier: "a", title: "Old" }, 1);
  assert.equal(artifactPanelTab(tab).label, "Old");
  publishSessionArtifacts("s", [{ identifier: "a", versions: [
    { title: "Old", type: "html", lang: "html", content: "1", complete: true },
    { title: "Renamed", type: "html", lang: "html", content: "2", complete: true },
  ] }]);
  assert.equal(artifactPanelTab(tab).label, "Renamed");
  assert.equal(artifactPanelTab(tab).kind, "artifact");
});
