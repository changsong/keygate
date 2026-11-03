import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Building2, LogOut, Settings } from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import { ServiceUnavailableScreen } from "@/components/service-unavailable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useSiteConfig } from "@/hooks/use-site-config"
import { useI18n } from "@/i18n"
import { platform } from "@/lib/api"

// SpacesPage is the platform-host landing page for a signed-in account:
// the workspaces it belongs to, each linking to that workspace's own
// subdomain. It makes no tenant-scoped call, so it works wherever the
// session cookie reaches.
export default function SpacesPage() {
  const { user, loading, unavailable, logout, refetch } = useAuth()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { t } = useI18n()

  const { data, isLoading } = useQuery({
    queryKey: ["me", "tenants"],
    queryFn: platform.myTenants,
    enabled: !!user,
  })

  if (loading) return null
  if (!user && unavailable) return <ServiceUnavailableScreen onRetry={refetch} />
  if (!user) return <Navigate to="/login" replace />

  const spaces = data?.tenants ?? []

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <img src={logo_url || "/logo.svg"} alt="" className="h-6 w-6" />
          <span className="font-bold tracking-tight">{site_name}</span>
          <div className="ml-auto flex items-center gap-2">
            {user.is_platform_admin && (
              <Link to="/platform">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  {t("spaces.console")}
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t("nav.logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("spaces.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("spaces.subtitle")}</p>
        </div>

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        ) : spaces.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">{t("spaces.empty")}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {spaces.map((space) => (
              <Card key={space.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{space.name}</span>
                    {space.status === "suspended" && <Badge variant="secondary">{t("spaces.suspended")}</Badge>}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">{space.slug}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t(
                      space.role === "owner"
                        ? "platform.roleOwner"
                        : space.role === "admin"
                          ? "platform.roleAdmin"
                          : "platform.roleMember",
                    )}
                  </span>
                  {space.status === "active" ? (
                    <a href={`${space.base_url}/portal`}>
                      <Button size="sm">
                        {t("spaces.open")}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" disabled>
                      {t("spaces.open")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="py-3 text-center">
        <a
          href={attribution_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        >
          {attribution_text}
        </a>
      </footer>
    </div>
  )
}
