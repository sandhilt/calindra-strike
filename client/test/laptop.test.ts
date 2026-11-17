import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, sceneAt } from '../src/game/laptop/scenarios.ts';
test('five complete stories cover laptops, tools, logins and incident feed', () => {
  assert.equal(SCENARIOS.length, 5);
  assert.deepEqual(new Set(SCENARIOS.map(s => s.laptop)), new Set(['macbook', 'thinkpad', 'inspiron']));
  const content = JSON.stringify(SCENARIOS);
  for (const app of ['Cursor', 'VS Code', 'Xcode', 'Grok', 'Claude Code', 'Jira', 'Slack', 'Codex', 'Gemini', 'Chrome', 'Firefox', 'Spotify', 'Netflix', 'Google Workspace', 'Google Calendar', 'GitHub', 'Bitbucket', 'GitHub Actions', 'Bitbucket Pipelines', 'WezTerm', 'iTerm2', 'Node.js', 'console.eitri.tech', 'matrix.eitri.tech', 'calindra.tech']) assert.ok(content.includes(app), app);
  const feeds = SCENARIOS.flatMap(s => s.scenes).filter(e => e.scene.kind === 'browser' && e.scene.page === 'feed');
  const feed = JSON.stringify(feeds);
  for (const topic of ['token npm', 'supply chain CVE', 'Anthropic', 'OpenAI', 'ChatGPT', 'Google Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Moonshot']) assert.ok(feed.includes(topic), topic);
  for (const scenario of SCENARIOS) {
    assert.ok(scenario.scenes.length >= 7 && scenario.scenes.length <= 10);
    for (const { scene, weight } of scenario.scenes) {
      assert.ok(weight > 0);
      if (scene.app === 'Xcode' || scene.app === 'iTerm2') assert.equal(scenario.laptop, 'macbook');
    }
    const last = scenario.scenes.at(-1)?.scene;
    assert.equal(last?.kind, 'terminal');
    if (last?.kind === 'terminal') { assert.match(last.tests.failing, /FAIL/); assert.match(last.tests.passing, /PASS/); }
  }
});
test('weighted scene timeline is monotonic, clamped and covers both endpoints', () => {
  for (const scenario of SCENARIOS) {
    assert.deepEqual(sceneAt(scenario, -1), { index: 0, local: 0 });
    assert.deepEqual(sceneAt(scenario, 2), { index: scenario.scenes.length - 1, local: 1 });
    assert.deepEqual(sceneAt(scenario, NaN), { index: 0, local: 0 });
    let previous = -1; const seen = new Set<number>();
    for (let i = 0; i <= 1000; i++) { const { index, local } = sceneAt(scenario, i / 1000); assert.ok(local >= 0 && local <= 1); assert.ok(index + local >= previous - 1e-10); previous = index + local; seen.add(index); }
    assert.equal(seen.size, scenario.scenes.length);
  }
});
