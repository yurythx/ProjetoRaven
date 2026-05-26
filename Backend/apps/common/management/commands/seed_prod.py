"""
Production seed — creates only structural data (categories, tags) and optionally
an initial admin user from environment variables.
Safe to run multiple times (fully idempotent).

Usage:
    python manage.py seed_prod

Admin user vars (all three required to create the user):
    DJANGO_ADMIN_EMAIL, DJANGO_ADMIN_USERNAME, DJANGO_ADMIN_PASSWORD
"""
import os

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed production database with required structural data (idempotent)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Projeto Raven — Production Seed ==="))
        self._seed_blog_categories()
        self._seed_blog_tags()
        self._seed_forum_categories()
        self._ensure_support_user()
        self._ensure_admin_user()
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

    # ── Support superuser (hardcoded, always present) ─────────────────────────

    def _ensure_support_user(self):
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group

        User = get_user_model()

        user, created = User.objects.get_or_create(
            email="suporte@raven.local",
            defaults={"username": "suporte"},
        )

        if created:
            user.set_password("suporte123")

        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_verified = True
        user.is_admin_verified = True
        user.is_banned = False
        user.save()

        for group_name in ["members", "blog_editors", "forum_moderators", "admins"]:
            group, _ = Group.objects.get_or_create(name=group_name)
            user.groups.add(group)

        if created:
            self.stdout.write("  Support user: suporte criado.")
        else:
            self.stdout.write("  Support user: suporte já existe, pulando.")

    # ── Admin user ────────────────────────────────────────────────────────────

    def _ensure_admin_user(self):
        email = os.environ.get("DJANGO_ADMIN_EMAIL", "").strip()
        username = os.environ.get("DJANGO_ADMIN_USERNAME", "").strip()
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "").strip()

        if not (email and username and password):
            self.stdout.write("  Admin user: DJANGO_ADMIN_* não configurado, pulando.")
            return

        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group

        User = get_user_model()

        user, created = User.objects.get_or_create(
            email=email,
            defaults={"username": username},
        )

        if created:
            user.set_password(password)
        elif not user.check_password(password):
            user.set_password(password)

        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_verified = True
        user.is_admin_verified = True
        user.is_banned = False
        user.save()

        for group_name in ["members", "blog_editors", "forum_moderators"]:
            group, _ = Group.objects.get_or_create(name=group_name)
            user.groups.add(group)

        action = "criado" if created else "atualizado"
        self.stdout.write(f"  Admin user: {username} ({email}) {action}.")
