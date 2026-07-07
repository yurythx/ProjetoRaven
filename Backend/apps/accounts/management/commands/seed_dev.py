from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from django.utils.text import slugify
from django.utils import timezone
from apps.accounts.models import User
from apps.blog.models import Category as BlogCategory, Post as BlogPost
from apps.forum.models import ForumCategory, Topic, Reply
import random

class Command(BaseCommand):
    help = 'Seeds the database with development data'

    def _safe_cache_delete(self, key: str) -> None:
        from django.core.cache import cache

        try:
            cache.delete(key)
        except Exception:
            self.stdout.write(self.style.WARNING(f'Cache indisponivel ao limpar {key}; seguindo seed local.'))

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding data...')

        # 1. Create Superuser / Admin
        admin, created = User.objects.get_or_create(
            email='admin@raven.gg',
            defaults={
                'username': 'admin',
                'display_name': 'Grande Mestre',
                'is_staff': True,
                'is_superuser': True,
                'is_verified': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            self.stdout.write(self.style.SUCCESS('Admin created: admin@raven.gg / admin123'))
        else:
            admin.is_verified = True
            admin.is_staff = True
            admin.is_superuser = True
            admin.is_active = True
            admin.set_password('admin123')
            admin.save(update_fields=['is_verified', 'is_staff', 'is_superuser', 'is_active', 'password'])
            self.stdout.write(self.style.SUCCESS('Admin updated: admin@raven.gg / admin123'))

        # Clear login lockout for admin (accumulated from E2E test failures)
        self._safe_cache_delete('login_failures:admin@raven.gg')

        # Ensure groups exist (used across permissions/UI flags)
        for name in ["members", "blog_editors", "forum_moderators"]:
            Group.objects.get_or_create(name=name)

        # 2. Create Player user (E2E tests depend on this account)
        members_group = Group.objects.get(name="members")
        player, created = User.objects.get_or_create(
            email='player@raven.gg',
            defaults={
                'username': 'player',
                'display_name': 'Membro',
                'is_staff': False,
                'is_superuser': False,
                'is_verified': True,
                'is_active': True,
            }
        )
        if created:
            player.set_password('player123')
            player.save()
            player.groups.add(members_group)
            self.stdout.write(self.style.SUCCESS('Player created: player@raven.gg / player123'))
        else:
            player.is_verified = True
            player.is_active = True
            player.set_password('player123')
            player.save(update_fields=['is_verified', 'is_active', 'password'])
            if not player.groups.filter(name='players').exists():
                player.groups.add(members_group)
            self.stdout.write(self.style.SUCCESS('Player updated: player@raven.gg / player123'))

        self._safe_cache_delete('login_failures:player@raven.gg')

        # 2. Create Blog Categories
        blog_cats_data = [
            ('Notícias', 'Novidades e atualizações da plataforma.'),
            ('Tutoriais', 'Guias e artigos educativos da comunidade.'),
            ('Eventos', 'Fique por dentro dos eventos e iniciativas.'),
        ]
        blog_categories = []
        for name, desc in blog_cats_data:
            cat, _ = BlogCategory.objects.get_or_create(
                slug=slugify(name),
                defaults={'name': name, 'description': desc}
            )
            blog_categories.append(cat)

        # 3. Create Blog Posts
        if BlogPost.objects.count() < 5:
            for i in range(1, 6):
                post = BlogPost.objects.create(
                    title=f'Bem-vindo à Comunidade Raven #{i}',
                    slug=f'bem-vindo-comunidade-{i}',
                    excerpt=f'Post de exemplo número {i} da plataforma. Explore o blog e o fórum.',
                    content=f'<h1>Olá, comunidade!</h1><p>Este é um post de exemplo para popular o ambiente de desenvolvimento.</p><ul><li>Blog com categorias e tags</li><li>Fórum com tópicos e respostas</li><li>Sistema de moderação</li></ul>',
                    author=admin,
                    category=random.choice(blog_categories),
                    status=BlogPost.Status.PUBLISHED,
                    published_at=timezone.now(),
                    is_public=True
                )
            self.stdout.write(self.style.SUCCESS('Blog posts created'))

        # 4. Create Forum Categories
        forum_cats_data = [
            ('Geral', 'geral', 'Bate-papo livre sobre qualquer assunto.', '💬'),
            ('Suporte', 'suporte', 'Dúvidas e problemas com a plataforma.', '🛠'),
            ('Apresentações', 'apresentacoes', 'Apresente-se para a comunidade.', '👋'),
        ]
        forum_categories = []
        for name, slug, desc, icon in forum_cats_data:
            cat, _ = ForumCategory.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'description': desc, 'icon': icon}
            )
            forum_categories.append(cat)

        # 5. Create Forum Topics and Replies
        if Topic.objects.count() < 5:
            for i in range(1, 6):
                topic = Topic.objects.create(
                    title=f'Tópico de Exemplo #{i}',
                    slug=f'topico-exemplo-{i}',
                    content='Este é um tópico de exemplo para popular o ambiente de desenvolvimento.',
                    author=admin,
                    category=random.choice(forum_categories),
                    last_reply_at=timezone.now()
                )
                Reply.objects.create(
                    content='Obrigado por compartilhar! Muito útil.',
                    author=admin,
                    topic=topic
                )
                topic.increment_reply_count(admin)
            self.stdout.write(self.style.SUCCESS('Forum topics and replies created'))

        self.stdout.write(self.style.SUCCESS('Database seeding completed!'))
