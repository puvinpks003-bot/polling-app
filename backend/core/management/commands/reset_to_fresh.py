from django.core.management.base import BaseCommand
from core.models import (
    AdminUser, Department, Employee, PollCategory, Poll, PollOption,
    PollTarget, Vote, AnonymousParticipation, VoteSelection,
    OTPVerification, Notification, PollComment, AuditLog
)


class Command(BaseCommand):
    help = 'Erases all dummy employees, polls, votes, and test transactions while keeping admin login and base metadata'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting complete database reset to fresh state..."))

        # 1. Erase all transactions / employee / dummy poll data
        VoteSelection.objects.all().delete()
        AnonymousParticipation.objects.all().delete()
        Vote.objects.all().delete()
        PollComment.objects.all().delete()
        Notification.objects.all().delete()
        OTPVerification.objects.all().delete()
        PollTarget.objects.all().delete()
        PollOption.objects.all().delete()
        Poll.objects.all().delete()
        Employee.objects.all().delete()
        AuditLog.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("  ✓ Erased all votes, polls, comments, OTPs, audit logs, and dummy employees"))

        # 2. Configure Admin User
        AdminUser.objects.exclude(username='admin').delete()
        admin_user = AdminUser.objects.filter(username='admin').first()
        if not admin_user:
            admin_user = AdminUser.objects.create_superuser(
                username='admin',
                email='admin@companypulse.com',
                password='Admin@123456'
            )
            self.stdout.write(self.style.SUCCESS("  ✓ Created superuser: 'admin' (password: Admin@123456)"))
        else:
            admin_user.set_password('Admin@123456')
            admin_user.email = 'admin@companypulse.com'
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.is_active = True
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("  ✓ Verified superuser: 'admin' (password: Admin@123456)"))

        # 3. Base Standard Departments
        depts = [
            ('Engineering', 'ENG', 'Product Development & Engineering'),
            ('Human Resources', 'HR', 'People Operations & Culture'),
            ('Marketing', 'MKT', 'Brand Strategy & Growth Marketing'),
            ('Sales', 'SLS', 'Business Development & Enterprise Sales'),
            ('Operations', 'OPS', 'Facilities & Business Operations'),
        ]
        base_dept_names = [d[0] for d in depts]
        Department.objects.exclude(name__in=base_dept_names).delete()
        for name, code, desc in depts:
            Department.objects.get_or_create(
                name=name,
                defaults={'code': code, 'description': desc}
            )
        self.stdout.write(self.style.SUCCESS(f"  ✓ Preserved {len(depts)} standard base departments"))

        # 4. Base Standard Poll Categories
        categories = [
            ('Workplace & Facilities', 'Office amenities, desks, food, and remote work policies', '#3b82f6'),
            ('Benefits & Perks', 'Health insurance, stipends, and wellness allowances', '#10b981'),
            ('Company Culture', 'Team events, feedback, values, and celebrations', '#8b5cf6'),
            ('Product & Strategy', 'Internal toolings, roadmap priorities, and suggestions', '#f59e0b'),
        ]
        base_cat_names = [c[0] for c in categories]
        PollCategory.objects.exclude(name__in=base_cat_names).delete()
        for name, desc, color in categories:
            PollCategory.objects.get_or_create(
                name=name,
                defaults={'description': desc, 'color': color}
            )
        self.stdout.write(self.style.SUCCESS(f"  ✓ Preserved {len(categories)} standard base poll categories"))

        self.stdout.write(self.style.SUCCESS("\nDatabase is now completely clean, fresh, and ready for production!"))
