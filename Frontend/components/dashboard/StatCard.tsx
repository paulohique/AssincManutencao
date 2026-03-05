type Props = {
  title: string;
  value: string;
  subtitle?: string;
};

export function StatCard({ title, value, subtitle }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-extrabold text-gray-900">{value}</p>
      </div>
      {subtitle ? (
        <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      ) : null}
    </div>
  );
}
