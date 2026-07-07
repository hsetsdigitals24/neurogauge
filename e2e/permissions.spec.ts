import { test, expect } from "@playwright/test";
import { QA_USERS, QA_PROJECT_PREFIX } from "./helpers/db";
import { loginContext } from "./helpers/auth";

// Multi-researcher access control (QA report "Areas Requiring Functional
// Verification" #5) plus unauthenticated assessment links (#2).
test.describe("multi-researcher permissions", () => {
  test("strangers are locked out; invited collaborators get scoped access", async ({ browser }) => {
    test.setTimeout(180_000);

    const owner = await loginContext(browser, QA_USERS.owner);
    const stranger = await loginContext(browser, QA_USERS.stranger);
    const collab = await loginContext(browser, QA_USERS.collab);

    // Owner creates a project
    const projRes = await owner.api.post("/api/projects", {
      data: { name: `${QA_PROJECT_PREFIX}perms-${Date.now()}` },
    });
    expect(projRes.status()).toBe(201);
    const project = await projRes.json();

    // ── Stranger (authenticated, unrelated researcher): everything 403 ──
    expect((await stranger.api.get(`/api/projects/${project.id}`)).status()).toBe(403);
    expect((await stranger.api.get(`/api/projects/${project.id}/sessions`)).status()).toBe(403);
    expect((await stranger.api.get(`/api/projects/${project.id}/export?format=wide`)).status()).toBe(403);
    const strangerInvite = await stranger.api.post(`/api/projects/${project.id}/invite`, {
      data: { email: QA_USERS.stranger.email },
    });
    expect(strangerInvite.status()).toBe(403);

    // ── Unauthenticated: 401 on researcher APIs, 200 on the public share link ──
    const anon = await browser.newContext();
    expect((await anon.request.get(`/api/projects/${project.id}/export?format=wide`)).status()).toBe(401);
    expect((await anon.request.get(`/api/projects/${project.id}`)).status()).toBe(401);
    const pub = await anon.request.get(`/api/public/${project.shareToken}`);
    expect(pub.status()).toBe(200); // participants need no login (QA report item 2)
    expect((await pub.json()).id).toBe(project.id);

    // ── Invite flow ──
    const inviteRes = await owner.api.post(`/api/projects/${project.id}/invite`, {
      data: { email: QA_USERS.collab.email },
    });
    expect(inviteRes.status()).toBe(200);
    const invitePayload = await inviteRes.json();
    const token = invitePayload.invite?.token ?? invitePayload.inviteLink.split("/invites/")[1];
    expect(token).toBeTruthy();

    // Wrong user (stranger) cannot accept an invite addressed to collab
    const wrongAccept = await stranger.api.post(`/api/invites/${token}`);
    expect(wrongAccept.status()).toBe(403);

    // Unauthenticated accept → 401
    expect((await anon.request.post(`/api/invites/${token}`)).status()).toBe(401);

    // Correct user accepts
    const accept = await collab.api.post(`/api/invites/${token}`);
    expect(accept.status()).toBe(200);

    // Re-accepting → 409 already accepted
    expect((await collab.api.post(`/api/invites/${token}`)).status()).toBe(409);

    // ── Collaborator: read access granted, owner-only actions still denied ──
    expect((await collab.api.get(`/api/projects/${project.id}`)).status()).toBe(200);
    expect((await collab.api.get(`/api/projects/${project.id}/sessions`)).status()).toBe(200);
    expect((await collab.api.get(`/api/projects/${project.id}/export?format=wide`)).status()).toBe(200);
    const collabInvite = await collab.api.post(`/api/projects/${project.id}/invite`, {
      data: { email: QA_USERS.stranger.email },
    });
    expect(collabInvite.status()).toBe(403); // only owners can invite

    // Stranger is STILL locked out after all this
    expect((await stranger.api.get(`/api/projects/${project.id}`)).status()).toBe(403);

    // Legacy export endpoint must not be an auth bypass
    const legacy = await anon.request.get(`/api/export?projectId=${project.id}`);
    expect([401, 403, 404, 400]).toContain(legacy.status());

    await anon.close();
    await owner.context.close();
    await stranger.context.close();
    await collab.context.close();
  });
});
