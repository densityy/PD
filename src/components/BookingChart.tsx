import { useState } from 'react';
import type { DashboardStat } from '@/lib/supabase';

interface BookingChartProps {
  stats: DashboardStat[];
}

export default function BookingChart({ stats }: BookingChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const sorted = [...stats].sort(
    (a, b) => new Date(a.stat_date).getTime() - new Date(b.stat_date).getTime()
  );

  const values = sorted.map((s) => s.total_chats);
  const referralValues = sorted.map((s) => s.referrals_made);
  const maxVal = Math.max(...values, ...referralValues, 1);

  const W = 600;
  const H = 120;
  const pad = { top: 10, right: 10, bottom: 24, left: 28 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const xStep = chartW / Math.max(sorted.length - 1, 1);

  const toPoint = (idx: number, val: number) => ({
    x: pad.left + idx * xStep,
    y: pad.top + chartH - (val / maxVal) * chartH,
  });

  const buildPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const { x, y } = toPoint(i, v);
        if (i === 0) return `M ${x} ${y}`;
        const prev = toPoint(i - 1, vals[i - 1]);
        const cpx = (prev.x + x) / 2;
        return `C ${cpx} ${prev.y}, ${cpx} ${y}, ${x} ${y}`;
      })
      .join(' ');

  const buildArea = (vals: number[]) => {
    const line = buildPath(vals);
    const lastPt = toPoint(vals.length - 1, vals[vals.length - 1]);
    const firstPt = toPoint(0, vals[0]);
    return `${line} L ${lastPt.x} ${pad.top + chartH} L ${firstPt.x} ${pad.top + chartH} Z`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  };

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14c8d4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#14c8d4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d1e3d" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0d1e3d" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid lines */}
        {yTicks.map((tick) => {
          const y = pad.top + chartH - (tick / maxVal) * chartH;
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
              <text x={pad.left - 5} y={y + 4} textAnchor="end" fontSize="8" fill="#aaa">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area fills */}
        <path d={buildArea(values)} fill="url(#tealGrad)" />
        <path d={buildArea(referralValues)} fill="url(#navyGrad)" />

        {/* Lines */}
        <path d={buildPath(values)} fill="none" stroke="#14c8d4" strokeWidth="2.5" strokeLinecap="round" />
        <path d={buildPath(referralValues)} fill="none" stroke="#0d1e3d" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />

        {/* X axis labels — every 3rd */}
        {sorted.map((s, i) => {
          if (i % 3 !== 0) return null;
          const { x } = toPoint(i, 0);
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="#aaa">
              {formatDate(s.stat_date)}
            </text>
          );
        })}

        {/* Hover areas + dots */}
        {sorted.map((s, i) => {
          const pt = toPoint(i, values[i]);
          const rpt = toPoint(i, referralValues[i]);
          const isHov = hovered === i;
          return (
            <g key={i}>
              <rect
                x={pad.left + i * xStep - xStep / 2}
                y={pad.top}
                width={xStep}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
              {isHov && (
                <line
                  x1={pt.x}
                  y1={pad.top}
                  x2={pt.x}
                  y2={pad.top + chartH}
                  stroke="#14c8d4"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity="0.4"
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHov ? 5 : 3}
                fill={isHov ? '#14c8d4' : 'white'}
                stroke="#14c8d4"
                strokeWidth="2"
                style={{ transition: 'r 0.1s' }}
              />
              <circle
                cx={rpt.x}
                cy={rpt.y}
                r={isHov ? 4 : 2.5}
                fill={isHov ? '#0d1e3d' : 'white'}
                stroke="#0d1e3d"
                strokeWidth="2"
                style={{ transition: 'r 0.1s' }}
              />
              {isHov && (
                <g>
                  <rect
                    x={pt.x - 36}
                    y={pt.y - 34}
                    width={72}
                    height={28}
                    rx="5"
                    fill="#0d1e3d"
                    opacity="0.92"
                  />
                  <text x={pt.x} y={pt.y - 21} textAnchor="middle" fontSize="8" fill="#14c8d4" fontWeight="600">
                    {formatDate(s.stat_date)}
                  </text>
                  <text x={pt.x} y={pt.y - 11} textAnchor="middle" fontSize="7.5" fill="white">
                    Chats: {values[i]}  |  Ref: {referralValues[i]}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
