import { Phone, Building2, ArrowRight } from 'lucide-react';
import type { Conversation, ConversationStatus } from '@/lib/supabase';

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
  selectedId: string | null;
}

const statusConfig: Record<ConversationStatus, { label: string; class: string }> = {
  active: { label: 'Aktiv', class: 'bg-green-100 text-green-700' },
  referred: { label: 'Henvist', class: 'bg-[#e0f9fb] text-[#0a9ba6]' },
  resolved: { label: 'Løst', class: 'bg-gray-100 text-gray-500' },
  pending: { label: 'Venter', class: 'bg-amber-100 text-amber-700' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Nå';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ConversationList({ conversations, onSelect, selectedId }: ConversationListProps) {
  return (
    <div className="divide-y divide-gray-50">
      {conversations.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8">Ingen samtaler ennå</p>
      )}
      {conversations.map((conv) => {
        const st = statusConfig[conv.status];
        const isSelected = selectedId === conv.id;
        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-100 ${
              isSelected ? 'bg-[#f0fbfc]' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#14c8d4]/30 to-[#0d1e3d]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[#0d1e3d] text-xs font-bold">
                  {conv.patient_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">{conv.patient_name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.started_at)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {conv.patient_phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Phone size={10} />
                      {conv.patient_phone}
                    </span>
                  )}
                </div>
                {conv.referral_clinic && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Building2 size={10} className="text-[#14c8d4] flex-shrink-0" />
                    <span className="text-xs text-gray-500 truncate">{conv.referral_clinic}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${st.class}`}>
                    {st.label}
                  </span>
                  {conv.referral_reason && (
                    <span className="text-xs text-gray-400 truncate max-w-[140px]">{conv.referral_reason}</span>
                  )}
                </div>
              </div>
              <ArrowRight size={14} className="text-gray-300 flex-shrink-0 mt-2" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
