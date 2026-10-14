import { Scale, Tag, Wallet } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  convertCurrency,
  humanizeHazard,
  kgToUnit,
  money,
  slugForMaterial,
  unitRate,
  unitToKg,
} from "../../lib/bentoPricing";
import type { Currency, WeightUnit } from "../../types/bento";

interface ValuationCardProps {
  materialClass?: string;
  materialSlug?: string;
  subGrade?: string;
  confidence?: number;
  hazards: string[];
  weightKg: number;
  onWeightKg: (kg: number) => void;
  unit: WeightUnit;
  onUnit: (unit: WeightUnit) => void;
  currency: Currency;
  onCurrency: (currency: Currency) => void;
  priceNgnPerKg: number;
}

const GRADE_LABELS: Record<string, string> = {
  copper: "Clean Bright Copper",
  steel: "Heavy Melting Steel · Grade 1",
  aluminum: "Mixed Aluminium",
  brass: "Yellow Brass",
  "pet-plastic": "High-Density PET",
  "e-waste": "Mixed PCB Board",
  "lead-battery": "Lead-Acid (UN 2794)",
  glass: "Mixed Cullet",
  other: "Unclassified",
};

export function ValuationCard({
  materialClass,
  materialSlug,
  subGrade,
  confidence,
  hazards,
  weightKg,
  onWeightKg,
  unit,
  onUnit,
  currency,
  onCurrency,
  priceNgnPerKg,
}: ValuationCardProps) {
  const slug = materialSlug ?? (materialClass ? slugForMaterial(materialClass) : "other");
  const displayWeight = kgToUnit(weightKg, unit);
  const rate = unitRate(priceNgnPerKg, unit, currency);
  const total = convertCurrency(weightKg * priceNgnPerKg, currency);
  const grade = GRADE_LABELS[slug] ?? "Unclassified";

  const sliderMin = unit === "kg" ? 0.5 : 1;
  const sliderMax = unit === "kg" ? 120 : 265;
  const sliderStep = unit === "kg" ? 0.5 : 1;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Headline value */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-eco-emerald/15 via-transparent to-eco-cyan/10 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Wallet className="h-3.5 w-3.5" /> Estimated value
            </p>
            <p className="mt-1 truncate text-3xl font-extrabold tracking-tight text-white text-shadow-eco">
              ≈ {money(total, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {materialClass ?? "Awaiting scan"}
              {confidence != null && (
                <span className="text-eco-emerald-glow"> · {(confidence * 100).toFixed(1)}%</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Currency + unit toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Currency"
          options={[
            { value: "NGN", label: "₦ NGN" },
            { value: "USD", label: "$ USD" },
          ]}
          value={currency}
          onChange={(value) => onCurrency(value as Currency)}
        />
        <Segmented
          label="Weight unit"
          options={[
            { value: "kg", label: "kg" },
            { value: "lb", label: "lbs" },
          ]}
          value={unit}
          onChange={(value) => onUnit(value as WeightUnit)}
        />
      </div>

      {/* Weight slider + rate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Scale className="h-3.5 w-3.5" /> Net weight
          </span>
          <span className="font-mono font-semibold text-slate-100">
            {displayWeight.toFixed(1)} {unit}
          </span>
        </div>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={Number(displayWeight.toFixed(1))}
          onChange={(event) => onWeightKg(unitToKg(Number(event.target.value), unit))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-eco-emerald"
          aria-label="Estimated net weight"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Market rate</span>
          <span className="font-mono font-semibold text-eco-lime-glow">
            ≈ {money(rate, currency)}/{unit}
          </span>
        </div>
      </div>

      {/* Grade + hazard tags */}
      <div className="mt-auto flex flex-wrap gap-1.5">
        <span className="eco-chip border-eco-emerald/25 bg-eco-emerald/10 text-eco-emerald-glow">
          <Tag className="h-3 w-3" /> {grade}
        </span>
        {subGrade && (
          <span className="eco-chip border-white/10 bg-white/5 text-slate-300">{subGrade}</span>
        )}
        {hazards.map((hazard) => (
          <span
            key={hazard}
            className="eco-chip border-eco-amber/25 bg-eco-amber/10 text-eco-amber-glow"
          >
            ⚠ {humanizeHazard(hazard)}
          </span>
        ))}
      </div>
    </div>
  );
}

interface SegmentedProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}

function Segmented({ label, options, value, onChange }: SegmentedProps) {
  return (
    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "tap-target rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === option.value
              ? "bg-eco-emerald text-obsidian-950"
              : "text-slate-300 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
