import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from '../../utils/constants';

export default function Sidebar() {
  const { logout, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const items = isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS;

  function handleLogout() {
    logout()
      .then(function () {
        toast.success('Logged out successfully');
        navigate('/login', { replace: true });
      })
      .catch(function () {
        toast.error('Failed to log out. Please try again.');
      });
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 hidden lg:flex flex-col bg-white border-r border-border-subtle p-stack-md gap-stack-sm z-40">
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-white shrink-0">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            school
          </span>
        </div>
        <div>
          <Link to="/dashboard">
            <span className="font-headline-md text-headline-md font-bold text-primary leading-none">
              StudyKarle
            </span>
          </Link>
        </div>
      </div>

      <nav className="flex-1 space-y-1" aria-label="Main navigation">
        {items.map(function (item) {
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={function (props) {
                return (
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-label-md text-label-md " +
                  (props.isActive
                    ? "bg-primary-container text-on-primary font-bold translate-x-1"
                    : "text-text-secondary hover:bg-surface-low")
                );
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-border-subtle">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-status-danger hover:bg-error-container/20 rounded-lg transition-all font-label-md text-label-md"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            logout
          </span>
          Logout
        </button>
      </div>
    </aside>
  );
}
