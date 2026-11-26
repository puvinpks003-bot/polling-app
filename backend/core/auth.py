import hashlib
import secrets
import logging
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AdminUser, Employee, OTPVerification

logger = logging.getLogger(__name__)


def normalize_mobile(mobile: str) -> str:
    """Normalize mobile number by removing whitespace, hyphens, and parenthesis."""
    if not mobile:
        return ''
    cleaned = ''.join(c for c in mobile.strip() if c.isdigit() or c == '+')
    if cleaned and not cleaned.startswith('+') and len(cleaned) == 10:
        cleaned = '+91' + cleaned  # default country prefix if 10-digit
    return cleaned


def normalize_name(name: str) -> str:
    """Normalize name for case-insensitive and spacing comparison."""
    if not name:
        return ''
    return ' '.join(name.strip().split()).lower()


def hash_otp(otp: str, mobile: str) -> str:
    """Hash OTP with secret key and mobile salt to prevent rainbow table attacks."""
    salt = f"{settings.SECRET_KEY}:{mobile}"
    return hashlib.sha256(f"{salt}:{otp}".encode('utf-8')).hexdigest()


def generate_secure_otp() -> str:
    """Generate cryptographically secure 6-digit OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(6))


def send_sms_gateway(mobile: str, otp: str):
    """
    Simulated or production SMS Gateway integration (e.g. Twilio, AWS SNS, MSG91).
    Logs OTP to console in development.
    """
    logger.info(f"[SMS Gateway] Sent OTP {otp} to {mobile}")
    print(f"\n==========================================")
    print(f" [SMS GATEWAY] OTP for {mobile}: {otp}")
    print(f"==========================================\n")


def create_jwt_for_admin(admin: AdminUser):
    refresh = RefreshToken.for_user(admin)
    refresh['role'] = 'admin'
    refresh['username'] = admin.username
    refresh['email'] = admin.email
    refresh['full_name'] = admin.get_full_name() or admin.username
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'role': 'admin',
        'user': {
            'id': admin.id,
            'username': admin.username,
            'email': admin.email,
            'role': 'admin',
            'full_name': admin.get_full_name() or admin.username,
        }
    }


def create_jwt_for_employee(employee: Employee):
    # Create token for employee
    refresh = RefreshToken()
    refresh['user_id'] = employee.id
    refresh['role'] = 'employee'
    refresh['employee_id'] = employee.employee_id
    refresh['full_name'] = employee.full_name
    refresh['mobile_number'] = employee.mobile_number
    refresh['department'] = employee.department.name if employee.department else None

    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'role': 'employee',
        'employee': {
            'id': employee.id,
            'employee_id': employee.employee_id,
            'full_name': employee.full_name,
            'mobile_number': employee.mobile_number,
            'email': employee.email,
            'department': employee.department.name if employee.department else None,
            'department_id': employee.department.id if employee.department else None,
            'designation': employee.designation,
            'role': 'employee',
        }
    }


class CompanyPulseJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that supports both AdminUser and Employee tokens.
    """
    def get_user(self, validated_token):
        role = validated_token.get('role')

        if role == 'admin':
            try:
                user_id = validated_token[settings.SIMPLE_JWT['USER_ID_CLAIM']]
                admin = AdminUser.objects.get(**{settings.SIMPLE_JWT['USER_ID_FIELD']: user_id})
                if not admin.is_active:
                    raise exceptions.AuthenticationFailed('Admin account is inactive')
                admin.role = 'admin'
                return admin
            except AdminUser.DoesNotExist:
                raise exceptions.AuthenticationFailed('Admin user not found')

        elif role == 'employee':
            try:
                user_id = validated_token.get('user_id')
                employee = Employee.objects.select_related('department').get(id=user_id)
                if not employee.is_active:
                    raise exceptions.AuthenticationFailed('Employee account is inactive')
                employee.role = 'employee'
                return employee
            except Employee.DoesNotExist:
                raise exceptions.AuthenticationFailed('Employee not found')

        # Fallback to default
        return super().get_user(validated_token)


class IsAdminRole(permissions.BasePermission):
    """Allows access only to authenticated Admin users."""
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and
            user.is_authenticated and
            (getattr(user, 'role', None) == 'admin' or isinstance(user, AdminUser) or getattr(user, 'is_staff', False))
        )


class IsEmployeeRole(permissions.BasePermission):
    """Allows access only to authenticated Employee users."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'employee'
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'admin'
        )
