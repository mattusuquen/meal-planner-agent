"use client";

interface Tab<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface TabSwitcherProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "pill" | "underline";
  fullWidth?: boolean;
  scrollable?: boolean;
  className?: string;
}

export default function TabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
  variant = "pill",
  fullWidth = false,
  scrollable = false,
  className = "",
}: TabSwitcherProps<T>) {
  if (variant === "underline") {
    return (
      <div className={`flex gap-0.5 ${scrollable ? "overflow-x-auto" : ""} ${className}`}>
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              value === t.value
                ? "bg-brand-50 text-brand-700 border-brand-600"
                : "text-gray-500 hover:text-gray-700 border-transparent hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex gap-1 bg-gray-100 p-1 rounded-xl ${scrollable ? "overflow-x-auto" : "w-fit"} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`${fullWidth ? "flex-1" : ""} px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            value === t.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
