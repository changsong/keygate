import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ExternalLink, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { showToast } from "@/components/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { useI18n } from "@/i18n"
import { type PlatformMember, platform, type TenantRole } from "@/lib/api"

export default function PlatformTenantDetailPage() {
  const { id = "" } = useParams()
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [renaming, setRenaming] = useState(false)

  const tenantQuery = useQuery({
    queryKey: ["platform", "tenant", id],
    queryFn: () => platform.getTenant(id),
    enabled: !!id,
  })
  const membersQuery = useQuery({
    queryKey: ["platform", "tenant", id, "members"],
    queryFn: () => platform.listMembers(id),
    enabled: !!id,
  })

  const statusMut = useMutation({
    mutationFn: (status: "active" | "suspended") => platform.updateTenant(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "tenant", id] })
      qc.invalidateQueries({ queryKey: ["platform", "tenants"] })
      showToast(t("platform.statusChanged"), "success")
    },
  })

  if (tenantQuery.isLoading) return <div className="h-48 animate-pulse rounded-lg bg-muted" />
  if (tenantQuery.isError || !tenantQuery.data) {
    return (
      <div className="space-y-4">
        <Link
          to="/platform"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("platform.backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{tenantQuery.error?.message}</p>
      </div>
    )
  }

  const { tenant, base_url } = tenantQuery.data
  const suspended = tenant.status === "suspended"
  const members = membersQuery.data?.members ?? []

  return (
    <div className="space-y-6">
      <Link
        to="/platform"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("platform.backToList")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <Badge variant={suspended ? "secondary" : "default"}>
              {t(suspended ? "platform.suspended" : "platform.active")}
            </Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{tenant.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={base_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("platform.open")}
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
            {t("platform.rename")}
          </Button>
          {suspended ? (
            <Button size="sm" onClick={() => statusMut.mutate("active")} disabled={statusMut.isPending}>
              {t("platform.activate")}
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  {t("platform.suspend")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("platform.suspendTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("platform.suspendDesc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="mt-4 flex justify-end gap-2">
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => statusMut.mutate("suspended")}>
                    {t("platform.suspend")}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("platform.members")}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{tenantQuery.data.member_count}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("platform.licenses")}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{tenantQuery.data.license_count}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("platform.created")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">{new Date(tenant.created_at).toLocaleDateString(locale)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            {t("platform.membersTitle")}
          </CardTitle>
          <CardDescription>{t("platform.membersSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {membersQuery.isLoading ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>{t("platform.name")}</DataTableHead>
                  <DataTableHead>{t("platform.role")}</DataTableHead>
                  <DataTableHead className="w-12" />
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {members.length === 0 ? (
                  <DataTableEmpty colSpan={3} />
                ) : (
                  members.map((m) => (
                    <MemberRow key={m.id || m.email} tenantId={id} member={m} isSelf={m.id === user?.id} />
                  ))
                )}
              </DataTableBody>
            </DataTable>
          )}
          <AddMemberForm tenantId={id} />
        </CardContent>
      </Card>

      {renaming && <RenameDialog tenantId={id} current={tenant.name} onClose={() => setRenaming(false)} />}
    </div>
  )
}

function MemberRow({ tenantId, member, isSelf }: { tenantId: string; member: PlatformMember; isSelf: boolean }) {
  const { t } = useI18n()
  const qc = useQueryClient()

  const roleMut = useMutation({
    mutationFn: (role: TenantRole) => platform.setMemberRole(tenantId, member.id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] })
      showToast(t("platform.roleChanged"), "success")
    },
  })
  const removeMut = useMutation({
    mutationFn: () => platform.removeMember(tenantId, member.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] })
      showToast(t("platform.memberRemoved"), "success")
    },
  })

  return (
    <DataTableRow>
      <DataTableCell>
        <div className="font-medium">{member.name || member.email}</div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
      </DataTableCell>
      <DataTableCell>
        <Select value={member.role} onValueChange={(v) => roleMut.mutate(v as TenantRole)} disabled={roleMut.isPending}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{t("platform.roleMember")}</SelectItem>
            <SelectItem value="admin">{t("platform.roleAdmin")}</SelectItem>
            <SelectItem value="owner">{t("platform.roleOwner")}</SelectItem>
          </SelectContent>
        </Select>
      </DataTableCell>
      <DataTableCell className="text-right">
        {!isSelf && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platform.removeMember")}</AlertDialogTitle>
                <AlertDialogDescription>{t("platform.removeConfirm")}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => removeMut.mutate()}>{t("common.delete")}</AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DataTableCell>
    </DataTableRow>
  )
}

function AddMemberForm({ tenantId }: { tenantId: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<TenantRole>("member")

  const mut = useMutation({
    mutationFn: () => platform.addMember(tenantId, { email: email.trim().toLowerCase(), role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] })
      showToast(t("platform.memberAdded"), "success")
      setEmail("")
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mut.mutate()
      }}
      className="flex flex-wrap items-end gap-3 border-t pt-4"
    >
      <div className="min-w-50 flex-1 space-y-2">
        <Label className="text-xs">{t("common.email")}</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          required
        />
      </div>
      <div className="w-36 shrink-0 space-y-2">
        <Label className="text-xs">{t("platform.role")}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as TenantRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{t("platform.roleMember")}</SelectItem>
            <SelectItem value="admin">{t("platform.roleAdmin")}</SelectItem>
            <SelectItem value="owner">{t("platform.roleOwner")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={!email.trim() || mut.isPending}>
        <UserPlus className="mr-2 h-4 w-4" />
        {t("platform.addMember")}
      </Button>
    </form>
  )
}

function RenameDialog({ tenantId, current, onClose }: { tenantId: string; current: string; onClose: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [name, setName] = useState(current)

  const mut = useMutation({
    mutationFn: () => platform.updateTenant(tenantId, { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform", "tenant", tenantId] })
      qc.invalidateQueries({ queryKey: ["platform", "tenants"] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("platform.renameTitle")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
          className="space-y-4"
        >
          <DialogBody className="space-y-2">
            <Label>{t("platform.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || mut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
