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
            admin.set_password('admin123')
            admin.save(update_fields=['is_verified', 'is_staff', 'is_superuser', 'password'])
            self.stdout.write(self.style.SUCCESS('Admin updated: admin@raven.gg / admin123'))

        # Ensure groups exist (used across permissions/UI flags)
        for name in ["players", "blog_editors", "forum_moderators"]:
            Group.objects.get_or_create(name=name)

        # 2. Create Player user (E2E tests depend on this account)
        players_group = Group.objects.get(name="players")
        player, created = User.objects.get_or_create(
            email='player@raven.gg',
            defaults={
                'username': 'player',
                'display_name': 'Aventureiro',
                'is_staff': False,
                'is_superuser': False,
                'is_verified': True,
                'is_active': True,
            }
        )
        if created:
            player.set_password('player123')
            player.save()
            player.groups.add(players_group)
            self.stdout.write(self.style.SUCCESS('Player created: player@raven.gg / player123'))
        else:
            player.is_verified = True
            player.set_password('player123')
            player.save(update_fields=['is_verified', 'password'])
            if not player.groups.filter(name='players').exists():
                player.groups.add(players_group)
            self.stdout.write(self.style.SUCCESS('Player updated: player@raven.gg / player123'))

        # 2. Create Blog Categories
        blog_cats_data = [
            ('Patch Notes', 'Notas de atualização e mudanças de balanceamento.'),
            ('Lore', 'Histórias e contos do universo de Raven.'),
            ('Eventos', 'Fique por dentro dos eventos temporários.'),
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
                    title=f'Atualização do Servidor v1.{i}',
                    slug=f'patch-notes-v1-{i}',
                    excerpt=f'Resumo das principais mudanças da versão 1.{i}. Novos itens e balanceamento de classes.',
                    content=f'<h1>O que há de novo?</h1><p>Nesta atualização, focamos em melhorar a estabilidade e adicionar novos desafios.</p><ul><li>Novo boss: Dragão das Sombras</li><li>Ajuste de dano para Arqueiros</li><li>Correção de bugs na interface do fórum</li></ul>',
                    author=admin,
                    category=random.choice(blog_categories),
                    status=BlogPost.Status.PUBLISHED,
                    published_at=timezone.now(),
                    is_public=True
                )
            self.stdout.write(self.style.SUCCESS('Blog posts created'))

        # 4. Create Forum Categories
        forum_cats_data = [
            ('Estratégia', 'estrategia', 'Discussões sobre builds e guias.', '⚔'),
            ('Bug Report', 'bug-report', 'Relate erros encontrados no jogo.', '🐛'),
            ('Geral', 'geral', 'Bate-papo livre sobre qualquer assunto.', '💬'),
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
                    title=f'Guia Completo para Iniciantes #{i}',
                    slug=f'guia-iniciantes-{i}',
                    content='Este é um guia básico para quem está começando sua jornada em Raven.',
                    author=admin,
                    category=random.choice(forum_categories),
                    last_reply_at=timezone.now()
                )
                Reply.objects.create(
                    content='Muito obrigado pelo guia, ajudou bastante!',
                    author=admin,
                    topic=topic
                )
                topic.increment_reply_count(admin)
            self.stdout.write(self.style.SUCCESS('Forum topics and replies created'))

        self.stdout.write(self.style.SUCCESS('Database seeding completed!'))
