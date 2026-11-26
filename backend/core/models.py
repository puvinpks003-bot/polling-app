import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class AdminUser(AbstractUser):
    """
    Administrator user model for system management.
    Employees do NOT use this model.
    """
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, default='Management')
    is_super_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.username} ({self.email})"


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def active_employee_count(self):
        return self.employees.filter(is_active=True).count()


class Employee(models.Model):
    employee_id = models.CharField(max_length=50, unique=True, db_index=True)
    full_name = models.CharField(max_length=150, db_index=True)
    mobile_number = models.CharField(max_length=25, unique=True, db_index=True)
    email = models.EmailField(blank=True, null=True, unique=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='employees',
        null=True,
        blank=True
    )
    designation = models.CharField(max_length=100, blank=True)
    joining_date = models.DateField(default=timezone.localdate)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['mobile_number', 'is_active']),
            models.Index(fields=['employee_id']),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.employee_id}) - {self.mobile_number}"

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class PollCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=20, default='#3b82f6')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Poll Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Poll(models.Model):
    VOTING_TYPES = [
        ('single_choice', 'Single Choice'),
        ('multiple_choice', 'Multiple Choice'),
        ('yes_no', 'Yes / No'),
        ('rating', 'Rating Poll'),
    ]

    TARGET_AUDIENCES = [
        ('all', 'All Employees'),
        ('department', 'Specific Departments'),
        ('selected_employees', 'Selected Employees'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('active', 'Active'),
        ('closed', 'Closed'),
        ('archived', 'Archived'),
    ]

    RESULTS_VISIBILITY = [
        ('always', 'Always Visible'),
        ('after_voting', 'Visible After Voting'),
        ('after_closing', 'Visible After Closing'),
        ('admin_only', 'Admin Only'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        PollCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='polls'
    )
    cover_image = models.ImageField(upload_to='poll_covers/', blank=True, null=True)
    start_datetime = models.DateTimeField(default=timezone.now)
    end_datetime = models.DateTimeField()
    voting_type = models.CharField(max_length=20, choices=VOTING_TYPES, default='single_choice')
    target_audience = models.CharField(max_length=25, choices=TARGET_AUDIENCES, default='all')
    anonymous_voting = models.BooleanField(default=False)
    allow_comments = models.BooleanField(default=True)
    results_visibility = models.CharField(max_length=20, choices=RESULTS_VISIBILITY, default='after_voting')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    created_by = models.ForeignKey(
        AdminUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_polls'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'end_datetime']),
        ]

    def __str__(self):
        return f"{self.title} [{self.get_status_display()}]"

    def update_dynamic_status(self):
        now = timezone.now()
        if self.status in ['active', 'scheduled']:
            if self.end_datetime <= now:
                self.status = 'closed'
                self.save(update_fields=['status', 'updated_at'])
            elif self.status == 'scheduled' and self.start_datetime <= now:
                self.status = 'active'
                self.save(update_fields=['status', 'updated_at'])
        return self.status


class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.poll.title} - Option: {self.text}"


class PollTarget(models.Model):
    """
    Specifies targeted departments or specific employees for restricted polls.
    """
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='targets')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['poll', 'department']),
            models.Index(fields=['poll', 'employee']),
        ]

    def __str__(self):
        if self.department:
            return f"Poll {self.poll_id} -> Dept: {self.department.name}"
        if self.employee:
            return f"Poll {self.poll_id} -> Employee: {self.employee.full_name}"
        return f"Poll {self.poll_id} -> Target"


class Vote(models.Model):
    """
    Recorded for non-anonymous polls.
    Links employee directly to the vote.
    """
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='votes')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['poll', 'employee'], name='unique_employee_poll_vote')
        ]
        indexes = [
            models.Index(fields=['poll', 'employee']),
        ]

    def __str__(self):
        return f"Vote: {self.employee.full_name} on {self.poll.title}"


class AnonymousParticipation(models.Model):
    """
    Recorded for anonymous polls.
    Ensures an employee can vote only once per poll WITHOUT linking identity to options chosen.
    """
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='anonymous_participations')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='anonymous_participations')
    voted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['poll', 'employee'], name='unique_anonymous_participation')
        ]
        indexes = [
            models.Index(fields=['poll', 'employee']),
        ]

    def __str__(self):
        return f"AnonParticipation: {self.employee.employee_id} in Poll {self.poll_id}"


class VoteSelection(models.Model):
    """
    Option selected.
    If poll is anonymous: vote is null, only poll and option are set.
    If poll is non-anonymous: vote is populated.
    """
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='selections')
    vote = models.ForeignKey(Vote, on_delete=models.CASCADE, null=True, blank=True, related_name='selections')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='selections')
    rating_value = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['poll', 'option']),
        ]

    def __str__(self):
        return f"Selection: Poll {self.poll_id} - Option {self.option.text}"


class OTPVerification(models.Model):
    """
    Secure OTP record. Stores hashed OTP, expiration, and attempt counts.
    """
    mobile_number = models.CharField(max_length=25, db_index=True)
    otp_hash = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['mobile_number', 'is_verified', 'expires_at']),
        ]

    def __str__(self):
        return f"OTP for {self.mobile_number} (verified={self.is_verified})"


class Notification(models.Model):
    TYPE_CHOICES = [
        ('poll_new', 'New Poll Available'),
        ('poll_deadline', 'Poll Deadline Reminder'),
        ('poll_closed', 'Poll Closed'),
        ('vote_confirmed', 'Vote Confirmation'),
        ('results_published', 'Results Published'),
        ('system', 'System Notification'),
    ]

    recipient_employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    recipient_admin = models.ForeignKey(
        AdminUser,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='system')
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient_employee', 'is_read']),
            models.Index(fields=['recipient_admin', 'is_read']),
        ]

    def __str__(self):
        return f"Notification: {self.title}"


class PollComment(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='comments')
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True)
    author_name = models.CharField(max_length=150, default='Anonymous')
    comment = models.TextField()
    is_anonymous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Comment by {self.author_name} on {self.poll.title}"


class AuditLog(models.Model):
    action = models.CharField(max_length=100)
    user_type = models.CharField(max_length=20, choices=[('admin', 'Admin'), ('employee', 'Employee'), ('system', 'System')])
    actor_id = models.CharField(max_length=50, blank=True)
    actor_name = models.CharField(max_length=150, blank=True)
    target_model = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=50, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp}] {self.user_type.upper()}:{self.actor_name} -> {self.action}"
