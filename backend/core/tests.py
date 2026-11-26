from datetime import timedelta
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from core.models import (
    AdminUser, Employee, Department, PollCategory, Poll,
    PollOption, PollTarget, Vote, AnonymousParticipation,
    OTPVerification, VoteSelection
)
from core.auth import hash_otp


class CompanyPulseMasterWorkflowTests(APITestCase):

    def setUp(self):
        # 1. Setup Admin
        self.admin = AdminUser.objects.create_superuser(
            username='admin_test',
            email='admin@test.com',
            password='AdminTest@123'
        )

        # 2. Setup Departments & Categories
        self.dept_tech = Department.objects.create(name='Technology', code='TEC')
        self.dept_hr = Department.objects.create(name='Human Resources', code='HR')
        self.category = PollCategory.objects.create(name='Culture', color='#3b82f6')

        # 3. Setup Employees
        self.emp_tech = Employee.objects.create(
            employee_id='TEC001',
            full_name='Alice Smith',
            mobile_number='+919988776655',
            email='alice@test.com',
            department=self.dept_tech,
            is_active=True
        )

        self.emp_hr = Employee.objects.create(
            employee_id='HR001',
            full_name='Bob Jones',
            mobile_number='+919988776600',
            email='bob@test.com',
            department=self.dept_hr,
            is_active=True
        )

    # TEST 1: Admin login
    def test_admin_login_success(self):
        url = reverse('admin-login')
        res = self.client.post(url, {'username': 'admin_test', 'password': 'AdminTest@123'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['role'], 'admin')

    # TEST 2: Invalid admin login
    def test_admin_login_invalid(self):
        url = reverse('admin-login')
        res = self.client.post(url, {'username': 'admin_test', 'password': 'WrongPassword!'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # TEST 3: Employee registration by admin & TEST 9: Duplicate mobile number prevention
    def test_employee_registration_and_duplicate_prevention(self):
        login_res = self.client.post(reverse('admin-login'), {'username': 'admin_test', 'password': 'AdminTest@123'})
        token = login_res.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Add new employee
        emp_data = {
            'employee_id': 'TEC002',
            'full_name': 'Charlie Brown',
            'mobile_number': '+919988776611',
            'email': 'charlie@test.com',
            'department': self.dept_tech.id,
            'designation': 'Software Engineer',
            'is_active': True,
        }
        res = self.client.post(reverse('employee-list'), emp_data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Try duplicate mobile
        dup_data = emp_data.copy()
        dup_data['employee_id'] = 'TEC003'
        res_dup = self.client.post(reverse('employee-list'), dup_data)
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

    # TEST 4: Employee login with correct name and mobile
    def test_employee_request_otp_success(self):
        url = reverse('employee-request-otp')
        res = self.client.post(url, {
            'full_name': 'alice smith',  # case-insensitive check
            'mobile_number': '+919988776655'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('dev_otp', res.data)

    # TEST 5: Employee login with incorrect details
    def test_employee_request_otp_incorrect_details(self):
        url = reverse('employee-request-otp')
        res = self.client.post(url, {
            'full_name': 'Unknown Person',
            'mobile_number': '+910000000000'
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # TEST 6: Employee OTP verification
    def test_employee_otp_verification_success(self):
        req_res = self.client.post(reverse('employee-request-otp'), {
            'full_name': 'Alice Smith',
            'mobile_number': '+919988776655'
        })
        otp = req_res.data['dev_otp']

        v_res = self.client.post(reverse('employee-verify-otp'), {
            'mobile_number': '+919988776655',
            'otp': otp
        })
        self.assertEqual(v_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', v_res.data)
        self.assertEqual(v_res.data['role'], 'employee')
        self.assertEqual(v_res.data['employee']['employee_id'], 'TEC001')

    # TEST 7: Expired OTP
    def test_employee_otp_expired(self):
        now = timezone.now()
        OTPVerification.objects.create(
            mobile_number='+919988776655',
            otp_hash=hash_otp('123456', '+919988776655'),
            attempts=0,
            expires_at=now - timedelta(minutes=10)
        )
        res = self.client.post(reverse('employee-verify-otp'), {
            'mobile_number': '+919988776655',
            'otp': '123456'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # TEST 8: Inactive employee login
    def test_inactive_employee_cannot_request_otp(self):
        self.emp_tech.is_active = False
        self.emp_tech.save()

        res = self.client.post(reverse('employee-request-otp'), {
            'full_name': 'Alice Smith',
            'mobile_number': '+919988776655'
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # TEST 10: Poll creation & TEST 11: Poll publication
    def test_poll_creation_and_publication(self):
        login_res = self.client.post(reverse('admin-login'), {'username': 'admin_test', 'password': 'AdminTest@123'})
        token = login_res.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        now = timezone.now()
        poll_data = {
            'title': 'Test Workplace Poll',
            'description': 'Office setup survey',
            'category': self.category.id,
            'start_datetime': now.isoformat(),
            'end_datetime': (now + timedelta(days=5)).isoformat(),
            'voting_type': 'single_choice',
            'target_audience': 'all',
            'anonymous_voting': False,
            'status': 'draft',
            'options': [{'text': 'Option A'}, {'text': 'Option B'}]
        }
        res = self.client.post(reverse('poll-list'), poll_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        poll_id = res.data['id']

        pub_res = self.client.post(reverse('poll-publish', kwargs={'pk': poll_id}))
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.data['status'], 'active')

    # TEST 12: Employee poll visibility (Targeting verification)
    def test_employee_poll_targeting_visibility(self):
        now = timezone.now()
        # Create a poll targeted strictly to Technology department
        poll_tech_only = Poll.objects.create(
            title='Tech Architecture Poll',
            category=self.category,
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(days=2),
            target_audience='department',
            status='active'
        )
        PollTarget.objects.create(poll=poll_tech_only, department=self.dept_tech)

        # Authenticate Tech employee (Alice) -> Should see this poll
        req_res1 = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res1 = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res1.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res1.data["access"]}')

        tech_res = self.client.get(reverse('poll-list')).data
        tech_polls = tech_res.get('results', tech_res) if isinstance(tech_res, dict) else tech_res
        self.assertTrue(any(p['id'] == poll_tech_only.id for p in tech_polls))

        # Authenticate HR employee (Bob) -> Should NOT see this poll
        req_res2 = self.client.post(reverse('employee-request-otp'), {'full_name': 'Bob Jones', 'mobile_number': '+919988776600'})
        v_res2 = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776600', 'otp': req_res2.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res2.data["access"]}')

        hr_res = self.client.get(reverse('poll-list')).data
        hr_polls = hr_res.get('results', hr_res) if isinstance(hr_res, dict) else hr_res
        self.assertFalse(any(p['id'] == poll_tech_only.id for p in hr_polls))

    # TEST 13: Successful voting, TEST 14: Duplicate prevention, TEST 16: Anonymous privacy
    def test_voting_flow_and_duplicate_prevention_anonymous(self):
        now = timezone.now()
        poll = Poll.objects.create(
            title='Anonymous Feedback',
            category=self.category,
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(days=2),
            voting_type='single_choice',
            target_audience='all',
            anonymous_voting=True,
            status='active'
        )
        opt1 = PollOption.objects.create(poll=poll, text='Yes', order=1)
        opt2 = PollOption.objects.create(poll=poll, text='No', order=2)

        # Authenticate employee
        req_res = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')

        # Vote
        vote_res = self.client.post(
            reverse('poll-vote', kwargs={'pk': poll.id}),
            {'option_ids': [opt1.id]},
            format='json'
        )
        self.assertEqual(vote_res.status_code, status.HTTP_201_CREATED)

        # Anonymity check: AnonymousParticipation exists, Vote is empty
        self.assertTrue(AnonymousParticipation.objects.filter(poll=poll, employee=self.emp_tech).exists())
        self.assertFalse(Vote.objects.filter(poll=poll, employee=self.emp_tech).exists())

        # Duplicate vote attempt
        dup_res = self.client.post(
            reverse('poll-vote', kwargs={'pk': poll.id}),
            {'option_ids': [opt2.id]},
            format='json'
        )
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already voted', dup_res.data['error'])

    # TEST 15: Poll closing validation
    def test_cannot_vote_in_closed_poll(self):
        now = timezone.now()
        poll = Poll.objects.create(
            title='Closed Poll',
            category=self.category,
            start_datetime=now - timedelta(days=5),
            end_datetime=now - timedelta(days=1),
            voting_type='single_choice',
            target_audience='all',
            status='closed'
        )
        opt = PollOption.objects.create(poll=poll, text='Opt', order=1)

        req_res = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')

        vote_res = self.client.post(reverse('poll-vote', kwargs={'pk': poll.id}), {'option_ids': [opt.id]}, format='json')
        self.assertEqual(vote_res.status_code, status.HTTP_400_BAD_REQUEST)

    # TEST 17: Analytics accuracy
    def test_analytics_dashboard_metrics(self):
        login_res = self.client.post(reverse('admin-login'), {'username': 'admin_test', 'password': 'AdminTest@123'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')

        res = self.client.get(reverse('analytics-dashboard'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_employees'], 2)
        self.assertEqual(res.data['active_employees'], 2)
        self.assertIn('overall_participation', res.data)

    # TEST 19: Role and API permissions
    def test_employee_cannot_manage_employees(self):
        req_res = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')

        # Employee tries to hit employee list (Admin only)
        res = self.client.get(reverse('employee-list'))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # TEST 20: Results are restricted strictly to Admin
    def test_results_restricted_to_admin_only(self):
        now = timezone.now()
        poll = Poll.objects.create(
            title='Confidential Poll',
            category=self.category,
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(days=2),
            status='active'
        )
        PollOption.objects.create(poll=poll, text='Opt A', order=1)

        # 1. Employee tries to view results -> 403 Forbidden
        req_res = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')

        emp_res = self.client.get(reverse('poll-results', kwargs={'pk': poll.id}))
        self.assertEqual(emp_res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Admin views results -> 200 OK
        login_res = self.client.post(reverse('admin-login'), {'username': 'admin_test', 'password': 'AdminTest@123'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')

        admin_res = self.client.get(reverse('poll-results', kwargs={'pk': poll.id}))
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)

    # TEST 21: Admin resets employee vote allowing re-submission
    def test_admin_can_reset_vote_and_employee_can_resubmit(self):
        now = timezone.now()
        poll = Poll.objects.create(
            title='Resubmit Poll Test',
            category=self.category,
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(days=2),
            voting_type='single_choice',
            target_audience='all',
            status='active'
        )
        opt1 = PollOption.objects.create(poll=poll, text='First Choice', order=1)
        opt2 = PollOption.objects.create(poll=poll, text='Second Choice', order=2)

        # 1. Employee votes for Option 1
        req_res = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')

        vote_res = self.client.post(reverse('poll-vote', kwargs={'pk': poll.id}), {'option_ids': [opt1.id]}, format='json')
        self.assertEqual(vote_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Vote.objects.filter(poll=poll, employee=self.emp_tech).exists())

        # 2. Admin resets employee's vote
        login_res = self.client.post(reverse('admin-login'), {'username': 'admin_test', 'password': 'AdminTest@123'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')

        reset_res = self.client.post(
            reverse('poll-reset-vote', kwargs={'pk': poll.id}),
            {'employee_id': self.emp_tech.id},
            format='json'
        )
        self.assertEqual(reset_res.status_code, status.HTTP_200_OK)

        # Verify prior record is deleted
        self.assertFalse(Vote.objects.filter(poll=poll, employee=self.emp_tech).exists())
        self.assertFalse(VoteSelection.objects.filter(poll=poll).exists())

        # 3. Employee can now re-submit their vote (choose Option 2)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')
        revote_res = self.client.post(reverse('poll-vote', kwargs={'pk': poll.id}), {'option_ids': [opt2.id]}, format='json')
        self.assertEqual(revote_res.status_code, status.HTTP_201_CREATED)

        # Verify new vote is saved with Option 2
        new_vote = Vote.objects.get(poll=poll, employee=self.emp_tech)
        self.assertEqual(new_vote.selections.first().option, opt2)

    # TEST 22: Results visibility settings (always, after_voting, after_closing, admin_only)
    def test_results_visibility_matrix(self):
        now = timezone.now()
        
        # 1. 'always' - employee can view results without voting
        poll_always = Poll.objects.create(
            title='Always Visible Poll',
            category=self.category,
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(days=2),
            voting_type='single_choice',
            target_audience='all',
            results_visibility='always',
            status='active'
        )
        opt_a = PollOption.objects.create(poll=poll_always, text='Alpha', order=1)
        opt_b = PollOption.objects.create(poll=poll_always, text='Beta', order=2)

        req_res = self.client.post(reverse('employee-request-otp'), {'full_name': 'Alice Smith', 'mobile_number': '+919988776655'})
        v_res = self.client.post(reverse('employee-verify-otp'), {'mobile_number': '+919988776655', 'otp': req_res.data['dev_otp']})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {v_res.data["access"]}')

        res_always = self.client.get(reverse('poll-results', kwargs={'pk': poll_always.id}))
        self.assertEqual(res_always.status_code, status.HTTP_200_OK)

        # 2. 'after_voting' - 403 before voting, 200 after voting
        poll_after_vote = Poll.objects.create(
            title='After Voting Poll',
            category=self.category,
            start_datetime=now - timedelta(hours=1),
            end_datetime=now + timedelta(days=2),
            voting_type='single_choice',
            target_audience='all',
            results_visibility='after_voting',
            status='active'
        )
        opt_v1 = PollOption.objects.create(poll=poll_after_vote, text='V1', order=1)
        opt_v2 = PollOption.objects.create(poll=poll_after_vote, text='V2', order=2)

        res_before = self.client.get(reverse('poll-results', kwargs={'pk': poll_after_vote.id}))
        self.assertEqual(res_before.status_code, status.HTTP_403_FORBIDDEN)

        self.client.post(reverse('poll-vote', kwargs={'pk': poll_after_vote.id}), {'option_ids': [opt_v1.id]}, format='json')
        res_after = self.client.get(reverse('poll-results', kwargs={'pk': poll_after_vote.id}))
        self.assertEqual(res_after.status_code, status.HTTP_200_OK)

        # 3. 'after_closing' - 403 while active (even if voted), 200 when closed
        poll_closing = Poll.objects.create(
            title='After Closing Poll',
            category=self.category,
            start_datetime=now - timedelta(hours=2),
            end_datetime=now + timedelta(days=1),
            voting_type='single_choice',
            target_audience='all',
            results_visibility='after_closing',
            status='active'
        )
        opt_c1 = PollOption.objects.create(poll=poll_closing, text='C1', order=1)
        self.client.post(reverse('poll-vote', kwargs={'pk': poll_closing.id}), {'option_ids': [opt_c1.id]}, format='json')
        
        res_closing_active = self.client.get(reverse('poll-results', kwargs={'pk': poll_closing.id}))
        self.assertEqual(res_closing_active.status_code, status.HTTP_403_FORBIDDEN)

        # Now close the poll
        poll_closing.status = 'closed'
        poll_closing.save()
        res_closing_closed = self.client.get(reverse('poll-results', kwargs={'pk': poll_closing.id}))
        self.assertEqual(res_closing_closed.status_code, status.HTTP_200_OK)

        # 4. 'admin_only' - 403 for employee even after voting and when closed
        poll_admin_only = Poll.objects.create(
            title='Admin Only Poll',
            category=self.category,
            start_datetime=now - timedelta(hours=2),
            end_datetime=now - timedelta(hours=1),
            voting_type='single_choice',
            target_audience='all',
            results_visibility='admin_only',
            status='closed'
        )
        res_admin_only = self.client.get(reverse('poll-results', kwargs={'pk': poll_admin_only.id}))
        self.assertEqual(res_admin_only.status_code, status.HTTP_403_FORBIDDEN)

    # TEST 23: Direct employee identification login when OTP verification is disabled
    def test_direct_employee_identification_login_without_otp(self):
        # Submit identification
        res = self.client.post(reverse('employee-request-otp'), {
            'full_name': 'Alice Smith',
            'mobile_number': '+919988776655'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Direct access token provided without needing OTP verification
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data.get('otp_required'), False)
        self.assertEqual(res.data.get('employee', {}).get('employee_id'), self.emp_tech.employee_id)
