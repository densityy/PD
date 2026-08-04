import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';

import StatsCard from '@/components/StatsCard';
import ConversationList from '@/components/ConversationList';
import AIChatPreview from '@/components/AIChatPreview';
import BookingChart from '@/components/BookingChart';
import ReferralsList from '@/components/ReferralsList';

import { supabase } from '@/lib/supabase';
import type {
  Conversation,
  DashboardStat,
  PatientReferral,
} from '@/lib/supabase';

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [referrals, setReferrals] = useState<PatientReferral[]>([]);
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();

  const greeting =
    now.getHours() < 12
      ? 'God morgen'
      : now.getHours() < 17
        ? 'God ettermiddag'
        : 'God kveld';

  const dateLabel = now.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const [conversationResult, referralResult, statsResult] =
        await Promise.all([
          supabase
            .from('conversations')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(20),

          supabase
            .from('patient_referrals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10),

          supabase
            .from('dashboard_stats')
            .select('*')
            .order('stat_date', { ascending: true })
            .limit(14),
        ]);

      if (conversationResult.data) {
        setConversations(conversationResult.data);
      }

      if (referralResult.data) {
        setReferrals(referralResult.data);
      }

      if (statsResult.data) {
        setStats(statsResult.data);
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  const todayChats =
    stats[stats.length - 1]?.total_chats ??
    conversations.filter(
      (conversation) =>
        new Date(conversation.started_at).toDateString() ===
        now.toDateString(),
    ).length;

  const activeChats = conversations.filter(
    (conversation) => conversation.status === 'active',
  ).length;

  const totalReferrals = referrals.length;

  const confirmedReferrals = referrals.filter(
    (referral) => referral.status === 'confirmed',
  ).length;

  const latestRating = stats[stats.length - 1]?.avg_rating ?? 4.9;

  const calendarDays = [
    { day: 'Man', date: '4', appointments: 2 },
    { day: 'Tir', date: '5', appointments: 4 },
    { day: 'Ons', date: '6', appointments: 3, active: true },
    { day: 'Tor', date: '7', appointments: 5 },
    { day: 'Fre', date: '8', appointments: 2 },
  ];

  return (
    <div className="min-h-screen bg-[#f3f7fb]">
      {/* Top navigation */}
      <header className="sticky top-0 z-20 border-b border-[#e3ebf2] bg-white/95 px-6 py-4 backdrop-blur-xl lg:px-8">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium capitalize text-[#8a9bad]">
              {dateLabel}
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#10233f]">
              {greeting}, Nora 👋
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#91a2b3]"
              />

              <input
                type="search"
                placeholder="Søk etter pasienter..."
                className="w-64 rounded-2xl border border-[#e0e8ef] bg-[#f8fafc] py-2.5 pl-11 pr-4 text-sm text-[#10233f] outline-none transition focus:border-[#14c8d4] focus:bg-white"
              />
            </div>

            <button
              type="button"
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e0e8ef] bg-white text-[#667d91] transition hover:bg-[#f4f8fb]"
            >
              <Bell size={18} />

              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-3 rounded-2xl border border-[#e0e8ef] bg-white px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#14c8d4] to-[#0d1e3d]">
                <span className="text-xs font-black text-white">NB</span>
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-sm font-bold text-[#10233f]">Nora Berg</p>
                <p className="text-xs text-[#8a9bad]">Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-6 p-5 sm:p-6 lg:p-8">
        {/* Welcome and primary action */}
        <section className="flex flex-col gap-5 rounded-[28px] border border-[#dce8f1] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf9fb] px-3 py-1.5 text-xs font-bold text-[#1096a1]">
              <Sparkles size={14} />
              Pia er aktiv
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-[#10233f]">
              Her er dagens klinikkoversikt
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e8396]">
              Følg opp samtaler, pasienthenvisninger og bookinger fra ett sted.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14c8d4] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#14c8d4]/20 transition hover:-translate-y-0.5 hover:bg-[#0fb3be]"
          >
            <Plus size={18} />
            Ny pasient
          </button>
        </section>

        {/* Statistics */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Samtaler i dag"
            value={todayChats}
            subtitle={`${activeChats} aktive akkurat nå`}
            icon={MessageSquare}
            trend={{
              value: '+12% fra i går',
              positive: true,
            }}
            color="teal"
          />

          <StatsCard
            title="Nye pasienter"
            value={conversations.length}
            subtitle="Denne uken"
            icon={Users}
            trend={{
              value: '+5 fra forrige uke',
              positive: true,
            }}
            color="navy"
          />

          <StatsCard
            title="Henvisninger"
            value={totalReferrals}
            subtitle={`${confirmedReferrals} bekreftet`}
            icon={Stethoscope}
            trend={{
              value: '+3 i dag',
              positive: true,
            }}
            color="green"
          />

          <StatsCard
            title="AI-vurdering"
            value={latestRating.toFixed(1)}
            subtitle="Basert på de siste svarene"
            icon={Star}
            trend={{
              value: '+0.2 denne uken',
              positive: true,
            }}
            color="amber"
          />
        </section>

        {/* Calendar and conversations */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.85fr]">
          {/* Calendar */}
          <div className="rounded-[26px] border border-[#e0e8ef] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#10233f]">
                  Ukens kalender
                </p>

                <p className="mt-1 text-xs text-[#8a9bad]">
                  Kommende avtaler
                </p>
              </div>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f8fb] text-[#6b8194] transition hover:bg-[#eaf2f7]"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2">
              {calendarDays.map((item) => (
                <button
                  type="button"
                  key={item.date}
                  className={`rounded-2xl px-2 py-4 text-center transition ${
                    item.active
                      ? 'bg-[#14c8d4] text-white shadow-lg shadow-[#14c8d4]/20'
                      : 'bg-[#f7fafc] text-[#10233f] hover:bg-[#edf4f8]'
                  }`}
                >
                  <p
                    className={`text-[11px] font-bold uppercase ${
                      item.active ? 'text-white/75' : 'text-[#91a2b3]'
                    }`}
                  >
                    {item.day}
                  </p>

                  <p className="mt-1 text-lg font-black">{item.date}</p>

                  <p
                    className={`mt-2 text-[10px] font-bold ${
                      item.active ? 'text-white/80' : 'text-[#14a6b2]'
                    }`}
                  >
                    {item.appointments} avtaler
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {[
                {
                  time: '09:00',
                  patient: 'Emma Larsen',
                  treatment: 'Kontroll',
                },
                {
                  time: '11:30',
                  patient: 'Jonas Hansen',
                  treatment: 'Tannpine',
                },
                {
                  time: '14:00',
                  patient: 'Sara Nilsen',
                  treatment: 'Konsultasjon',
                },
              ].map((appointment) => (
                <div
                  key={`${appointment.time}-${appointment.patient}`}
                  className="flex items-center gap-4 rounded-2xl border border-[#e8eef3] bg-[#fbfdfe] p-3.5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f9fb] text-[#12a5b0]">
                    <Clock3 size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#10233f]">
                      {appointment.patient}
                    </p>

                    <p className="mt-0.5 text-xs text-[#8a9bad]">
                      {appointment.treatment}
                    </p>
                  </div>

                  <span className="text-xs font-black text-[#587085]">
                    {appointment.time}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#dce8ef] bg-white px-4 py-3 text-sm font-bold text-[#557084] transition hover:bg-[#f7fafc]"
            >
              <CalendarDays size={17} />
              Åpne kalender
            </button>
          </div>

          {/* Latest conversations */}
          <div className="overflow-hidden rounded-[26px] border border-[#e0e8ef] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#eef2f5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f9fb] text-[#13a8b3]">
                  <MessageSquare size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-black text-[#10233f]">
                    Siste samtaler
                  </h2>

                  <p className="mt-0.5 text-xs text-[#8a9bad]">
                    Nye samtaler fra Pia
                  </p>
                </div>

                {activeChats > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
                    {activeChats} aktive
                  </span>
                )}
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#13a8b3] hover:underline"
              >
                Se alle
                <ChevronRight size={14} />
              </button>
            </div>

            {loading ? (
              <div className="flex min-h-[380px] items-center justify-center">
                <RefreshCw
                  size={23}
                  className="animate-spin text-[#14c8d4]"
                />
              </div>
            ) : (
              <div className="min-h-[380px]">
                <ConversationList
                  conversations={conversations}
                  onSelect={setSelectedConv}
                  selectedId={selectedConv?.id ?? null}
                />
              </div>
            )}
          </div>
        </section>

        {/* AI assistant and referrals */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.6fr]">
          {/* Pia */}
          <div className="overflow-hidden rounded-[26px] border border-[#e0e8ef] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#eef2f5] px-5 py-4">
              <div className="flex items-center gap-3">
                <img
                  src="/pia-avatar.png"
                  alt="Pia"
                  className="h-11 w-11 object-contain"
                />

                <div>
                  <h2 className="text-sm font-black text-[#10233f]">
                    Pia AI-assistent
                  </h2>

                  <p className="text-xs text-[#8a9bad]">
                    Hjelper klinikken akkurat nå
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>

            <div className="flex h-[420px] flex-col">
              <AIChatPreview />
            </div>
          </div>

          {/* Referrals */}
          <div className="overflow-hidden rounded-[26px] border border-[#e0e8ef] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#eef2f5] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef8ff] text-[#1689d4]">
                  <Stethoscope size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-black text-[#10233f]">
                    Pasienthenvisninger
                  </h2>

                  <p className="mt-0.5 text-xs text-[#8a9bad]">
                    Nye og aktive forespørsler
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1689d4] hover:underline"
              >
                Se alle
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <RefreshCw
                    size={23}
                    className="animate-spin text-[#14c8d4]"
                  />
                </div>
              ) : (
                <ReferralsList referrals={referrals} />
              )}
            </div>
          </div>
        </section>

        {/* Chart and report cards */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr_1fr]">
          {/* Chart */}
          <div className="rounded-[26px] border border-[#e0e8ef] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f9fb] text-[#13a8b3]">
                  <TrendingUp size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-black text-[#10233f]">
                    Bookingstatistikk
                  </h2>

                  <p className="mt-0.5 text-xs text-[#8a9bad]">
                    Utvikling de siste 14 dagene
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#667d91] transition hover:text-[#10233f]"
              >
                Full rapport
                <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-[#14c8d4]" />
                <span className="text-xs text-[#8a9bad]">Samtaler</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-5 border-t-2 border-dashed border-[#10233f]" />
                <span className="text-xs text-[#8a9bad]">Henvisninger</span>
              </div>
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <RefreshCw
                    size={23}
                    className="animate-spin text-[#14c8d4]"
                  />
                </div>
              ) : (
                <BookingChart stats={stats} />
              )}
            </div>
          </div>

          {/* Reports */}
          <div className="rounded-[26px] bg-[#10233f] p-6 text-white shadow-lg shadow-[#10233f]/10">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <CheckCircle2 size={21} className="text-[#6ce1e8]" />
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70">
                Denne måneden
              </span>
            </div>

            <p className="mt-8 text-sm font-semibold text-white/55">
              Tid spart med Pia
            </p>

            <p className="mt-2 text-4xl font-black tracking-[-0.04em]">
              18,5 timer
            </p>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Estimert tid klinikken har spart på automatisert pasientdialog
              og oppfølging.
            </p>

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                <span className="text-sm text-white/65">
                  Samtaler håndtert
                </span>

                <span className="font-black">146</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                <span className="text-sm text-white/65">
                  Pasienter fulgt opp
                </span>

                <span className="font-black">{totalReferrals}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                <span className="text-sm text-white/65">
                  Bekreftede henvisninger
                </span>

                <span className="font-black">{confirmedReferrals}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}