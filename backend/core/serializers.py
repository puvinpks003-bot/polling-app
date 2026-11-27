import re
from rest_framework import serializers
from django.utils import timezone
from .models import (
    AdminUser, Employee, Department, PollCategory, Poll,
    PollOption, PollTarget, Vote, VoteSelection,
    AnonymousParticipation, Notification, PollComment, AuditLog
)


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()
    code = serializers.CharField(required=False)

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description', 'employee_count', 'created_at']

    def get_employee_count(self, obj):
        if hasattr(obj, 'employee_count'):
            return obj.employee_count
        return obj.employees.filter(is_active=True).count()

    def create(self, validated_data):
        if not validated_data.get('code'):
            name = validated_data.get('name', '').strip()
            base_code = ''.join(c for c in name if c.isalnum()).upper()[:4] or 'DEPT'
            code = base_code
            counter = 1
            while Department.objects.filter(code=code).exists():
                code = f"{base_code[:3]}{counter}"
                counter += 1
            validated_data['code'] = code
        return super().create(validated_data)


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    employee_id = serializers.CharField(required=True, allow_blank=False, max_length=50)
    full_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    mobile_number = serializers.CharField(required=True, allow_blank=False, max_length=25)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=True, allow_null=False)
    designation = serializers.CharField(required=True, allow_blank=False, max_length=100)
    email = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    joining_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'full_name', 'mobile_number',
            'email', 'department', 'department_name', 'designation',
            'joining_date', 'is_active', 'created_at', 'updated_at'
        ]

    def validate_employee_id(self, value):
        val = value.strip().upper()
        if not val:
            raise serializers.ValidationError("Employee ID is required.")
        qs = Employee.objects.filter(employee_id__iexact=val)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("An employee with this Employee ID already exists.")
        return val

    def validate_full_name(self, value):
        val = ' '.join(value.strip().split())
        if not val:
            raise serializers.ValidationError("Full Name is required.")
        return val

    def validate_mobile_number(self, value):
        raw = str(value or '').strip()
        # Extract digits
        digits = re.sub(r'\D', '', raw)
        # If user entered 91xxxxxxxxxx (12 digits), strip country code 91
        if len(digits) == 12 and digits.startswith('91'):
            digits = digits[2:]

        # Validate Indian 10-digit mobile number starting with 6, 7, 8, or 9
        if not re.match(r'^[6-9]\d{9}$', digits):
            raise serializers.ValidationError("Please enter a valid 10-digit mobile number (starts with 6, 7, 8, or 9).")

        formatted = f"+91{digits}"
        qs = Employee.objects.filter(mobile_number=formatted)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("An employee with this mobile number already exists.")
        return formatted

    def validate_designation(self, value):
        val = ' '.join(value.strip().split())
        if not val:
            raise serializers.ValidationError("Designation is required.")
        return val

    def validate_email(self, value):
        if not value or not str(value).strip():
            return None
        val = str(value).strip().lower()

        # Email / Gmail format validation
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, val):
            raise serializers.ValidationError("Please enter a valid Gmail / Email address (e.g. name@gmail.com).")

        # Specific Gmail format check if domain is gmail.com
        if val.endswith('@gmail.com'):
            username = val[:-10]
            if not re.match(r'^[a-zA-Z0-9.]+$', username) or '..' in username or len(username) < 3:
                raise serializers.ValidationError("Please enter a valid Gmail address.")

        qs = Employee.objects.filter(email__iexact=val)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("An employee with this email address already exists.")
        return val


class PollCategorySerializer(serializers.ModelSerializer):
    poll_count = serializers.SerializerMethodField()

    class Meta:
        model = PollCategory
        fields = ['id', 'name', 'description', 'color', 'poll_count']

    def get_poll_count(self, obj):
        return obj.polls.count()


class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'poll', 'text', 'order', 'vote_count', 'percentage']
        read_only_fields = ['poll']

    def can_view(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) == 'admin':
            return True
        poll = getattr(obj, 'poll', None)
        if not poll:
            return False
        vis = poll.results_visibility
        if vis == 'admin_only':
            return False
        if vis == 'always':
            return True
        is_closed = (poll.status == 'closed') or (poll.end_datetime and timezone.now() >= poll.end_datetime)
        if vis == 'after_closing':
            return is_closed
        if vis == 'after_voting':
            if getattr(request.user, 'role', None) == 'employee':
                emp = request.user
                if poll.anonymous_voting:
                    voted = AnonymousParticipation.objects.filter(poll=poll, employee=emp).exists()
                else:
                    voted = Vote.objects.filter(poll=poll, employee=emp).exists()
                return voted or is_closed
        return False

    def get_vote_count(self, obj):
        if not self.can_view(obj):
            return 0
        return getattr(obj, 'calc_votes', obj.selections.count())

    def get_percentage(self, obj):
        if not self.can_view(obj):
            return 0.0
        total = getattr(obj, 'poll_total_votes', 0)
        if not total and hasattr(obj, 'poll') and obj.poll:
            total = VoteSelection.objects.filter(poll=obj.poll).count()
        count = self.get_vote_count(obj)
        if total and total > 0:
            return round((count / total) * 100, 1)
        return 0.0


class PollSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_color = serializers.CharField(source='category.color', read_only=True)
    options = PollOptionSerializer(many=True, required=False)
    targeted_departments = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    targeted_employees = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    target_department_names = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()
    my_selections = serializers.SerializerMethodField()
    total_votes = serializers.SerializerMethodField()
    participation_rate = serializers.SerializerMethodField()
    can_view_results = serializers.SerializerMethodField()
    rating_stats = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id', 'title', 'description', 'category', 'category_name', 'category_color',
            'cover_image', 'start_datetime', 'end_datetime', 'voting_type',
            'target_audience', 'anonymous_voting', 'allow_comments',
            'results_visibility', 'status', 'created_by', 'created_at',
            'updated_at', 'options', 'targeted_departments', 'targeted_employees',
            'target_department_names', 'has_voted', 'my_selections', 'total_votes',
            'participation_rate', 'can_view_results', 'rating_stats', 'comments_count'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_target_department_names(self, obj):
        return list(obj.targets.filter(department__isnull=False).values_list('department__name', flat=True))

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_has_voted(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) == 'employee':
            emp = request.user
            if obj.anonymous_voting:
                return AnonymousParticipation.objects.filter(poll=obj, employee=emp).exists()
            return Vote.objects.filter(poll=obj, employee=emp).exists()
        return False

    def get_my_selections(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return []
        if getattr(request.user, 'role', None) == 'employee' and not obj.anonymous_voting:
            vote = Vote.objects.filter(poll=obj, employee=request.user).first()
            if vote:
                return list(vote.selections.values_list('option_id', flat=True))
        return []

    def get_total_votes(self, obj):
        if not self.get_can_view_results(obj):
            return 0
        if obj.anonymous_voting:
            return AnonymousParticipation.objects.filter(poll=obj).count()
        return Vote.objects.filter(poll=obj).count()

    def get_participation_rate(self, obj):
        if not self.get_can_view_results(obj):
            return 0.0
        total_eligible = self.get_eligible_count(obj)
        total_votes = self.get_total_votes(obj)
        if total_eligible > 0:
            return round((total_votes / total_eligible) * 100, 1)
        return 0.0

    def get_eligible_count(self, obj):
        if obj.target_audience == 'all':
            return Employee.objects.filter(is_active=True).count()
        elif obj.target_audience == 'department':
            dept_ids = obj.targets.filter(department__isnull=False).values_list('department_id', flat=True)
            return Employee.objects.filter(department_id__in=dept_ids, is_active=True).count()
        elif obj.target_audience == 'selected_employees':
            return obj.targets.filter(employee__isnull=False, employee__is_active=True).count()
        return Employee.objects.filter(is_active=True).count()

    def get_can_view_results(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) == 'admin':
            return True
        if getattr(request.user, 'role', None) == 'employee':
            vis = obj.results_visibility
            if vis == 'admin_only':
                return False
            if vis == 'always':
                return True
            is_closed = (obj.status == 'closed') or (obj.end_datetime and timezone.now() >= obj.end_datetime)
            if vis == 'after_closing':
                return is_closed
            if vis == 'after_voting':
                has_voted = self.get_has_voted(obj)
                return has_voted or is_closed
        return False

    def get_rating_stats(self, obj):
        if obj.voting_type != 'rating' or not self.get_can_view_results(obj):
            return None
        ratings = list(VoteSelection.objects.filter(poll=obj, rating_value__isnull=False).values_list('rating_value', flat=True))
        if not ratings:
            return {'average': 0.0, 'total': 0}
        return {
            'average': round(sum(ratings) / len(ratings), 1),
            'total': len(ratings)
        }

    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        dept_ids = validated_data.pop('targeted_departments', [])
        emp_ids = validated_data.pop('targeted_employees', [])

        # Support on-the-fly dynamic category creation if new_category_name is supplied
        new_category_name = self.initial_data.get('new_category_name')
        if new_category_name and isinstance(new_category_name, str) and new_category_name.strip():
            cat_obj, _ = PollCategory.objects.get_or_create(
                name=new_category_name.strip(),
                defaults={'color': '#3b82f6'}
            )
            validated_data['category'] = cat_obj

        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == 'admin':
            validated_data['created_by'] = request.user

        poll = Poll.objects.create(**validated_data)

        # Create options
        for idx, opt in enumerate(options_data):
            text = opt.get('text', '').strip()
            if text:
                PollOption.objects.create(poll=poll, text=text, order=idx + 1)

        # Create targets
        if poll.target_audience == 'department':
            for did in dept_ids:
                PollTarget.objects.create(poll=poll, department_id=did)
        elif poll.target_audience == 'selected_employees':
            for eid in emp_ids:
                PollTarget.objects.create(poll=poll, employee_id=eid)

        return poll

    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', None)
        dept_ids = validated_data.pop('targeted_departments', None)
        emp_ids = validated_data.pop('targeted_employees', None)

        # If poll already has votes, block altering options
        has_votes = instance.votes.exists() or instance.anonymous_participations.exists()
        if options_data is not None and has_votes:
            # cannot edit options once voting has begun
            pass
        elif options_data is not None:
            instance.options.all().delete()
            for idx, opt in enumerate(options_data):
                text = opt.get('text', '').strip()
                if text:
                    PollOption.objects.create(poll=instance, text=text, order=idx + 1)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update targets if passed
        if dept_ids is not None and instance.target_audience == 'department':
            instance.targets.all().delete()
            for did in dept_ids:
                PollTarget.objects.create(poll=instance, department_id=did)
        elif emp_ids is not None and instance.target_audience == 'selected_employees':
            instance.targets.all().delete()
            for eid in emp_ids:
                PollTarget.objects.create(poll=instance, employee_id=eid)

        return instance


class PollCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollComment
        fields = ['id', 'poll', 'author_name', 'comment', 'is_anonymous', 'created_at']
        read_only_fields = ['author_name', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'link', 'is_read', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'action', 'user_type', 'actor_name', 'target_model', 'target_id', 'details', 'timestamp']
