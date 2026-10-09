import { useTranslation } from "../../hooks/useTranslation";
import type { PickupOffer } from "../../services/pickups";

interface Props {
  offer: PickupOffer;
  busy: boolean;
  busyId: string | null;
  distanceLabel: string;
  nairaSymbol: string;
  onAccept: () => void;
}

export default function OfferCard({ offer, busy, busyId, distanceLabel, nairaSymbol, onAccept }: Props) {
  const { t } = useTranslation();

  return (
    <article className="card space-y-3 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{offer.material_name}</p>
          {offer.created_at && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(offer.created_at).toLocaleString()}</p>
          )}
        </div>
        {distanceLabel && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {distanceLabel}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {offer.estimated_weight_kg != null && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {offer.estimated_weight_kg} kg
          </span>
        )}
        {offer.estimated_value_naira != null && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {nairaSymbol}{offer.estimated_value_naira.toLocaleString()}
          </span>
        )}
      </div>

      {offer.toxicity_hazards && offer.toxicity_hazards.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {offer.toxicity_hazards.map((h) => (
            <span
              key={h}
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            >
              ⚠ {h}
            </span>
          ))}
        </div>
      )}

      {offer.address_text && (
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{offer.address_text}</p>
      )}

      <button onClick={onAccept} disabled={busy} className="btn-primary w-full">
        {busyId === offer.pickup_id ? t("accepting") : t("accept")}
      </button>
    </article>
  );
}