from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AdminLoginView, EmployeeRequestOTPView, EmployeeVerifyOTPView, CurrentUserView,
    EmployeeViewSet, DepartmentViewSet, PollCategoryViewSet, PollViewSet,
    PollCommentViewSet, VotingHistoryView, DashboardAnalyticsView, ExportReportView,
    NotificationViewSet, AuditLogViewSet
)

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'categories', PollCategoryViewSet, basename='category')
router.register(r'polls', PollViewSet, basename='poll')
router.register(r'comments', PollCommentViewSet, basename='comment')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    # Auth endpoints
    path('auth/admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('auth/employee/request-otp/', EmployeeRequestOTPView.as_view(), name='employee-request-otp'),
    path('auth/employee/verify-otp/', EmployeeVerifyOTPView.as_view(), name='employee-verify-otp'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),

    # Voting & Analytics
    path('voting/history/', VotingHistoryView.as_view(), name='voting-history'),
    path('analytics/dashboard/', DashboardAnalyticsView.as_view(), name='analytics-dashboard'),
    path('reports/export/', ExportReportView.as_view(), name='reports-export'),

    # Router endpoints
    path('', include(router.urls)),
]
