export default function OfferCardSkeleton() {
  return (
    <div className="card space-y-3" aria-hidden="true">
      <div className="flex items-start justify-between gap-2">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-5 w-14" />
      </div>
      <div className="skeleton h-8 w-3/4" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-11 w-full" />
    </div>
  );
}