import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from '../../utils/constants';

export default function MobileNav() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (isAdmin) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-white p-2 lg:hidden" aria-label="Mobile admin navigation">
        <label className="mx-auto flex max-w-lg items-center gap-3 px-2 text-sm font-semibold text-text-primary">
          Admin tools
          <select
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-border-subtle bg-white px-2"
            value={ADMIN_NAV_ITEMS.some((item) => item.path === pathname) ? pathname : ""}
            onChange={(event) => navigate(event.target.value)}
          >
            <option value="" disabled>Choose a page</option>
            {ADMIN_NAV_ITEMS.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
          </select>
        </label>
      </nav>
    );
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-border-subtle flex justify-around items-center py-2 z-50"
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map(function (item) {
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={function (props) {
              return (
                'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg ' +
                (props.isActive ? 'text-primary' : 'text-text-muted')
              );
            }}
          >
            {function (props) {
              return (
                <React.Fragment>
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={props.isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className={'text-[10px] ' + (props.isActive ? 'font-bold' : 'font-medium')}>
                    {item.label}
                  </span>
                </React.Fragment>
              );
            }}
          </NavLink>
        );
      })}
    </nav>
  );
}
