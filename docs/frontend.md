# Frontend — Next.js Portal

Interface web construída com **Next.js 15**, focada em performance, SEO e UX de alta qualidade.

---

## Stack

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Estilização | Tailwind CSS v4 |
| Estado servidor | TanStack Query v5 (React Query) |
| HTTP | Route Handlers do Next.js (`src/app/api/*`) + `fetch` (BFF/proxy para o backend) |
| Formulários | React Hook Form + Zod |
| Animações | Framer Motion |
| Editor de texto | TipTap |
| Testes unitários | Vitest + Testing Library |
| Testes E2E | Playwright |

---

## Páginas (`src/app/`)

### Públicas

| Rota | Descrição |
|---|---|
| `/` | Landing page — hero, features, CTA |
| `/login` | Autenticação com JWT |
| `/register` | Registro de conta |
| `/forgot-password` | Solicitação de reset via OTP |
| `/reset-password` | Confirmação com código OTP |
| `/verify-email` | Verificação de e-mail |
| `/auth/2fa` | Etapa 2 de login com TOTP — recebe `?token=<partial_token>` |
| `/blog` | Portal de notícias com lista de posts |
| `/blog/[slug]` | Post completo com comentários |
| `/forum` | Lista de tópicos recentes |
| `/forum/c/[slug]` | Categoria do fórum |
| `/forum/t/[slug]` | Tópico com replies e reações |
| `/forum/new` | Criar novo tópico |

### Autenticadas

| Rota | Descrição |
|---|---|
| `/me` | Perfil do usuário — configurações de conta, 2FA, amigos |

### Dashboard Admin

| Rota | Acesso | Descrição |
|---|---|---|
| `/dashboard` | staff/editor/mod | Visão geral com cards de métricas |
| `/dashboard/usuarios` | Admin | Gerenciar usuários e permissões |
| `/dashboard/blog` | Editor | Gerenciar posts (criar, editar, publicar) |
| `/dashboard/forum/moderation` | Moderador | Fila de moderação do fórum |
| `/dashboard/auditoria` | Admin | Log de auditoria de ações administrativas |
| `/dashboard/configuracoes/email` | Admin | Configuração de SMTP |
| `/dashboard/configuracoes/diagnosticos` | Admin | Diagnóstico de saúde dos serviços |
| `/dashboard/configuracoes/backup` | Superadmin | Backup/restore (DB + mídia) com jobs, logs, verificação e retenção |

---

## Arquitetura de Dados

### `src/lib/fetch.ts`
Wrapper `jsonFetch` para Next.js Server Components (não usa Axios). Usado em SSR para SEO (blog, fórum).

### `src/app/api/*` (BFF)
O frontend expõe rotas internas (`/api/...`) que fazem proxy para o backend Django (`/api/v1/...`) e gerenciam cookies httpOnly (login/refresh/session).

Grupos de rotas BFF:

| Prefixo | Descrição |
|---|---|
| `/api/auth/*` | Login, logout, refresh, session, 2FA, OAuth |
| `/api/accounts/*` | Perfil, avatar, senha, amigos, push |
| `/api/blog/*` | Posts, categorias, tags, comentários |
| `/api/forum/*` | Categorias, tópicos, replies, reações |
| `/api/media/files` | Listagem e upload de imagens (GET/POST) |
| `/api/media/files/[id]` | Deleção de arquivo de mídia (DELETE) |
| `/api/blog-admin/*` | Gerenciamento de posts (dashboard) |
| `/api/accounts-admin/*` | Gerenciamento de usuários (dashboard) |

---

## Variáveis de Ambiente

```bash
# .env.local (desenvolvimento)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8006   # URL do backend acessível pelo browser
NEXT_PUBLIC_SITE_URL=http://localhost:3006       # URL pública do frontend
INTERNAL_API_BASE_URL=http://django:8000         # URL interna do Django (SSR dentro do Docker)
```

