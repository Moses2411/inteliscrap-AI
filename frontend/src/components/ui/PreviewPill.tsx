import { WandSparkles } from "lucide-react";
import { Badge } from "./Badge";

/** "Preview data" chip shown when dashboards render demo data. */
export function PreviewPill() {
  return (
    <Badge tone="gold">
      <WandSparkles className="h-3 w-3" />
      Preview data
    </Badge>
  );
}