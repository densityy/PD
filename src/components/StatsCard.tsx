import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color: 'teal' | 'navy' | 'green' | 'amber' | 'rose';
}

const colorMap = {
  teal: {
    icon: 'bg-[#e0f9fb] text-[#14c8d4]',
    value: 'text-[#0d1e3d]',
  },
  navy: {
    icon: 'bg-[#e8edf5] text-[#0d1e3d]',
    value: 'text-[#0d1e3d]',
  },
  green: {
    icon: 'bg-[#dcfce7] text-[#16a34a]',
    value: 'text-[#0d1e3d]',
  },
  amber: {
    icon: 'bg-[#fef3c7] text-[#d97706]',
    value: 'text-[#0d1e3d]',
  },
  rose: {
    icon: 'bg-[#ffe4e6] text-[#e11d48]',
    value: 'text-[#0d1e3d]',
  },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color }: StatsCardProps) {
  const colors = colorMap[color];
  return (
    <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide truncate">{title}</p>
          <p className={`text-3xl font-bold mt-1.5 ${colors.value}`}>{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1 truncate">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1.5 font-medium ${trend.positive ? 'text-green-600' : 'text-rose-500'}`}>
              {trend.positive ? '+' : ''}{trend.value}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
