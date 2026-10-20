import { useSearchParams } from 'react-router-dom';

const STEPS = [
  { id: 'jour', label: 'Journée' },
  { id: 'encaisser', label: 'Encaissement' },
  { id: 'factures', label: 'Facture' },
];

export default function CashierNav() {
  const [params, setParams] = useSearchParams();
  const current = params.get('section') || 'jour';

  const go = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'jour') next.delete('section');
    else next.set('section', id);
    setParams(next);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {STEPS.map((step) => {
        const on = current === step.id;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => go(step.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 ${
              on
                ? 'bg-accent border-accent text-ink'
                : 'bg-white border-primary/30 text-ink'
            }`}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
