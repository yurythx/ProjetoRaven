"""
Production seed — creates only structural data (categories, tags).
Safe to run multiple times (fully idempotent).
Does NOT create users, fake posts, or topics with random data.

Usage:
    python manage.py seed_prod
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed production database with required structural data (idempotent)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Projeto Raven — Production Seed ==="))
        self._seed_blog_categories()
        self._seed_blog_tags()
        self._seed_forum_categories()
        self.stdout.write(self.style.SUCCESS("=== Seed concluído com sucesso ==="))

    # ── Blog ──────────────────────────────────────────────────────────────────

    def _seed_blog_categories(self):
        from apps.blog.models import Category

        categories = [
            {"name": "Novidades",     "slug": "novidades",     "description": "Novidades e atualizações do projeto."},
            {"name": "Tutoriais",     "slug": "tutoriais",     "description": "Guias e tutoriais passo a passo."},
            {"name": "Anúncios",      "slug": "anuncios",      "description": "Comunicados e anúncios oficiais."},
            {"name": "Comunidade",    "slug": "comunidade",    "description": "Histórias e destaques da comunidade."},
            {"name": "Devlog",        "slug": "devlog",        "description": "Bastidores do desenvolvimento."},
        ]

        created = 0
        for data in categories:
            _, is_new = Category.objects.get_or_create(
                slug=data["slug"],
                defaults={"name": data["name"], "description": data["description"], "is_active": True},
            )
            if is_new:
                created += 1

        self.stdout.write(f"  Blog categories: {created} criadas, {len(categories) - created} já existiam.")

    def _seed_blog_tags(self):
        from apps.blog.models import Tag

        tags = [
            ("update",      "update"),
            ("roadmap",     "roadmap"),
            ("tutorial",    "tutorial"),
            ("comunidade",  "comunidade"),
            ("devlog",      "devlog"),
            ("segurança",   "seguranca"),
            ("dica",        "dica"),
        ]

        created = 0
        for name, slug in tags:
            _, is_new = Tag.objects.get_or_create(slug=slug, defaults={"name": name})
            if is_new:
                created += 1

        self.stdout.write(f"  Blog tags: {created} criadas, {len(tags) - created} já existiam.")

    # ── Forum ─────────────────────────────────────────────────────────────────

    def _seed_forum_categories(self):
        from apps.forum.models import ForumCategory

        categories = [
            {
                "name": "Geral",
                "slug": "geral",
                "description": "Discussões gerais sobre a comunidade e o projeto.",
                "icon": "💬",
                "display_order": 1,
            },
            {
                "name": "Anúncios",
                "slug": "anuncios-forum",
                "description": "Comunicados oficiais. Somente moderadores postam aqui.",
                "icon": "📢",
                "display_order": 2,
            },
            {
                "name": "Suporte",
                "slug": "suporte",
                "description": "Dúvidas técnicas e problemas com a plataforma.",
                "icon": "🛠️",
                "display_order": 3,
            },
            {
                "name": "Sugestões",
                "slug": "sugestoes",
                "description": "Ideias e propostas de melhoria para o projeto.",
                "icon": "💡",
                "display_order": 4,
            },
            {
                "name": "Apresentações",
                "slug": "apresentacoes",
                "description": "Apresente-se à comunidade Raven.",
                "icon": "👋",
                "display_order": 5,
            },
            {
                "name": "Off-topic",
                "slug": "off-topic",
                "description": "Assuntos variados não relacionados ao projeto.",
                "icon": "🎲",
                "display_order": 6,
            },
        ]

        created = 0
        for data in categories:
            _, is_new = ForumCategory.objects.get_or_create(
                slug=data["slug"],
                defaults={
                    "name": data["name"],
                    "description": data["description"],
                    "icon": data.get("icon", ""),
                    "display_order": data["display_order"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1

        self.stdout.write(f"  Forum categories: {created} criadas, {len(categories) - created} já existiam.")
