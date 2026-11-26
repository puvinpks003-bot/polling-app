export type UserRole = 'admin' | 'employee';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_staff: boolean;
}

export interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  mobile_number: string;
  email?: string | null;
  department?: number | null;
  department_name?: string | null;
  designation?: string;
  joining_date?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  employee_count?: number;
  created_at?: string;
}

export interface PollCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  poll_count?: number;
}

export type VotingType = 'single_choice' | 'multiple_choice' | 'yes_no' | 'rating';
export type TargetAudience = 'all' | 'department' | 'selected_employees';
export type PollStatus = 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';
export type ResultsVisibility = 'always' | 'after_voting' | 'after_closing' | 'admin_only';

export interface PollOption {
  id: number;
  poll?: number;
  text: string;
  order: number;
  vote_count?: number;
  percentage?: number;
}

export interface Poll {
  id: number;
  title: string;
  description: string;
  category?: number | null;
  category_name?: string | null;
  category_color?: string | null;
  cover_image?: string | null;
  start_datetime: string;
  end_datetime: string;
  voting_type: VotingType;
  target_audience: TargetAudience;
  anonymous_voting: boolean;
  allow_comments: boolean;
  results_visibility: ResultsVisibility;
  status: PollStatus;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  options: PollOption[];
  target_department_names?: string[];
  has_voted?: boolean;
  my_selections?: number[];
  total_votes?: number;
  participation_rate?: number;
  can_view_results?: boolean;
  comments_count?: number;
  rating_stats?: {
    average: number;
    total: number;
  } | null;
}

export interface PollResults {
  poll_id: number;
  title: string;
  anonymous_voting: boolean;
  voting_type: VotingType;
  total_participants: number;
  total_eligible: number;
  participation_rate: number;
  total_selections: number;
  options: {
    id: number;
    text: string;
    order: number;
    vote_count: number;
    percentage: number;
  }[];
  winner?: {
    id: number;
    text: string;
    vote_count: number;
    percentage: number;
  } | null;
  department_breakdown?: {
    department: string;
    count: number;
  }[];
  rating_stats?: {
    average_rating: number;
    total_ratings: number;
    distribution: Record<number, number>;
  } | null;
  voters?: {
    vote_id?: number;
    employee_pk: number;
    employee_id: string;
    employee_name: string;
    department: string;
    selections: string[];
    voted_at: string;
  }[];
}

export interface PollComment {
  id: number;
  poll: number;
  author_name: string;
  comment: string;
  is_anonymous: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  user_type: string;
  actor_name: string;
  target_model: string;
  target_id: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface DashboardAnalytics {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  total_polls: number;
  active_polls: number;
  closed_polls: number;
  draft_polls: number;
  total_votes: number;
  overall_participation: number;
  department_analytics: {
    id: number;
    name: string;
    code: string;
    employee_count: number;
    vote_count: number;
  }[];
  recent_polls: Poll[];
  categories: {
    name: string;
    color: string;
    count: number;
  }[];
}
