import { Building2, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { PatientReferral, ReferralStatus } from '@/lib/supabase';

interface ReferralsListProps {
  referrals: PatientReferral[];
}

const statusConfig: Record<ReferralStatus, { label: string; icon: React.ElementType; class: string }> = {
  pending: { label: 'Venter', icon: Clock, class: 'text-amber-600 bg-amber-50' },
  confirmed: { label: 'Bekreftet', icon: CheckCircle2, class: 'text-[#14c8d4] bg-[#e0f9fb]' },
  completed: { label: 'Fullført', icon: CheckCircle2, class: 'text-green-600 bg-green-50' },
  cancelled: { label: 'Kansellert', icon: XCircle, class: 'text-gray-400 bg-gray-50' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t siden`;
  return `${Math.floor(hrs / 24)}d siden`;
}

export default function ReferralsList({ referrals }: ReferralsListProps) {
  return (
    <div className="space-y-2">
      {referrals.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-6">Ingen henvisninger ennå</p>
      )}
      {referrals.map((ref) => {
        const st = statusConfig[ref.status];
        const StatusIcon = st.icon;
        return (
          <div
            key={ref.id}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-150"
          >
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 border border-gray-100">
              <span className="text-[#0d1e3d] text-xs font-bold">
                {ref.patient_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-800 truncate">{ref.patient_name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(ref.created_at)}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Building2 size={10} className="text-[#14c8d4] flex-shrink-0" />
                <span className="text-xs text-gray-500 truncate">{ref.clinic_name}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <span className="text-xs text-gray-400 truncate">{ref.reason}</span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.class}`}>
                  <StatusIcon size={10} />
                  {st.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