Em produção (Cloudflare Tunnel):

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.projetoraven.cloud
NEXT_PUBLIC_SITE_URL=https://projetoraven.cloud
INTERNAL_API_BASE_URL=http://django:8000
```

> **`NEXT_PUBLIC_API_BASE_URL`** é embutida no bundle do browser em build-time e usada por `fixImageUrl` para construir URLs absolutas de mídia quando o caminho é relativo.

### Mídia — `fixImageUrl(url)`

Todas as URLs de imagens vindas do backend devem passar por `fixImageUrl` (`src/lib/utils.ts`) antes de serem renderizadas:

| Entrada | Saída | Situação |
|---|---|---|
| `http://django:8000/media/...` | `/media/...` | URL interna Docker — removida, retorna só o path |
| `/media/uploads/abc.jpg` | `http://localhost:8006/media/uploads/abc.jpg` | Caminho relativo — prepend API base |
| `https://cdn.exemplo.com/img.png` | `https://cdn.exemplo.com/img.png` | URL externa — sem alteração |

O Next.js reescreve `/media/*` → `http://django:8000/media/*` server-side (ver `next.config.ts`), portanto rotas relativas funcionam em qualquer ambiente sem depender de portas expostas.

---

## Design System

Todas as classes customizadas seguem o prefixo `rv-`:

| Classe | Uso |
|---|---|
| `rv-card` | Card com borda, fundo semi-transparente e hover |
| `rv-btn`, `rv-btn-primary`, `rv-btn-ghost` | Botões com variantes |
| `rv-badge`, `rv-badge-purple`, `rv-badge-cyan` | Badges coloridos |
| `rv-display` | Fonte display (títulos) |
| `rv-label` | Texto label em caps/tracking |
| `rv-orb` | Elemento de glow ambiental circular |
| `rv-glow-purple` | Shadow glow violeta |
| `rv-divider` | Divisor horizontal com gradiente |

Cores principais (`globals.css`): `--rv-accent` (violeta), `--rv-cyan`, `--rv-gold`, `--rv-red`.

---

## Componentes Principais (`src/components/`)

| Arquivo | Descrição |
|---|---|
| `auth-provider.tsx` | Contexto de autenticação (session, login/logout) |
| `auth/protected.tsx` | Wrapper de rota protegida |
| `oauth-buttons.tsx` | Botões Google/Discord OAuth |
| `app-header.tsx` | Navegação global |
| `query-provider.tsx` | TanStack Query provider |
| `theme-provider.tsx` / `theme-toggle.tsx` | Dark/light mode |
| `forum-rich-editor.tsx` | Editor TipTap para tópicos e replies |
| `reply-composer.tsx` | Formulário de nova resposta |
| `reply-reactions.tsx` / `topic-reactions.tsx` | UI de reações |
| `reply-moderation-actions.tsx` / `topic-moderation-actions.tsx` | Ações de moderação |
| `cms/preview-dialog.tsx` | Preview de post antes de publicar |
| `features/media/media-dialog.tsx` | Biblioteca de mídia — galeria, upload, URL externa, deleção |
| `ui/data-table.tsx` | Tabela ordenável e paginada (Radix UI) |
| `ui/rich-editor.tsx` | Wrapper do TipTap |
| `error-boundary.tsx` | Tratamento de erros em componentes |

---

## Testes

### Unitários (Vitest + Testing Library)

```bash
cd frontend
npm test              # vitest run
npm run test:watch    # modo watch
npx tsc --noEmit      # type check
```

Cobrem: auth provider, blog comments, forum reactions, reply composer, moderação e sanitização de HTML.

### E2E (Playwright)

```bash
cd frontend
npx playwright test                   # roda contra dev server local (porta 3000)
E2E_TARGET=docker npx playwright test # roda contra deploy Docker
```

Suítes disponíveis em `frontend/e2e/`:

| Arquivo | O que testa |
|---|---|
| `public-pages.spec.ts` | Home, login, register, blog, health check |
| `security-2fa.spec.ts` | SecurityCard em `/me`, ativação 2FA, redirect em rotas protegidas |
| `api-bff.spec.ts` | Rotas BFF: blog, forum, health/live, health/ready |

---

## Scripts

```bash
npm run dev      # servidor de desenvolvimento (porta 3000)
npm run build    # build de produção
npm run start    # inicia build de produção
npm run lint     # ESLint
```
