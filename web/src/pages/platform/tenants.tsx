import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { showToast } from "@/components/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n"
import { errorCode, platform } from "@/lib/api"

export default function PlatformTenantsPage() {
  const { t, locale } = useI18n()
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "tenants"],
    queryFn: platform.listTenants,
  })
  const tenants = data?.tenants ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("platform.tenantsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("platform.tenantsSubtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("platform.newTenant")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>{t("platform.name")}</DataTableHead>
                  <DataTableHead>{t("platform.slug")}</DataTableHead>
                  <DataTableHead>{t("platform.status")}</DataTableHead>
                  <DataTableHead className="text-right">{t("platform.members")}</DataTableHead>
                  <DataTableHead className="text-right">{t("platform.licenses")}</DataTableHead>
                  <DataTableHead>{t("platform.created")}</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {tenants.length === 0 ? (
                  <DataTableEmpty colSpan={6} message={t("platform.empty")} />
                ) : (
                  tenants.map((tenant) => (
                    <DataTableRow key={tenant.id}>
                      <DataTableCell className="font-medium">
                        <Link to={`/platform/tenants/${tenant.id}`} className="hover:underline">
                          {tenant.name}
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs">{tenant.slug}</DataTableCell>
                      <DataTableCell>
                        <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                          {t(tenant.status === "active" ? "platform.active" : "platform.suspended")}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums">{tenant.member_count}</DataTableCell>
                      <DataTableCell className="text-right tabular-nums">{tenant.license_count}</DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {new Date(tenant.created_at).toLocaleDateString(locale)}
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>

      {creating && <CreateTenantDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateTenantDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      platform.createTenant({
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        owner_email: ownerEmail.trim().toLowerCase(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "tenants"] })
      showToast(t("platform.createdToast"), "success")
      onClose()
    },
    onError: (e: Error) => showToast(errorCode(e) === "TENANT_EXISTS" ? t("platform.slugTaken") : e.message, "error"),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("platform.createTitle")}</DialogTitle>
          <DialogDescription>{t("platform.createDesc")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label>{t("platform.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." required />
            </div>
            <div className="space-y-2">
              <Label>{t("platform.slug")}</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="acme"
                pattern="[a-z0-9-]{2,32}"
                required
              />
              <p className="text-xs text-muted-foreground">{t("platform.slugHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("platform.ownerEmail")}</Label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@acme.com"
                required
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || !slug.trim() || !ownerEmail.trim() || mut.isPending}>
              {t("platform.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
