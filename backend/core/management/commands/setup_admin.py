import os
from django.core.management.base import BaseCommand
from core.models import AdminUser


class Command(BaseCommand):
    help = 'Create initial administrator user if not exists'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default=os.getenv('ADMIN_USERNAME', 'admin'))
        parser.add_argument('--email', type=str, default=os.getenv('ADMIN_EMAIL', 'admin@sgone.com'))
        parser.add_argument('--password', type=str, default=os.getenv('ADMIN_PASSWORD', 'Admin@123456'))

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        password = options['password']

        admin, created = AdminUser.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'first_name': 'System',
                'last_name': 'Administrator',
                'is_staff': True,
                'is_superuser': True,
                'is_super_admin': True,
            }
        )

        if created:
            admin.set_password(password)
            admin.save()
            self.stdout.write(self.style.SUCCESS(f"Successfully created admin user: {username} ({email})"))
        else:
            admin.set_password(password)
            admin.email = email
            admin.save()
            self.stdout.write(self.style.WARNING(f"Admin user {username} already exists; updated password and email."))
