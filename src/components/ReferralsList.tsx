import {
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

import type {
  PatientReferral,
  ReferralStatus,
} from '@/lib/supabase';

interface ReferralsListProps {
  referrals: PatientReferral[];
  onSelect?: (referral: PatientReferral) => void;
}

const statusConfig: Record<
  ReferralStatus,
  {
    label: string;
    icon: React.ElementType;
    class: string;
  }
> = {
  pending: {
    label: 'Venter',
    icon: Clock,
    class: 'text-amber-600 bg-amber-50',
  },

  confirmed: {
    label: 'Bekreftet',
    icon: CheckCircle2,
    class: 'text-[#14c8d4] bg-[#e0f9fb]',
  },

  assigned: {
    label: 'Tildelt',
    icon: Building2,
    class: 'text-blue-600 bg-blue-50',
  },

  completed: {
    label: 'Fullført',
    icon: CheckCircle2,
    class: 'text-green-600 bg-green-50',
  },

  cancelled: {
    label: 'Kansellert',
    icon: XCircle,
    class: 'text-gray-400 bg-gray-50',
  },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 60) {
    return `${mins} min siden`;
  }

  const hrs = Math.floor(mins / 60);

  if (hrs < 24) {
    return `${hrs}t siden`;
  }

  return `${Math.floor(hrs / 24)}d siden`;
}

export default function ReferralsList({
  referrals,
  onSelect,
}: ReferralsListProps) {
  return (
    <div className="space-y-2">
      {referrals.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">
          Ingen henvisninger ennå
        </p>
      )}

      {referrals.map((referral) => {
        const status = statusConfig[referral.status];
        const StatusIcon = status.icon;

        return (
          <button
            type="button"
            key={referral.id}
            onClick={() => onSelect?.(referral)}
            className="flex w-full items-start gap-3 rounded-xl bg-gray-50 p-3 text-left transition-colors duration-150 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm">
              <span className="text-xs font-bold text-[#0d1e3d]">
                {referral.patient_name
                  .split(' ')
                  .map((name) => name[0])
                  .join('')
                  .slice(0, 2)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-gray-800">
                  {referral.patient_name}
                </span>

                <span className="flex-shrink-0 text-xs text-gray-400">
                  {timeAgo(referral.created_at)}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-1">
                <Building2
                  size={10}
                  className="flex-shrink-0 text-[#14c8d4]"
                />

                <span className="truncate text-xs text-gray-500">
                  {referral.clinic_name}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-gray-400">
                  {referral.reason}
                </span>

                <span
                  className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.class}`}
                >
                  <StatusIcon size={10} />
                  {status.label}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}