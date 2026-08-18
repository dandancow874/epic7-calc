import { Calculator, FlaskConical, Shield } from 'lucide-react';
import type { AppPage } from '../../app/navigation';

type Props = {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
};

const items: Array<{ page: AppPage; label: string; icon: typeof Calculator }> = [
  { page: 'calculator', label: '伤害计算', icon: Calculator },
  { page: 'builds', label: '角色装备', icon: Shield },
];

export function PrimaryNav({ page, onNavigate }: Props) {
  return (
    <nav className="primary-nav" aria-label="E7 Tools 主导航">
      <div className="primary-nav__mark"><FlaskConical size={18} /><span>E7 Tools</span></div>
      <div className="primary-nav__items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              type="button"
              className={page === item.page ? 'active' : ''}
              title={item.label}
              onClick={() => onNavigate(item.page)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
