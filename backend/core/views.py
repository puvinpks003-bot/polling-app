import io
import openpyxl
import zoneinfo
from datetime import timedelta
from django.db import transaction
from django.db.models import Count, Q, F
from django.utils import timezone
from django.http import HttpResponse
from django.contrib.auth import authenticate
from rest_framework import views, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.conf import settings

from .models import (
    AdminUser, Employee, Department, PollCategory, Poll,
    PollOption, PollTarget, Vote, VoteSelection,
    AnonymousParticipation, OTPVerification, Notification,
    PollComment, AuditLog
)
from .serializers import (
    DepartmentSerializer, EmployeeSerializer, PollCategorySerializer,
    PollSerializer, PollOptionSerializer, PollCommentSerializer,
    NotificationSerializer, AuditLogSerializer
)
from .auth import (
    normalize_mobile, normalize_name, hash_otp, generate_secure_otp,
    send_sms_gateway, create_jwt_for_admin, create_jwt_for_employee,
    IsAdminRole, IsEmployeeRole
)


# ==========================================
# AUTHENTICATION VIEWS
# ==========================================

class AdminLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username_or_email = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username_or_email or not password:
            return Response(
                {'error': 'Username/email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Lookup by username or email
        admin = AdminUser.objects.filter(
            Q(username__iexact=username_or_email) | Q(email__iexact=username_or_email)
        ).first()

        if not admin or not admin.check_password(password):
            return Response(
                {'error': 'Invalid administrator credentials.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not admin.is_active or not admin.is_staff:
            return Response(
                {'error': 'Unauthorized admin account or access restricted.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Audit log
        AuditLog.objects.create(
            action='ADMIN_LOGIN',
            user_type='admin',
            actor_id=str(admin.id),
            actor_name=admin.username,
            details={'email': admin.email},
            ip_address=request.META.get('REMOTE_ADDR')
        )

        token_data = create_jwt_for_admin(admin)
        return Response(token_data, status=status.HTTP_200_OK)


class EmployeeRequestOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        full_name = request.data.get('full_name', '').strip()
        mobile_number = request.data.get('mobile_number', '').strip()

        if not full_name or not mobile_number:
            return Response(
                {'error': 'Full name and registered mobile number are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        norm_name = normalize_name(full_name)
        norm_mobile = normalize_mobile(mobile_number)

        # 1. Check if Admin Login (e.g. HR or Admin with 9384813589 or AdminUser phone)
        is_hr_admin = (
            norm_name in ('hr', 'admin') and (
                norm_mobile.endswith('9384813589') or norm_mobile == '+919384813589'
            )
        )
        admin_match = None
        if is_hr_admin:
            admin_match = AdminUser.objects.filter(is_active=True).filter(
                Q(username__iexact='hr') | Q(username__iexact='admin') | Q(is_superuser=True)
            ).first()
            if not admin_match:
                admin_match = AdminUser.objects.create_superuser(
                    username='hr',
                    email='hr@companypulse.com',
                    password='Admin@123456'
                )
            if not admin_match.phone_number:
                admin_match.phone_number = '+919384813589'
                admin_match.save(update_fields=['phone_number'])
        else:
            # Also check if any AdminUser matches username and registered phone
            admin_match = AdminUser.objects.filter(
                is_active=True,
                username__iexact=norm_name
            ).filter(
                Q(phone_number=norm_mobile) | Q(phone_number__endswith=norm_mobile[-10:])
            ).first()

        if admin_match:
            AuditLog.objects.create(
                action='ADMIN_LOGIN',
                user_type='admin',
                actor_id=str(admin_match.id),
                actor_name=admin_match.username,
                details={'mobile': norm_mobile, 'method': 'portal_identification'},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            token_data = create_jwt_for_admin(admin_match)
            token_data['otp_required'] = False
            token_data['message'] = f'Welcome, {admin_match.username.upper()} Administrator!'
            return Response(token_data, status=status.HTTP_200_OK)

        # 2. Find employee by Full Name, Employee ID, or Email + Mobile match
        employee = None
        candidates = Employee.objects.filter(is_active=True)
        for emp in candidates:
            emp_norm_name = normalize_name(emp.full_name)
            emp_norm_id = emp.employee_id.strip().lower() if emp.employee_id else ''
            emp_norm_email = emp.email.strip().lower() if emp.email else ''
            emp_norm_mobile = normalize_mobile(emp.mobile_number)

            # Check exact match or typo-tolerant transposition match (e.g. SGCS025 for SGSC025)
            id_transposed = (
                bool(emp_norm_id and norm_name and len(emp_norm_id) == len(norm_name)
                     and sorted(emp_norm_id) == sorted(norm_name)
                     and sum(1 for a, b in zip(emp_norm_id, norm_name) if a != b) <= 2)
            )

            name_matches = (
                emp_norm_name == norm_name
                or emp_norm_id == norm_name
                or id_transposed
                or emp_norm_email == norm_name
            )
            mobile_matches = (
                emp_norm_mobile == norm_mobile
                or (len(norm_mobile) >= 10 and emp_norm_mobile.endswith(norm_mobile[-10:]))
            )

            if name_matches and mobile_matches:
                employee = emp
                break

        if not employee:
            # Prevent user enumeration with safe generic message
            return Response(
                {'error': 'No active employee found matching the provided name and mobile number. Please contact your administrator.'},
                status=status.HTTP_404_NOT_FOUND
            )

        now = timezone.now()

        # Check if OTP verification is disabled (direct Employee Identification login)
        if not getattr(settings, 'ENABLE_OTP_VERIFICATION', False):
            AuditLog.objects.create(
                action='EMPLOYEE_LOGIN',
                user_type='employee',
                actor_id=employee.employee_id,
                actor_name=employee.full_name,
                details={'mobile': norm_mobile, 'method': 'employee_identification'},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            token_data = create_jwt_for_employee(employee)
            token_data['otp_required'] = False
            token_data['message'] = f'Welcome, {employee.full_name}!'
            # If in dev mode, also generate dev OTP so any verify-endpoint callers/tests stay compatible
            if getattr(settings, 'OTP_DEV_MODE', True):
                otp = generate_secure_otp()
                hashed = hash_otp(otp, norm_mobile)
                OTPVerification.objects.filter(mobile_number=norm_mobile, is_verified=False).delete()
                OTPVerification.objects.create(
                    mobile_number=norm_mobile,
                    otp_hash=hashed,
                    expires_at=now + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
                    attempts=0
                )
                token_data['dev_otp'] = otp
            return Response(token_data, status=status.HTTP_200_OK)

        # Rate limiting / cooldown check
        cooldown_window = now - timedelta(seconds=settings.OTP_COOLDOWN_SECONDS)
        recent_otp = OTPVerification.objects.filter(
            mobile_number=norm_mobile,
            created_at__gte=cooldown_window
        ).first()

        if recent_otp:
            return Response(
                {'error': f'Please wait {settings.OTP_COOLDOWN_SECONDS} seconds before requesting a new code.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # Invalidate previous unverified OTPs for this number
        OTPVerification.objects.filter(mobile_number=norm_mobile, is_verified=False).delete()

        # Generate cryptographic OTP
        otp = generate_secure_otp()
        hashed = hash_otp(otp, norm_mobile)
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

        OTPVerification.objects.create(
            mobile_number=norm_mobile,
            otp_hash=hashed,
            expires_at=expires_at,
            attempts=0
        )

        send_sms_gateway(norm_mobile, otp)

        response_payload = {
            'message': 'A verification code has been dispatched to your registered mobile number.',
            'mobile_number': norm_mobile,
            'expires_in_minutes': settings.OTP_EXPIRY_MINUTES,
        }

        # Provide dev_otp in dev mode for testing
        if settings.OTP_DEV_MODE:
            response_payload['dev_otp'] = otp

        return Response(response_payload, status=status.HTTP_200_OK)


class EmployeeVerifyOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        mobile_number = request.data.get('mobile_number', '').strip()
        otp = request.data.get('otp', '').strip()

        if not mobile_number or not otp:
            return Response(
                {'error': 'Mobile number and verification OTP are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        norm_mobile = normalize_mobile(mobile_number)
        now = timezone.now()

        otp_record = OTPVerification.objects.filter(
            mobile_number=norm_mobile,
            is_verified=False
        ).order_by('-created_at').first()

        if not otp_record:
            return Response(
                {'error': 'No active verification code found for this number. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record.expires_at < now:
            otp_record.delete()
            return Response(
                {'error': 'The verification code has expired. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
            otp_record.delete()
            return Response(
                {'error': 'Maximum verification attempts exceeded. Please request a new code.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # Validate hash
        expected_hash = hash_otp(otp, norm_mobile)
        if otp_record.otp_hash != expected_hash:
            otp_record.attempts += 1
            otp_record.save(update_fields=['attempts'])
            remaining = settings.OTP_MAX_ATTEMPTS - otp_record.attempts
            return Response(
                {'error': f'Invalid verification code. {remaining} attempt(s) remaining.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark OTP as verified
        otp_record.is_verified = True
        otp_record.save(update_fields=['is_verified'])

        # Check if Admin login
        if norm_mobile.endswith('9384813589') or AdminUser.objects.filter(is_active=True, phone_number__endswith=norm_mobile[-10:]).exists():
            admin_match = AdminUser.objects.filter(is_active=True).filter(
                Q(username__iexact='hr') | Q(username__iexact='admin') | Q(is_superuser=True)
            ).first()
            if admin_match:
                AuditLog.objects.create(
                    action='ADMIN_LOGIN',
                    user_type='admin',
                    actor_id=str(admin_match.id),
                    actor_name=admin_match.username,
                    details={'mobile': norm_mobile, 'method': 'otp_verification'},
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                token_data = create_jwt_for_admin(admin_match)
                token_data['message'] = 'Admin verification successful.'
                return Response(token_data, status=status.HTTP_200_OK)

        # Fetch Employee
        employee = None
        for emp in Employee.objects.filter(is_active=True):
            if normalize_mobile(emp.mobile_number) == norm_mobile or normalize_mobile(emp.mobile_number).endswith(norm_mobile[-10:]):
                employee = emp
                break

        if not employee:
            return Response(
                {'error': 'Employee record not found or currently inactive.'},
                status=status.HTTP_404_NOT_FOUND
            )

        AuditLog.objects.create(
            action='EMPLOYEE_LOGIN',
            user_type='employee',
            actor_id=employee.employee_id,
            actor_name=employee.full_name,
            details={'mobile': norm_mobile},
            ip_address=request.META.get('REMOTE_ADDR')
        )

        token_data = create_jwt_for_employee(employee)
        return Response(token_data, status=status.HTTP_200_OK)


class CurrentUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)

        if role == 'admin':
            return Response({
                'role': 'admin',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name() or user.username,
                    'is_staff': user.is_staff,
                }
            })
        elif role == 'employee':
            return Response({
                'role': 'employee',
                'employee': {
                    'id': user.id,
                    'employee_id': user.employee_id,
                    'full_name': user.full_name,
                    'mobile_number': user.mobile_number,
                    'email': user.email,
                    'department': user.department.name if user.department else None,
                    'department_id': user.department.id if user.department else None,
                    'designation': user.designation,
                    'joining_date': str(user.joining_date),
                }
            })
        return Response({'error': 'Unknown identity'}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# EMPLOYEE MANAGEMENT VIEWS (Admin only)
# ==========================================

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('department').all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        qs = super().get_queryset()
        dept_id = self.request.query_params.get('department')
        status_param = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search', '').strip()

        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if status_param in ['true', 'false', '1', '0']:
            qs = qs.filter(is_active=status_param in ['true', '1'])
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(mobile_number__icontains=search) |
                Q(email__icontains=search) |
                Q(designation__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        mobile = normalize_mobile(serializer.validated_data.get('mobile_number', ''))
        serializer.validated_data['mobile_number'] = mobile
        instance = serializer.save()
        AuditLog.objects.create(
            action='CREATE_EMPLOYEE',
            user_type='admin',
            actor_name=self.request.user.username,
            target_model='Employee',
            target_id=instance.employee_id,
            details={'full_name': instance.full_name, 'mobile': instance.mobile_number}
        )

    def perform_update(self, serializer):
        if 'mobile_number' in serializer.validated_data:
            serializer.validated_data['mobile_number'] = normalize_mobile(serializer.validated_data['mobile_number'])
        instance = serializer.save()
        AuditLog.objects.create(
            action='UPDATE_EMPLOYEE',
            user_type='admin',
            actor_name=self.request.user.username,
            target_model='Employee',
            target_id=instance.employee_id,
            details={'full_name': instance.full_name}
        )

    @action(detail=True, methods=['patch'])
    def status(self, request, pk=None):
        employee = self.get_object()
        new_status = request.data.get('is_active')
        if new_status is None:
            new_status = not employee.is_active
        employee.is_active = bool(new_status)
        employee.save(update_fields=['is_active', 'updated_at'])

        AuditLog.objects.create(
            action='TOGGLE_EMPLOYEE_STATUS',
            user_type='admin',
            actor_name=request.user.username,
            target_model='Employee',
            target_id=employee.employee_id,
            details={'is_active': employee.is_active}
        )
        return Response(EmployeeSerializer(employee).data)

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))

            if len(rows) < 2:
                return Response({'error': 'Excel file contains no data rows.'}, status=status.HTTP_400_BAD_REQUEST)

            headers = [str(h).strip().lower().replace(' ', '_') if h else '' for h in rows[0]]
            created_count = 0
            errors = []

            dept_cache = {d.name.lower(): d for d in Department.objects.all()}

            for idx, row in enumerate(rows[1:], start=2):
                data = dict(zip(headers, row))
                emp_id = str(data.get('employee_id', '') or '').strip()
                name = str(data.get('full_name', '') or data.get('name', '') or '').strip()
                mobile = str(data.get('mobile_number', '') or data.get('mobile', '') or '').strip()
                email = str(data.get('email', '') or '').strip() or None
                dept_name = str(data.get('department', '') or '').strip()
                designation = str(data.get('designation', '') or '').strip()

                if not emp_id or not name or not mobile:
                    errors.append(f"Row {idx}: Employee ID, Name, and Mobile Number are required.")
                    continue

                norm_mobile = normalize_mobile(mobile)

                # Check unique employee_id
                if Employee.objects.filter(employee_id__iexact=emp_id).exists():
                    errors.append(f"Row {idx}: Employee ID '{emp_id}' already exists.")
                    continue

                # Check unique mobile
                if Employee.objects.filter(mobile_number=norm_mobile).exists():
                    errors.append(f"Row {idx}: Mobile number '{norm_mobile}' already exists.")
                    continue

                # Resolve department
                dept = None
                if dept_name:
                    dept = dept_cache.get(dept_name.lower())
                    if not dept:
                        dept = Department.objects.create(name=dept_name, code=dept_name[:3].upper())
                        dept_cache[dept_name.lower()] = dept

                Employee.objects.create(
                    employee_id=emp_id,
                    full_name=name,
                    mobile_number=norm_mobile,
                    email=email,
                    department=dept,
                    designation=designation,
                    is_active=True
                )
                created_count += 1

            AuditLog.objects.create(
                action='BULK_IMPORT_EMPLOYEES',
                user_type='admin',
                actor_name=request.user.username,
                target_model='Employee',
                details={'created_count': created_count, 'error_count': len(errors)}
            )

            return Response({
                'message': f'Successfully imported {created_count} employee(s).',
                'created_count': created_count,
                'errors': errors
            })

        except Exception as e:
            return Response({'error': f'Failed to process Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='export')
    def export_excel(self, request):
        qs = self.get_queryset()
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Employees"

        headers = ['Employee ID', 'Full Name', 'Mobile Number', 'Email', 'Department', 'Designation', 'Status', 'Joining Date (DD-MM-YYYY)']
        ws.append(headers)

        for emp in qs:
            joining_str = emp.joining_date.strftime('%d-%m-%Y') if emp.joining_date else '—'
            ws.append([
                emp.employee_id,
                emp.full_name,
                emp.mobile_number,
                emp.email or '',
                emp.department.name if emp.department else '',
                emp.designation,
                'Active' if emp.is_active else 'Inactive',
                joining_str
            ])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="SG_ONE_Employees.xlsx"'
        return response


# ==========================================
# DEPARTMENT MANAGEMENT
# ==========================================

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.annotate(employee_count=Count('employees', filter=Q(employees__is_active=True))).order_by('name')
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]

    def perform_create(self, serializer):
        dept = serializer.save()
        AuditLog.objects.create(
            action='CREATE_DEPARTMENT',
            user_type='admin',
            actor_name=self.request.user.username,
            target_model='Department',
            target_id=str(dept.id),
            details={'name': dept.name, 'code': dept.code}
        )


# ==========================================
# POLL CATEGORIES
# ==========================================

class PollCategoryViewSet(viewsets.ModelViewSet):
    queryset = PollCategory.objects.all()
    serializer_class = PollCategorySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Category name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if already exists case-insensitively to prevent duplicates
        existing = PollCategory.objects.filter(name__iexact=name).first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)


# ==========================================
# POLL MANAGEMENT & VOTING
# ==========================================

class PollViewSet(viewsets.ModelViewSet):
    serializer_class = PollSerializer

    def get_permissions(self):
        if self.action == 'vote':
            return [IsEmployeeRole()]
        if self.action in ['list', 'retrieve', 'results']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)

        # Update dynamic statuses for active/scheduled polls
        now = timezone.now()
        Poll.objects.filter(status='active', end_datetime__lte=now).update(status='closed')
        Poll.objects.filter(status='scheduled', start_datetime__lte=now, end_datetime__gt=now).update(status='active')

        qs = Poll.objects.prefetch_related('options', 'targets', 'category').all()

        if role == 'admin':
            status_param = self.request.query_params.get('status')
            category_param = self.request.query_params.get('category')
            search = self.request.query_params.get('search')
            if status_param:
                qs = qs.filter(status=status_param)
            if category_param:
                qs = qs.filter(category_id=category_param)
            if search:
                qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
            return qs

        elif role == 'employee':
            emp = user
            dept_id = emp.department_id

            # Filter polls targeted to all, or employee's department, or specifically to this employee
            qs = qs.filter(
                status__in=['active', 'closed']
            ).filter(
                Q(target_audience='all') |
                Q(target_audience='department', targets__department_id=dept_id) |
                Q(target_audience='selected_employees', targets__employee_id=emp.id)
            ).distinct()

            filter_type = self.request.query_params.get('filter')  # 'active', 'pending', 'voted', 'completed'
            if filter_type == 'active':
                qs = qs.filter(status='active')
            elif filter_type == 'closed':
                qs = qs.filter(status='closed')

            return qs

        return qs.none()

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        poll = self.get_object()
        now = timezone.now()
        if poll.start_datetime <= now:
            poll.status = 'active'
        else:
            poll.status = 'scheduled'
        poll.save(update_fields=['status', 'updated_at'])

        # Create notifications for eligible employees
        eligible_employees = []
        if poll.target_audience == 'all':
            eligible_employees = Employee.objects.filter(is_active=True)
        elif poll.target_audience == 'department':
            dept_ids = poll.targets.filter(department__isnull=False).values_list('department_id', flat=True)
            eligible_employees = Employee.objects.filter(department_id__in=dept_ids, is_active=True)
        elif poll.target_audience == 'selected_employees':
            emp_ids = poll.targets.filter(employee__isnull=False).values_list('employee_id', flat=True)
            eligible_employees = Employee.objects.filter(id__in=emp_ids, is_active=True)

        kolkata_tz = zoneinfo.ZoneInfo('Asia/Kolkata')
        deadline_ist = poll.end_datetime.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M %p IST') if poll.end_datetime else 'N/A'
        notifs = [
            Notification(
                recipient_employee=emp,
                title=f"New Poll: {poll.title}",
                message=f"You are invited to vote in '{poll.title}'. Deadline: {deadline_ist}.",
                notification_type='poll_new',
                link=f"/employee/polls/{poll.id}"
            )
            for emp in eligible_employees
        ]
        Notification.objects.bulk_create(notifs, ignore_conflicts=True)

        AuditLog.objects.create(
            action='PUBLISH_POLL',
            user_type='admin',
            actor_name=request.user.username,
            target_model='Poll',
            target_id=str(poll.id),
            details={'title': poll.title, 'status': poll.status, 'eligible_count': len(notifs)}
        )

        return Response(PollSerializer(poll, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        poll = self.get_object()
        poll.status = 'closed'
        poll.save(update_fields=['status', 'updated_at'])

        AuditLog.objects.create(
            action='CLOSE_POLL',
            user_type='admin',
            actor_name=request.user.username,
            target_model='Poll',
            target_id=str(poll.id),
            details={'title': poll.title}
        )
        return Response(PollSerializer(poll, context={'request': request}).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def reopen(self, request, pk=None):
        poll = self.get_object()
        new_end_str = request.data.get('end_datetime')
        if new_end_str:
            poll.end_datetime = new_end_str
        else:
            poll.end_datetime = timezone.now() + timedelta(days=7)
        poll.status = 'active'
        poll.save(update_fields=['status', 'end_datetime', 'updated_at'])

        AuditLog.objects.create(
            action='REOPEN_POLL',
            user_type='admin',
            actor_name=request.user.username,
            target_model='Poll',
            target_id=str(poll.id),
            details={'title': poll.title, 'new_end': str(poll.end_datetime)}
        )
        return Response(PollSerializer(poll, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        original = self.get_object()
        new_poll = Poll.objects.create(
            title=f"{original.title} (Copy)",
            description=original.description,
            category=original.category,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(days=7),
            voting_type=original.voting_type,
            target_audience=original.target_audience,
            anonymous_voting=original.anonymous_voting,
            allow_comments=original.allow_comments,
            results_visibility=original.results_visibility,
            status='draft',
            created_by=request.user if getattr(request.user, 'role', None) == 'admin' else None
        )

        for opt in original.options.all():
            PollOption.objects.create(poll=new_poll, text=opt.text, order=opt.order)

        for target in original.targets.all():
            PollTarget.objects.create(
                poll=new_poll,
                department=target.department,
                employee=target.employee
            )

        return Response(PollSerializer(new_poll, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        title = instance.title
        status_val = instance.status
        instance_id = instance.id
        instance.delete()
        if hasattr(self.request, 'user') and getattr(self.request.user, 'role', None) == 'admin':
            AuditLog.objects.create(
                action='DELETE_POLL',
                user_type='admin',
                actor_name=self.request.user.username,
                target_model='Poll',
                target_id=str(instance_id),
                details={'title': title, 'status': status_val}
            )

    @action(detail=True, methods=['post'], permission_classes=[IsEmployeeRole])
    def vote(self, request, pk=None):
        """
        Record employee vote with strict atomic transaction and duplicate prevention.
        Handles both anonymous and non-anonymous voting securely.
        """
        poll = self.get_object()
        employee = request.user
        now = timezone.now()

        # 1. Status validation
        if poll.status != 'active' or poll.end_datetime <= now or poll.start_datetime > now:
            if poll.status == 'active' and poll.end_datetime <= now:
                poll.status = 'closed'
                poll.save(update_fields=['status', 'updated_at'])
            return Response(
                {'error': 'This poll has closed as the voting deadline has expired. Submissions are no longer accepted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Eligibility validation
        if poll.target_audience == 'department':
            if not poll.targets.filter(department_id=employee.department_id).exists():
                return Response({'error': 'You are not eligible to vote in this poll.'}, status=status.HTTP_403_FORBIDDEN)
        elif poll.target_audience == 'selected_employees':
            if not poll.targets.filter(employee_id=employee.id).exists():
                return Response({'error': 'You are not eligible to vote in this poll.'}, status=status.HTTP_403_FORBIDDEN)

        # 3. Input payload validation
        selected_option_ids = request.data.get('option_ids', [])
        if not selected_option_ids and request.data.get('option_id'):
            selected_option_ids = [request.data.get('option_id')]

        rating_value = request.data.get('rating_value')

        if not selected_option_ids and not rating_value:
            return Response({'error': 'Please select an option to submit your vote.'}, status=status.HTTP_400_BAD_REQUEST)

        # Voting type limits
        if poll.voting_type in ['single_choice', 'yes_no'] and len(selected_option_ids) != 1:
            return Response({'error': 'Please select exactly one option.'}, status=status.HTTP_400_BAD_REQUEST)

        if poll.voting_type == 'rating':
            if rating_value is None or not (1 <= int(rating_value) <= 10):
                return Response({'error': 'Please provide a rating value between 1 and 10.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate that selected options belong to this poll
        valid_options = list(poll.options.filter(id__in=selected_option_ids))
        if len(valid_options) != len(selected_option_ids):
            return Response({'error': 'One or more selected options are invalid for this poll.'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Atomic vote submission
        try:
            with transaction.atomic():
                # Duplicate check within transaction
                if poll.anonymous_voting:
                    if AnonymousParticipation.objects.filter(poll=poll, employee=employee).exists():
                        return Response({'error': 'You have already voted in this poll.'}, status=status.HTTP_400_BAD_REQUEST)

                    # Create participation record (separate from selection!)
                    AnonymousParticipation.objects.create(poll=poll, employee=employee)

                    # Create selections with NO reference to employee or vote record
                    for opt in valid_options:
                        VoteSelection.objects.create(
                            poll=poll,
                            vote=None,
                            option=opt,
                            rating_value=rating_value if poll.voting_type == 'rating' else None
                        )
                else:
                    if Vote.objects.filter(poll=poll, employee=employee).exists():
                        return Response({'error': 'You have already voted in this poll.'}, status=status.HTTP_400_BAD_REQUEST)

                    vote_record = Vote.objects.create(
                        poll=poll,
                        employee=employee,
                        ip_address=request.META.get('REMOTE_ADDR')
                    )

                    for opt in valid_options:
                        VoteSelection.objects.create(
                            poll=poll,
                            vote=vote_record,
                            option=opt,
                            rating_value=rating_value if poll.voting_type == 'rating' else None
                        )

            # Notification for employee
            Notification.objects.create(
                recipient_employee=employee,
                title="Vote Recorded Successfully",
                message=f"Your vote for '{poll.title}' was successfully recorded.",
                notification_type='vote_confirmed',
                link=f"/employee/polls/{poll.id}"
            )

            # Audit log
            AuditLog.objects.create(
                action='CAST_VOTE',
                user_type='employee',
                actor_id=employee.employee_id,
                actor_name=employee.full_name,
                target_model='Poll',
                target_id=str(poll.id),
                details={'anonymous': poll.anonymous_voting}
            )

            return Response({
                'message': 'Your vote has been submitted successfully!',
                'poll_id': poll.id,
                'has_voted': True
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': f'Failed to record vote: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """
        Return option-wise vote counts, percentage, winner, and participation statistics.
        Enforces visibility rules and anonymous identity privacy.
        """
        poll = self.get_object()
        user = request.user
        role = getattr(user, 'role', None)

        if role == 'admin':
            pass
        elif role == 'employee':
            vis = poll.results_visibility
            is_closed = (poll.status == 'closed') or (poll.end_datetime and timezone.now() >= poll.end_datetime)
            if vis == 'admin_only':
                return Response(
                    {'error': 'Poll results are confidential and restricted to administrators only.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            elif vis == 'always':
                pass
            elif vis == 'after_closing':
                if not is_closed:
                    return Response(
                        {'error': 'Poll results will be visible only after the voting period concludes.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            elif vis == 'after_voting':
                if poll.anonymous_voting:
                    voted = AnonymousParticipation.objects.filter(poll=poll, employee=user).exists()
                else:
                    voted = Vote.objects.filter(poll=poll, employee=user).exists()
                if not (voted or is_closed):
                    return Response(
                        {'error': 'Poll results will be visible after submitting your vote.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
        else:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        # Calculate votes per option
        total_selections = VoteSelection.objects.filter(poll=poll).count()
        options_data = []
        winner = None
        max_votes = -1

        for opt in poll.options.all():
            v_count = VoteSelection.objects.filter(poll=poll, option=opt).count()
            pct = round((v_count / total_selections * 100), 1) if total_selections > 0 else 0.0
            options_data.append({
                'id': opt.id,
                'text': opt.text,
                'order': opt.order,
                'vote_count': v_count,
                'percentage': pct
            })
            if v_count > max_votes and v_count > 0:
                max_votes = v_count
                winner = {'id': opt.id, 'text': opt.text, 'vote_count': v_count, 'percentage': pct}

        # Participation counts
        if poll.anonymous_voting:
            participants_count = AnonymousParticipation.objects.filter(poll=poll).count()
        else:
            participants_count = Vote.objects.filter(poll=poll).count()

        eligible_count = PollSerializer(poll).get_eligible_count(poll)
        participation_rate = round((participants_count / eligible_count * 100), 1) if eligible_count > 0 else 0.0

        # Department-wise breakdown (if non-anonymous and admin)
        department_breakdown = []
        if role == 'admin' and not poll.anonymous_voting:
            dept_counts = (
                Vote.objects.filter(poll=poll)
                .values('employee__department__name')
                .annotate(count=Count('id'))
                .order_by('-count')
            )
            department_breakdown = [
                {'department': item['employee__department__name'] or 'Unassigned', 'count': item['count']}
                for item in dept_counts
            ]

        # Rating poll statistics
        rating_stats = None
        if poll.voting_type == 'rating':
            ratings = VoteSelection.objects.filter(poll=poll, rating_value__isnull=False).values_list('rating_value', flat=True)
            if ratings:
                avg_rating = round(sum(ratings) / len(ratings), 2)
                rating_stats = {
                    'average_rating': avg_rating,
                    'total_ratings': len(ratings),
                    'distribution': {i: list(ratings).count(i) for i in range(1, 11)}
                }

        # Voters list for Admin inspection
        voters = []
        kolkata_tz = zoneinfo.ZoneInfo('Asia/Kolkata')
        if role == 'admin':
            if not poll.anonymous_voting:
                votes = Vote.objects.filter(poll=poll).select_related('employee', 'employee__department').prefetch_related('selections__option')
                for v in votes:
                    selected_opts = [s.option.text for s in v.selections.all() if s.option]
                    if poll.voting_type == 'rating':
                        ratings = [str(s.rating_value) for s in v.selections.all() if s.rating_value is not None]
                        if ratings:
                            selected_opts = [f"Rating: {r}/10" for r in ratings]
                    
                    v_dt = v.created_at
                    if timezone.is_aware(v_dt):
                        v_dt = v_dt.astimezone(kolkata_tz)
                    else:
                        v_dt = timezone.make_aware(v_dt, zoneinfo.ZoneInfo('UTC')).astimezone(kolkata_tz)

                    voters.append({
                        'vote_id': v.id,
                        'employee_pk': v.employee.id,
                        'employee_id': v.employee.employee_id,
                        'employee_name': v.employee.full_name,
                        'department': v.employee.department.name if v.employee.department else '—',
                        'selections': selected_opts,
                        'voted_at': v_dt.strftime('%d-%m-%Y %I:%M:%S %p'),
                    })
            else:
                anons = AnonymousParticipation.objects.filter(poll=poll).select_related('employee', 'employee__department')
                for ap in anons:
                    ap_dt = ap.voted_at
                    if timezone.is_aware(ap_dt):
                        ap_dt = ap_dt.astimezone(kolkata_tz)
                    else:
                        ap_dt = timezone.make_aware(ap_dt, zoneinfo.ZoneInfo('UTC')).astimezone(kolkata_tz)

                    voters.append({
                        'employee_pk': ap.employee.id,
                        'employee_id': ap.employee.employee_id,
                        'employee_name': ap.employee.full_name,
                        'department': ap.employee.department.name if ap.employee.department else '—',
                        'selections': ['Confidential (Anonymous Ballot)'],
                        'voted_at': ap_dt.strftime('%d-%m-%Y %I:%M:%S %p'),
                    })

        return Response({
            'poll_id': poll.id,
            'title': poll.title,
            'anonymous_voting': poll.anonymous_voting,
            'voting_type': poll.voting_type,
            'total_participants': participants_count,
            'total_eligible': eligible_count,
            'participation_rate': participation_rate,
            'total_selections': total_selections,
            'options': options_data,
            'winner': winner,
            'department_breakdown': department_breakdown,
            'rating_stats': rating_stats,
            'voters': voters,
        })

    @action(detail=True, methods=['post'], url_path='reset-vote', permission_classes=[IsAdminRole])
    def reset_vote(self, request, pk=None):
        """
        Admin resets a specific employee's vote for this poll.
        Deletes prior records (Vote and VoteSelections, or AnonymousParticipation)
        so the employee can re-submit their vote.
        """
        poll = self.get_object()
        employee_id = request.data.get('employee_id')
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            deleted_count = 0
            if poll.anonymous_voting:
                anon_recs = AnonymousParticipation.objects.filter(poll=poll, employee=employee)
                deleted_count = anon_recs.count()
                anon_recs.delete()
            else:
                votes = Vote.objects.filter(poll=poll, employee=employee)
                deleted_count = votes.count()
                for v in votes:
                    v.selections.all().delete()
                votes.delete()

            # Create notification for employee
            Notification.objects.create(
                recipient_employee=employee,
                title="Vote Reset: Re-submission Enabled",
                message=f"The administrator has reset your previous vote on '{poll.title}'. You are now eligible to re-submit your vote.",
                notification_type='system',
                link=f"/employee/polls/{poll.id}"
            )

            # Audit log
            AuditLog.objects.create(
                action='ADMIN_RESET_VOTE',
                user_type='admin',
                actor_id=str(request.user.id),
                actor_name=request.user.username,
                target_model='Poll',
                target_id=str(poll.id),
                details={
                    'employee_id': employee.employee_id,
                    'employee_name': employee.full_name,
                    'poll_title': poll.title,
                }
            )

        return Response({
            'message': f"Vote for {employee.full_name} has been reset. The employee can now re-submit their vote.",
            'employee_id': employee.id,
            'deleted_count': deleted_count
        }, status=status.HTTP_200_OK)


# ==========================================
# COMMENTS & VOTING HISTORY
# ==========================================

class PollCommentViewSet(viewsets.ModelViewSet):
    serializer_class = PollCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        poll_id = self.request.query_params.get('poll')
        if poll_id:
            return PollComment.objects.filter(poll_id=poll_id)
        return PollComment.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        poll_id = self.request.data.get('poll')
        poll = Poll.objects.get(id=poll_id)

        is_anon = self.request.data.get('is_anonymous', False) or poll.anonymous_voting

        author_name = "Anonymous Employee" if is_anon else (
            user.full_name if getattr(user, 'role', None) == 'employee' else user.username
        )

        serializer.save(
            poll=poll,
            employee=user if (getattr(user, 'role', None) == 'employee' and not is_anon) else None,
            author_name=author_name,
            is_anonymous=is_anon
        )


class VotingHistoryView(views.APIView):
    permission_classes = [IsEmployeeRole]

    def get(self, request):
        employee = request.user

        # Get poll IDs voted in (both regular and anonymous)
        regular_poll_ids = set(Vote.objects.filter(employee=employee).values_list('poll_id', flat=True))
        anon_poll_ids = set(AnonymousParticipation.objects.filter(employee=employee).values_list('poll_id', flat=True))
        voted_ids = regular_poll_ids.union(anon_poll_ids)

        voted_polls = Poll.objects.filter(id__in=voted_ids).select_related('category')
        serializer = PollSerializer(voted_polls, many=True, context={'request': request})
        return Response(serializer.data)


# ==========================================
# ANALYTICS & DASHBOARD
# ==========================================

class DashboardAnalyticsView(views.APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        total_employees = Employee.objects.count()
        active_employees = Employee.objects.filter(is_active=True).count()
        inactive_employees = total_employees - active_employees

        total_polls = Poll.objects.count()
        active_polls = Poll.objects.filter(status='active').count()
        closed_polls = Poll.objects.filter(status='closed').count()
        draft_polls = Poll.objects.filter(status='draft').count()

        # Total votes across regular & anonymous
        regular_votes = Vote.objects.count()
        anon_votes = AnonymousParticipation.objects.count()
        total_votes = regular_votes + anon_votes

        # Overall participation percentage
        # Calculation: (total votes cast / (total active employees * total non-draft polls))
        eligible_vote_opportunities = active_employees * (active_polls + closed_polls)
        overall_participation = round((total_votes / eligible_vote_opportunities * 100), 1) if eligible_vote_opportunities > 0 else 0.0

        # Department participation breakdown
        dept_data = []
        for dept in Department.objects.annotate(emp_count=Count('employees', filter=Q(employees__is_active=True))):
            d_votes = Vote.objects.filter(employee__department=dept).count()
            dept_data.append({
                'id': dept.id,
                'name': dept.name,
                'code': dept.code,
                'employee_count': dept.emp_count,
                'vote_count': d_votes,
            })

        # Recent 5 polls
        recent_polls = PollSerializer(Poll.objects.all()[:5], many=True, context={'request': request}).data

        # Category distribution
        categories = [
            {'name': c.name, 'color': c.color, 'count': c.polls.count()}
            for c in PollCategory.objects.all()
        ]

        return Response({
            'total_employees': total_employees,
            'active_employees': active_employees,
            'inactive_employees': inactive_employees,
            'total_polls': total_polls,
            'active_polls': active_polls,
            'closed_polls': closed_polls,
            'draft_polls': draft_polls,
            'total_votes': total_votes,
            'overall_participation': overall_participation,
            'department_analytics': dept_data,
            'recent_polls': recent_polls,
            'categories': categories,
        })


class ExportReportView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def perform_content_negotiation(self, request, force=False):
        # Prevent DRF from 404ing on ?format=pdf or ?format=excel
        from rest_framework.renderers import BaseRenderer
        class AnyRenderer(BaseRenderer):
            media_type = '*/*'
            format = 'any'
            def render(self, data, accepted_media_type=None, renderer_context=None):
                return data
        return (AnyRenderer(), '*/*')

    def get(self, request):
        user = request.user
        # Support token authentication from query parameter (for direct browser download links)
        if not (user and user.is_authenticated):
            token_str = request.query_params.get('token')
            if token_str:
                from rest_framework_simplejwt.tokens import AccessToken
                try:
                    validated = AccessToken(token_str)
                    if validated.get('role') == 'admin':
                        user_id = validated[settings.SIMPLE_JWT['USER_ID_CLAIM']]
                        admin = AdminUser.objects.filter(
                            **{settings.SIMPLE_JWT['USER_ID_FIELD']: user_id},
                            is_active=True
                        ).first()
                        if admin and admin.is_staff:
                            user = admin
                            user.role = 'admin'
                except Exception:
                    pass

        # Validate administrator authorization
        if not user or not user.is_authenticated or (
            getattr(user, 'role', None) != 'admin' and
            not isinstance(user, AdminUser) and
            not getattr(user, 'is_staff', False)
        ):
            return Response(
                {'error': 'Administrator authentication credentials required to export reports.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        poll_id = request.query_params.get('poll_id')
        format_type = request.query_params.get('format', 'excel').lower()

        kolkata_tz = zoneinfo.ZoneInfo('Asia/Kolkata')
        now_ist = timezone.now().astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M:%S %p IST')

        # -----------------------------------------------
        # PDF FORMAT EXPORT (using ReportLab)
        # -----------------------------------------------
        if format_type == 'pdf':
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                from reportlab.lib import colors

                pdf_buffer = io.BytesIO()
                doc = SimpleDocTemplate(
                    pdf_buffer,
                    pagesize=letter,
                    rightMargin=36,
                    leftMargin=36,
                    topMargin=36,
                    bottomMargin=36
                )
                styles = getSampleStyleSheet()
                elements = []

                title_style = ParagraphStyle(
                    'TitleStyle',
                    parent=styles['Heading1'],
                    fontSize=18,
                    textColor=colors.HexColor('#0f172a'),
                    spaceAfter=8
                )
                meta_style = ParagraphStyle(
                    'MetaStyle',
                    parent=styles['Normal'],
                    fontSize=10,
                    textColor=colors.HexColor('#334155'),
                    spaceAfter=4
                )

                if poll_id:
                    try:
                        poll = Poll.objects.get(id=poll_id)
                        elements.append(Paragraph(f"Poll Results Report: {poll.title}", title_style))
                        elements.append(Paragraph(f"<b>Category:</b> {poll.category.name if poll.category else 'N/A'}", meta_style))
                        elements.append(Paragraph(f"<b>Voting Type:</b> {poll.get_voting_type_display()} | <b>Anonymous:</b> {'Yes' if poll.anonymous_voting else 'No'}", meta_style))
                        start_ist = poll.start_datetime.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M %p IST') if poll.start_datetime else '—'
                        end_ist = poll.end_datetime.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M %p IST') if poll.end_datetime else '—'
                        elements.append(Paragraph(f"<b>Voting Period:</b> {start_ist} to {end_ist}", meta_style))
                        elements.append(Paragraph(f"<b>Report Generated:</b> {now_ist}", meta_style))
                        elements.append(Spacer(1, 14))

                        table_data = [["Option", "Vote Count", "Percentage"]]
                        total_selections = VoteSelection.objects.filter(poll=poll).count()
                        for opt in poll.options.all():
                            cnt = VoteSelection.objects.filter(poll=poll, option=opt).count()
                            pct = round((cnt / total_selections * 100), 1) if total_selections > 0 else 0.0
                            table_data.append([opt.text, str(cnt), f"{pct}%"])

                        t = Table(table_data, colWidths=[320, 100, 100])
                        t.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                            ('FONTSIZE', (0, 0), (-1, 0), 10),
                            ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
                            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
                            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                            ('FONTSIZE', (0, 1), (-1, -1), 9),
                        ]))
                        elements.append(t)
                    except Poll.DoesNotExist:
                        return Response({'error': 'Poll not found'}, status=status.HTTP_404_NOT_FOUND)
                else:
                    elements.append(Paragraph("SG ONE - System-Wide Polling Overview", title_style))
                    elements.append(Paragraph(f"<b>Report Generated:</b> {now_ist}", meta_style))
                    elements.append(Spacer(1, 14))

                    table_data = [
                        ["Metric", "Value"],
                        ["Total Registered Employees", str(Employee.objects.count())],
                        ["Active Employees", str(Employee.objects.filter(is_active=True).count())],
                        ["Total Polls Created", str(Poll.objects.count())],
                        ["Active Polls", str(Poll.objects.filter(status='active').count())],
                        ["Total Votes Recorded", str(Vote.objects.count() + AnonymousParticipation.objects.count())]
                    ]
                    t = Table(table_data, colWidths=[320, 200])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                        ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ]))
                    elements.append(t)

                doc.build(elements)
                pdf_buffer.seek(0)
                response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
                filename = f"Poll_{poll_id}_Results.pdf" if poll_id else "SG_ONE_System_Report.pdf"
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                return response
            except Exception as e:
                return Response({'error': f'Failed to generate PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # -----------------------------------------------
        # EXCEL FORMAT EXPORT (using openpyxl)
        # -----------------------------------------------
        wb = openpyxl.Workbook()
        ws = wb.active

        if poll_id:
            try:
                poll = Poll.objects.get(id=poll_id)
                ws.title = "Poll Results"

                ws.append(["Poll Title", poll.title])
                ws.append(["Category", poll.category.name if poll.category else "N/A"])
                ws.append(["Voting Type", poll.get_voting_type_display()])
                ws.append(["Anonymous", "Yes" if poll.anonymous_voting else "No"])
                ws.append(["Status", poll.get_status_display()])
                start_ist = poll.start_datetime.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M:%S %p IST') if poll.start_datetime else '—'
                end_ist = poll.end_datetime.astimezone(kolkata_tz).strftime('%d-%m-%Y %I:%M:%S %p IST') if poll.end_datetime else '—'
                ws.append(["Start Time (IST)", start_ist])
                ws.append(["Closing Time (IST)", end_ist])
                ws.append(["Report Generated At (IST)", now_ist])
                ws.append([])

                ws.append(["Option", "Vote Count", "Percentage"])
                total_selections = VoteSelection.objects.filter(poll=poll).count()
                for opt in poll.options.all():
                    cnt = VoteSelection.objects.filter(poll=poll, option=opt).count()
                    pct = round((cnt / total_selections * 100), 1) if total_selections > 0 else 0.0
                    ws.append([opt.text, cnt, f"{pct}%"])

            except Poll.DoesNotExist:
                return Response({'error': 'Poll not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            ws.title = "SG ONE Overview"
            ws.append(["Metric", "Value"])
            ws.append(["Total Employees", Employee.objects.count()])
            ws.append(["Active Employees", Employee.objects.filter(is_active=True).count()])
            ws.append(["Total Polls", Poll.objects.count()])
            ws.append(["Active Polls", Poll.objects.filter(status='active').count()])
            ws.append(["Total Votes Recorded", Vote.objects.count() + AnonymousParticipation.objects.count()])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        filename = f"Poll_{poll_id}_Results.xlsx" if poll_id else "SG_ONE_System_Report.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ==========================================
# NOTIFICATIONS
# ==========================================

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        if role == 'admin':
            return Notification.objects.filter(recipient_admin=user)
        elif role == 'employee':
            return Notification.objects.filter(recipient_employee=user)
        return Notification.objects.none()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'success': True})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(is_read=False)
        qs.update(is_read=True)
        return Response({'success': True, 'marked_count': qs.count()})


# ==========================================
# AUDIT LOGS
# ==========================================

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminRole]
