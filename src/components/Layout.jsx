import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Tableau', icon: LayoutDashboard },
  { path: '/pipeline', label: 'Pipeline', icon: FolderKanban },
  { path: '/boutique', label: 'Boutique', icon: ShoppingCart },
  { path: '/devis', label: 'Devis', icon: FileText },
  { path: '/plus', label: 'Plus', icon: MoreHorizontal },
];

export default function Layout({ children }) {
  const location = useLocation();
  if (location.pathname === '/') return children;
  return (
    <div className="app-container">
      <main className="screen">{children}</main>
      <nav className="tab-bar">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
            <item.icon size={22} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
