import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import User
from apps.blog.models import Category as BlogCategory, Post, Tag
from apps.forum.models import ForumCategory, Topic, Reply as ForumReply


class Command(BaseCommand):
    help = "Seed the database with initial data for development and testing."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("--- STARTING SEEDING ---"))

        # 1. Admin User
        admin = User.objects.filter(username="admin").first()
        if not admin:
            admin = User.objects.create_superuser(
                email="admin@raven.gg",
                username="admin",
                password="changeme",
                display_name="Raven Admin"
            )
            self.stdout.write(f"Admin user created: {admin.email}")
        else:
            admin.is_staff = True
            admin.is_superuser = True
            admin.set_password("changeme")
            admin.save()
            self.stdout.write(f"Admin user updated/ready: {admin.username}")

        # 2. Blog Categories and Posts
        news_cat, _ = BlogCategory.objects.get_or_create(
            name="Novidades",
            defaults={"slug": "novidades", "description": "Novidades e atualizações do projeto."}
        )
        tutorials_cat, _ = BlogCategory.objects.get_or_create(
            name="Tutoriais",
            defaults={"slug": "tutoriais", "description": "Guias e tutoriais."}
        )
        announcements_cat, _ = BlogCategory.objects.get_or_create(
            name="Anúncios",
            defaults={"slug": "anuncios", "description": "Anúncios oficiais."}
        )

        tags_data = ["update", "roadmap", "tutorial", "comunidade", "devlog"]
        tags = {}
        for tag_name in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_name, defaults={"slug": tag_name})
            tags[tag_name] = tag

        posts_to_seed = [
            {
                "title": "Bem-vindo ao Projeto Raven!",
                "slug": "bem-vindo-ao-projeto-raven",
                "excerpt": "Apresentação oficial do projeto e o que esperar.",
                "content": "# Bem-vindo!\n\nEste é o portal oficial do Projeto Raven. Fique por dentro de todas as novidades.",
                "category": announcements_cat,
                "tag_keys": ["comunidade"],
                "is_featured": True,
            },
            {
                "title": "Atualização v1.0 — Novidades do Blog e Fórum",
                "slug": "atualizacao-v1-0",
                "excerpt": "Resumo das principais melhorias desta versão.",
                "content": "# Atualização v1.0\n\nBlog e fórum com autenticação JWT, 2FA e mais.",
                "category": news_cat,
                "tag_keys": ["update", "devlog"],
            },
            {
                "title": "Como usar o Fórum",
                "slug": "como-usar-o-forum",
                "excerpt": "Guia rápido para publicar tópicos e interagir na comunidade.",
                "content": "# Guia do Fórum\n\nCrie tópicos, responda e reaja às publicações.",
                "category": tutorials_cat,
                "tag_keys": ["tutorial"],
            },
            {
                "title": "Roteiro 2025 — O que vem por aí",
                "slug": "roteiro-2025",
                "excerpt": "Confira o planejamento de funcionalidades para 2025.",
                "content": "# Roteiro 2025\n\nNovas features planejadas: notificações push, OAuth melhorado e muito mais.",
                "category": news_cat,
                "tag_keys": ["roadmap"],
            },
        ]

        for p in posts_to_seed:
            post, created = Post.objects.get_or_create(
                slug=p["slug"],
                defaults={
                    "title": p["title"],
                    "excerpt": p["excerpt"],
                    "content": p["content"],
                    "status": "published",
                    "author": admin,
                    "category": p["category"],
                    "is_featured": p.get("is_featured", False),
                    "published_at": timezone.now(),
                    "view_count": random.randint(10, 500),
                }
            )
            if created:
                for tag_key in p.get("tag_keys", []):
                    post.tags.add(tags[tag_key])

        self.stdout.write(f"Seeded {len(posts_to_seed)} blog posts.")

        # 3. Forum Categories and Topics
        forum_cats = [
            {"name": "Geral", "slug": "geral", "description": "Discussões gerais sobre o projeto.", "order": 1},
            {"name": "Suporte", "slug": "suporte", "description": "Dúvidas e problemas técnicos.", "order": 2},
            {"name": "Sugestões", "slug": "sugestoes", "description": "Ideias e melhorias para o projeto.", "order": 3},
            {"name": "Apresentações", "slug": "apresentacoes", "description": "Apresente-se à comunidade.", "order": 4},
        ]

        created_cats = {}
        for cat_data in forum_cats:
            cat, _ = ForumCategory.objects.get_or_create(
                slug=cat_data["slug"],
                defaults={
                    "name": cat_data["name"],
                    "description": cat_data["description"],
                    "display_order": cat_data["order"],
                }
            )
            created_cats[cat_data["slug"]] = cat

        topics_to_seed = [
            {
                "title": "Seja bem-vindo ao Raven!",
                "slug": "seja-bem-vindo",
                "category": created_cats["geral"],
                "content": "Este é o fórum oficial. Siga as regras e divirta-se!",
                "is_pinned": True,
                "replies": [
                    "Obrigado pela boas-vindas!",
                    "Contente em estar aqui.",
                ],
            },
            {
                "title": "Regras do Fórum",
                "slug": "regras-do-forum",
                "category": created_cats["geral"],
                "content": "1. Seja respeitoso.\n2. Não spam.\n3. Use as categorias corretas.",
                "is_pinned": True,
                "replies": [],
            },
            {
                "title": "Minha apresentação",
                "slug": "minha-apresentacao",
                "category": created_cats["apresentacoes"],
                "content": "Olá, sou novo por aqui! Animado para participar.",
                "replies": ["Bem-vindo!"],
            },
            {
                "title": "Sugestão: modo escuro no portal",
                "slug": "sugestao-modo-escuro",
                "category": created_cats["sugestoes"],
                "content": "Seria ótimo ter um tema escuro no painel.",
                "replies": [
                    "Concordo totalmente!",
                    "Já existe o toggle no canto superior.",
                ],
            },
        ]

        for t in topics_to_seed:
            topic, created = Topic.objects.get_or_create(
                slug=t["slug"],
                defaults={
                    "title": t["title"],
                    "category": t["category"],
                    "author": admin,
                    "content": t["content"],
                    "is_pinned": t.get("is_pinned", False),
                }
            )
            if created:
                for reply_content in t.get("replies", []):
                    ForumReply.objects.create(
                        topic=topic,
                        author=admin,
                        content=reply_content,
                    )

        self.stdout.write(f"Seeded {len(topics_to_seed)} forum topics.")
        self.stdout.write(self.style.SUCCESS("--- SEEDING COMPLETED SUCCESSFULLY ---"))
        self.stdout.write("\nCredentials: admin@raven.gg / changeme")
