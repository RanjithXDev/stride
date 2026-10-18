import assert from "node:assert/strict";
import test from "node:test";
import { GitHubProvider } from "./github.provider";
import { GitLabProvider, getGitLabProvider } from "./gitlab.provider";

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

test("GitHub builds OAuth URLs and exchanges successful tokens", { concurrency: false }, async () => {
  const provider = new GitHubProvider("client", "secret");
  const url = new URL(provider.getAuthUrl("state-1", "https://app/callback"));
  assert.equal(url.hostname, "github.com");
  assert.equal(url.searchParams.get("state"), "state-1");
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    assert.equal(init?.method, "POST");
    return jsonResponse({ access_token: "token", token_type: "bearer" });
  };
  try { assert.deepEqual(await provider.exchangeCode("code", "https://app/callback"), { accessToken: "token", tokenType: "bearer" }); }
  finally { global.fetch = original; }
  await assert.rejects(() => provider.refreshToken("refresh"), /do not support/);
});

test("GitHub maps users, repositories, grants, revokes, and access checks", { concurrency: false }, async () => {
  const provider = new GitHubProvider("client", "secret");
  const original = global.fetch;
  const responses = [
    jsonResponse({ id: 1, login: "asha", email: null, avatar_url: "avatar" }),
    jsonResponse([{ id: 2, owner: { login: "org" }, name: "repo", full_name: "org/repo", html_url: "url", default_branch: null, private: true, clone_url: "clone" }]),
    jsonResponse({ id: 2, owner: { login: "org" }, name: "repo", full_name: "org/repo", html_url: "url", private: false }),
    jsonResponse({}, 201), jsonResponse({}, 204), jsonResponse({}, 404),
    jsonResponse({ permission: "push" }),
  ];
  global.fetch = async () => responses.shift()!;
  try {
    assert.deepEqual(await provider.getAuthenticatedUser("token"), { id: "1", username: "asha", email: undefined, avatarUrl: "avatar" });
    assert.equal((await provider.listRepositories("token"))[0].defaultBranch, "main");
    assert.equal((await provider.getRepository("token", "org", "repo")).isPrivate, false);
    assert.equal(await provider.grantAccess("token", "org", "repo", "asha", "VIEWER"), "INVITATION_PENDING");
    await provider.revokeAccess("token", "org", "repo", "asha");
    assert.equal(await provider.checkAccess("token", "org", "repo", "missing"), null);
    assert.deepEqual(await provider.checkAccess("token", "org", "repo", "asha"), { permission: "push", isActive: true });
  } finally { global.fetch = original; }
});

test("GitLab normalizes hosts and handles OAuth, repositories, and memberships", { concurrency: false }, async () => {
  process.env.GITLAB_CLIENT_ID = "client"; process.env.GITLAB_CLIENT_SECRET = "secret";
  process.env.SCM_ALLOWED_HOSTS = "gitlab.example";
  const provider = getGitLabProvider("https://gitlab.example/");
  const authUrl = new URL(provider.getAuthUrl("state", "https://app/callback"));
  assert.equal(authUrl.origin, "https://gitlab.example");
  const original = global.fetch;
  const responses = [
    jsonResponse({ access_token: "access", refresh_token: "refresh", expires_in: 60 }),
    jsonResponse({ access_token: "new", refresh_token: "next" }),
    jsonResponse({ id: 4, username: "asha", email: "a@x.com", avatar_url: "avatar" }),
    jsonResponse([{ id: 5, namespace: { path: "team" }, path: "repo", path_with_namespace: "team/repo", web_url: "url", visibility: "private" }]),
    jsonResponse({}, 409), jsonResponse({}, 204), jsonResponse({ access_level: 40 }),
  ];
  global.fetch = async () => responses.shift()!;
  try {
    const exchanged = await provider.exchangeCode("code", "https://app/callback");
    assert.equal(exchanged.accessToken, "access"); assert.ok(exchanged.expiresAt instanceof Date);
    assert.equal((await provider.refreshToken("refresh")).accessToken, "new");
    assert.equal((await provider.getAuthenticatedUser("token")).username, "asha");
    assert.equal((await provider.listRepositories("token"))[0].isPrivate, true);
    assert.equal(await provider.grantAccess("token", "team", "5", "4", "MAINTAINER"), "ACTIVE");
    await provider.revokeAccess("token", "team", "5", "4");
    assert.deepEqual(await provider.checkAccess("token", "team", "5", "4"), { permission: "MAINTAINER", isActive: true });
  } finally { global.fetch = original; delete process.env.SCM_ALLOWED_HOSTS; }
});

test("providers expose upstream error messages without masking failures", { concurrency: false }, async () => {
  const original = global.fetch;
  global.fetch = async () => jsonResponse({ message: "denied", error: "bad", error_description: "bad code" }, 401);
  try {
    await assert.rejects(() => new GitHubProvider("c", "s").getAuthenticatedUser("bad"), /denied/);
    await assert.rejects(() => new GitLabProvider().exchangeCode("bad", "callback"), /bad code/);
  } finally { global.fetch = original; }
});
