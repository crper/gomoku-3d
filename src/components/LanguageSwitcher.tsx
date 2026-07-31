import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { play } from "@/lib/audio/sfx";

/** Compact zh/en toggle. Persists to localStorage via i18next language detector. */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language ?? "zh").startsWith("zh");

  const toggle = () => {
    i18n.changeLanguage(isZh ? "en" : "zh");
    play("ui_click");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className="gap-1.5 px-2.5"
      aria-label={t("lang.switch")}
      title={t("lang.switch")}
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold">{isZh ? "EN" : "中"}</span>
    </Button>
  );
}
