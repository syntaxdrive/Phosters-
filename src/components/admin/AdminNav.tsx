import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminUser } from '../../lib/superAdmin';

const baseAdminLinks = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/students', label: 'Students', end: false },
  { to: '/admin/announcements', label: 'Announcements', end: false },
  { to: '/admin/examinations', label: 'Examinations', end: false },
  { to: '/admin/subjects', label: 'Subjects', end: false },
  { to: '/admin/topics', label: 'Topics', end: false },
  { to: '/admin/lessons', label: 'Lessons', end: false },
  { to: '/admin/tests', label: 'Tests', end: false },
  { to: '/admin/mocks', label: 'Mock Exams', end: false },
  { to: '/admin/guide', label: 'Tutor Guide', end: false },
];

export function AdminNav() {
  const { user, profile } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user?.email, profile?.role);
  const adminLinks = isSuperAdmin
    ? [
        ...baseAdminLinks,
        { to: '/admin/question-bank', label: 'Question Bank', end: false },
        { to: '/admin/accounts', label: 'Tutor Access', end: false },
      ]
    : baseAdminLinks;

  return (
    <nav
      aria-label="Admin sections"
      className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
    >
      {adminLinks.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              'inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors',
              isActive
                ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
