export const formatTooltipDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return 'N/A';
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    const [year, month] = normalized.split('-');
    const parsedMonth = new Date(Number(year), Number(month) - 1, 1);
    return parsedMonth.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  return normalized;
};

export const formatTooltipValue = (value) => {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return value.toFixed(1);
  }

  return value;
};

export const createChartTooltip = ({
  isDark,
  formatLabel = formatTooltipDate,
  formatValue = formatTooltipValue,
  title = null,
  description = null,
}) => {
  const containerClasses = isDark
    ? 'rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-lg'
    : 'rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg';
  const titleClasses = isDark ? 'text-slate-300' : 'text-gray-600';
  const valueClasses = isDark ? 'text-slate-100' : 'text-gray-900';
  const descriptionClasses = isDark ? 'text-slate-400' : 'text-gray-500';

  return ({ active, payload, label }) => {
    if (!active || !payload?.length) {
      return null;
    }

    return (
      <div className={containerClasses}>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${titleClasses}`}
        >
          {title ?? formatLabel(label)}
        </p>
        {description ? (
          <p className={`mt-1 text-xs ${descriptionClasses}`}>
            {typeof description === 'function'
              ? description(label, payload)
              : description}
          </p>
        ) : null}
        <div className="mt-2 space-y-1">
          {payload.map((entry) => (
            <div
              key={entry.dataKey}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="flex items-center gap-2">
                {entry.color ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                ) : null}
                <span className={valueClasses}>{entry.name}</span>
              </span>
              <span className={`font-semibold ${valueClasses}`}>
                {formatValue(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };
};
