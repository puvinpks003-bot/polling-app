from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from core.models import AdminUser, Department, Employee, PollCategory, Poll, PollOption, AuditLog


class Command(BaseCommand):
    help = 'Seed initial departments, categories, employees, and sample polls'

    def handle(self, *args, **options):
        # 1. Departments
        depts_data = [
            ('Engineering', 'ENG', 'Product Development & Engineering'),
            ('Human Resources', 'HR', 'People Operations & Culture'),
            ('Marketing', 'MKT', 'Brand Strategy & Growth Marketing'),
            ('Sales', 'SLS', 'Business Development & Enterprise Sales'),
            ('Operations', 'OPS', 'Facilities & Business Operations'),
        ]
        dept_map = {}
        for name, code, desc in depts_data:
            dept, _ = Department.objects.get_or_create(name=name, defaults={'code': code, 'description': desc})
            dept_map[name] = dept
        self.stdout.write(self.style.SUCCESS(f"Created/verified {len(dept_map)} departments"))

        # 2. Categories
        cat_data = [
            ('Workplace & Facilities', 'Office amenities, desks, food, and remote work policies', '#3b82f6'),
            ('Benefits & Perks', 'Health insurance, stipends, and wellness allowances', '#10b981'),
            ('Company Culture', 'Team events, feedback, values, and celebrations', '#8b5cf6'),
            ('Product & Strategy', 'Internal toolings, roadmap priorities, and suggestions', '#f59e0b'),
        ]
        cat_map = {}
        for name, desc, color in cat_data:
            cat, _ = PollCategory.objects.get_or_create(name=name, defaults={'description': desc, 'color': color})
            cat_map[name] = cat
        self.stdout.write(self.style.SUCCESS(f"Created/verified {len(cat_map)} categories"))

        # 3. Initial Sample Employees
        employees_data = [
        ]
        emp_list = []
        for emp_id, name, mobile, email, dname, role in employees_data:
            emp, created = Employee.objects.get_or_create(
                employee_id=emp_id,
                defaults={
                    'full_name': name,
                    'mobile_number': mobile,
                    'email': email,
                    'department': dept_map.get(dname),
                    'designation': role,
                    'is_active': True,
                }
            )
            emp_list.append(emp)
        self.stdout.write(self.style.SUCCESS(f"Created/verified {len(emp_list)} sample employees"))

        # 4. Initial Sample Polls
        admin = AdminUser.objects.filter(is_staff=True).first()
        now = timezone.now()

        p1, created = Poll.objects.get_or_create(
            title="Preferred Hybrid Work Model for Q3/Q4",
            defaults={
                'description': "We value your input in shaping our upcoming hybrid and in-office work policies. Please choose your ideal schedule.",
                'category': cat_map.get('Workplace & Facilities'),
                'start_datetime': now - timedelta(days=2),
                'end_datetime': now + timedelta(days=14),
                'voting_type': 'single_choice',
                'target_audience': 'all',
                'anonymous_voting': True,
                'allow_comments': True,
                'results_visibility': 'after_voting',
                'status': 'active',
                'created_by': admin,
            }
        )
        if created:
            PollOption.objects.create(poll=p1, text="2 Days Office / 3 Days Remote", order=1)
            PollOption.objects.create(poll=p1, text="3 Days Office / 2 Days Remote", order=2)
            PollOption.objects.create(poll=p1, text="Full Flexibility (Choose as needed)", order=3)
            PollOption.objects.create(poll=p1, text="100% Remote-First", order=4)

        p2, created = Poll.objects.get_or_create(
            title="Annual Team Offsite Destination",
            defaults={
                'description': "Vote for your preferred destination for our upcoming company-wide annual offsite retreat!",
                'category': cat_map.get('Company Culture'),
                'start_datetime': now - timedelta(days=1),
                'end_datetime': now + timedelta(days=10),
                'voting_type': 'multiple_choice',
                'target_audience': 'all',
                'anonymous_voting': False,
                'allow_comments': True,
                'results_visibility': 'always',
                'status': 'active',
                'created_by': admin,
            }
        )
        if created:
            PollOption.objects.create(poll=p2, text="Goa Beach Resort", order=1)
            PollOption.objects.create(poll=p2, text="Himachal Mountain Retreat", order=2)
            PollOption.objects.create(poll=p2, text="Udaipur Heritage Palace", order=3)
            PollOption.objects.create(poll=p2, text="Kerala Backwaters Eco Lodge", order=4)

        p3, created = Poll.objects.get_or_create(
            title="Should we introduce Friday Focus Hours (No Internal Meetings)?",
            defaults={
                'description': "Proposal: Dedicate Fridays from 1:00 PM to 6:00 PM exclusively for deep focused work with zero scheduled internal meetings.",
                'category': cat_map.get('Workplace & Facilities'),
                'start_datetime': now - timedelta(days=3),
                'end_datetime': now + timedelta(days=7),
                'voting_type': 'yes_no',
                'target_audience': 'all',
                'anonymous_voting': True,
                'allow_comments': True,
                'results_visibility': 'after_voting',
                'status': 'active',
                'created_by': admin,
            }
        )
        if created:
            PollOption.objects.create(poll=p3, text="Yes, definitely adopt focus hours", order=1)
            PollOption.objects.create(poll=p3, text="No, keep current meeting guidelines", order=2)

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
