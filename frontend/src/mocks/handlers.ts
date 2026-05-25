/**
 * MSW handlers para desenvolvimento offline.
 *
 * Para usar:
 *   1. Execute `npm run msw:init` para gerar o service worker em /public/
 *   2. Inicie o app com NEXT_PUBLIC_MSW=true (veja browser.ts)
 *
 * Adicione handlers aqui para simular endpoints do backend.
 */
import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/api/v1";

// ─── Fixtures ──────────────────────────────────────────────────────────────
const fakeUser = {
  id: "00000000-0000-0000-0000-000000000001",
  uuid: "00000000-0000-0000-0000-000000000001",
  email: "dev@raven.local",
  username: "devuser",
  display_name: "Dev User",
  is_verified: true,
  is_admin_verified: false,
  is_banned: false,
  is_staff: false,
  is_superuser: false,
  is_admin: false,
  is_blog_editor: false,
  is_forum_moderator: false,
  totp_enabled: false,
  groups: [],
  permissions: [],
  date_joined: new Date().toISOString(),
  last_login: new Date().toISOString(),
  last_login_ip: null,
};

const fakeTokens = {
  access: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.mock_access_token",
  refresh: "mock_refresh_token",
};

// ─── Auth ──────────────────────────────────────────────────────────────────
export const handlers = [
  http.post(`${BASE}/accounts/login/`, () =>
    HttpResponse.json({ user: fakeUser, tokens: fakeTokens })
  ),

  http.post(`${BASE}/accounts/register/`, () =>
    HttpResponse.json({ verification_required: true, email: "dev@raven.local" }, { status: 201 })
  ),

  http.post(`${BASE}/accounts/token/refresh/`, () =>
    HttpResponse.json({ access: fakeTokens.access })
  ),

  http.get(`${BASE}/accounts/me/`, () =>
    HttpResponse.json(fakeUser)
  ),

  // ─── Blog ─────────────────────────────────────────────────────────────
  http.get(`${BASE}/blog/public/posts/`, () =>
    HttpResponse.json({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: "post-0001",
          title: "Bem-vindo ao Projeto Raven",
          slug: "bem-vindo-ao-projeto-raven",
          excerpt: "O MMORPG brasileiro está chegando.",
          status: "published",
          is_public: true,
          is_featured: true,
          author_name: "Admin",
          published_at: new Date().toISOString(),
          image: null,
          category_name: "Notícias",
          tags: [],
        },
      ],
    })
  ),

  // ─── Forum ────────────────────────────────────────────────────────────
  http.get(`${BASE}/forum/topics/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "topic-0001",
          title: "Sugestões para o jogo",
          slug: "sugestoes-para-o-jogo",
          author: { display_name: "Dev User" },
          category: { name: "Geral", slug: "geral" },
          reply_count: 3,
          view_count: 42,
          is_pinned: false,
          is_locked: false,
          created_at: new Date().toISOString(),
        },
      ],
    })
  ),

  // ─── Health ───────────────────────────────────────────────────────────
  http.get(`${BASE.replace("/v1", "")}/health/live/`, () =>
    HttpResponse.json({ status: "ok" })
  ),

  http.get(`${BASE.replace("/v1", "")}/health/ready/`, () =>
    HttpResponse.json({ status: "ok", checks: { db: true, cache: true, celery: true } })
  ),
];
