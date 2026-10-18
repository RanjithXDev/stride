import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAllowedScmHost } from "./scm-host";

test("SCM host validation accepts only explicitly allowlisted HTTPS origins", { concurrency: false }, () => {
  process.env.SCM_ALLOWED_HOSTS = "gitlab.example";
  try {
    assert.equal(normalizeAllowedScmHost("https://gitlab.com/"), "https://gitlab.com");
    assert.equal(normalizeAllowedScmHost("https://gitlab.example"), "https://gitlab.example");
    assert.throws(() => normalizeAllowedScmHost("http://gitlab.example"), /HTTPS origin/);
    assert.throws(() => normalizeAllowedScmHost("https://127.0.0.1"), /allowlisted/);
    assert.throws(() => normalizeAllowedScmHost("https://gitlab.example/path"), /HTTPS origin/);
    assert.throws(() => normalizeAllowedScmHost("https://user:pass@gitlab.example"), /HTTPS origin/);
  } finally { delete process.env.SCM_ALLOWED_HOSTS; }
});
