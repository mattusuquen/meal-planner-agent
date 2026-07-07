import PillBadge from "../ui/PillBadge";
import MacroDisplay from "../ui/MacroDisplay";

interface FoodEntryRowProps {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  slot?: string;
  slotColors?: Record<string, string>;
  time?: string;
  method?: string;
  methodBadge?: Record<string, { label: string; className: string }>;
  servings?: number;
  photoUrl?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function FoodEntryRow({
  name,
  calories,
  protein,
  carbs,
  fat,
  slot,
  slotColors,
  time,
  method,
  methodBadge,
  servings,
  photoUrl,
  onEdit,
  onDelete,
}: FoodEntryRowProps) {
  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      )}
      {slot && slotColors && (
        <PillBadge
          label={slot}
          className={slotColors[slot] ?? "bg-gray-100 text-gray-600"}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          {servings !== undefined && servings !== 1 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">×{servings}</span>
          )}
          {method && methodBadge && methodBadge[method] && (
            <PillBadge label={methodBadge[method].label} className={methodBadge[method].className} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{calories} kcal</span>
          <MacroDisplay protein={protein} carbs={carbs} fat={fat} />
        </div>
      </div>
      {time && <span className="text-xs text-gray-400 flex-shrink-0 self-center">{time}</span>}
      <div className="flex gap-1 flex-shrink-0 self-center">
        {onEdit && (
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
