import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { showToast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n"
import { platform } from "@/lib/api"

const FIELDS = [
  { key: "site_name", label: "platform.siteName", placeholder: "Keygate" },
  { key: "logo_url", label: "platform.logoUrl", placeholder: "/logo.svg" },
  { key: "brand_color", label: "platform.brandColor", placeholder: "#2563eb" },
  { key: "timezone", label: "platform.timezone", placeholder: "UTC" },
  { key: "language", label: "platform.language", placeholder: "en" },
] as const

export default function PlatformSettingsPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: platform.getSettings,
  })

  // Seed the form once the server answers; later refetches must not
  // overwrite edits in progress.
  useEffect(() => {
    if (data?.settings) {
      setForm((prev) => ({ ...data.settings, ...prev }))
    }
  }, [data])

  const mut = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {}
      for (const f of FIELDS) body[f.key] = form[f.key] ?? ""
      return platform.updateSettings(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "settings"] })
      showToast(t("platform.settingsSaved"), "success")
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("platform.settingsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("platform.settingsSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("platform.overview")}</CardTitle>
          <CardDescription>{t("platform.settingsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>{t(f.label)}</Label>
                  <Input
                    value={form[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => mut.mutate()} disabled={isLoading || mut.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
