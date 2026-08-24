import React from 'react';

const typeStyles = {
  fix: {
    bg: 'bg-stop-wash',
    border: 'border-stop/30',
    borderLeft: 'border-l-stop',
    text: 'text-stop',
  },
  warning: {
    bg: 'bg-amber-wash',
    border: 'border-amber/30',
    borderLeft: 'border-l-amber',
    text: 'text-amber',
  },
  ok: {
    bg: 'bg-go-wash',
    border: 'border-go/30',
    borderLeft: 'border-l-go',
    text: 'text-go',
  },
  tip: {
    bg: 'bg-go-wash',
    border: 'border-go/30',
    borderLeft: 'border-l-go',
    text: 'text-go',
  },
};

export default function RecommendationsBox({ config }) {
  return (
    <div className="bg-card border border-rule rounded-lg p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-signal mb-3">Рекомендации</p>
      <div className="flex flex-col gap-2">
        {config.recommendations.map((rec, idx) => {
          const style = typeStyles[rec.type];
          return (
            <div
              key={idx}
              className={`${style.bg} border border-l-4 ${style.border} ${style.borderLeft} rounded p-2 text-xs ${style.text} font-medium leading-snug`}
            >
              {rec.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
