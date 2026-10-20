import { motion } from "framer-motion";
import { PageHeader } from "../components/ui/PageHeader";
import { JobsListCard } from "../components/Pickup/JobsListCard";
import { useTranslation } from "../hooks/useTranslation";

export default function MyPickupsPage() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <PageHeader title={t("my_jobs")} />
      <JobsListCard mode="collector" />
    </motion.div>
  );
}
