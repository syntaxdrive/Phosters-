import { NavLink } from 'react-router-dom';

const adminLinks = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/students', label: 'Students', end: false },
  { to: '/admin/announcements', label: 'Announcements', end: false },
  { to: '/admin/examinations', label: 'Examinations', end: false },
  { to: '/admin/subjects', label: 'Subjects', end: false },
  { to: '/admin/topics', label: 'Topics', end: false },
  { to: '/admin/lessons', label: 'Lessons', end: false },
  { to: '/admin/tests', label: 'Tests', end: false },
];

export function AdminNav() {
  return (
    <nav
      aria-label="Admin sections"
      className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200"
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
                ? 'bg-phosters-50 text-phosters-800 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
