import {
  BarChart3,
  Blocks,
  Building2,
  ChevronDown,
  FileKey2,
  Key,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  Rocket,
  ScrollText,
  Settings,
  User,
  Users,
} from "lucide-react"
import { useState } from "react"
import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { ErrorBoundary } from "@/components/error-boundary"
import { ServiceUnavailableScreen } from "@/components/service-unavailable"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/hooks/use-auth"
import { useSiteConfig } from "@/hooks/use-site-config"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"

export function AdminLayout() {
  const { user, loading, unavailable, logout, refetch } = useAuth()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { t } = useI18n()
  const [navOpen, setNavOpen] = useState(false)

  type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> }
  type NavGroup = { label: string; items: NavItem[] }

  const adminNav: (NavItem | NavGroup)[] = [
    { to: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard },
    {
      label: t("nav.catalog"),
      items: [
        { to: "/admin/products", label: t("nav.products"), icon: Package },
        { to: "/admin/plans", label: t("nav.plans"), icon: Layers },
        { to: "/admin/addons", label: t("nav.addons"), icon: Blocks },
        { to: "/admin/releases", label: t("nav.releases"), icon: Rocket },
      ],
    },
    {
      label: t("nav.licensing"),
      items: [
        { to: "/admin/licenses", label: t("nav.licenses"), icon: Key },
        { to: "/admin/customers", label: t("nav.customers"), icon: Users },
      ],
    },
    {
      label: t("nav.developer"),
      items: [
        { to: "/admin/api-keys", label: t("nav.apiKeys"), icon: FileKey2 },
        { to: "/admin/webhooks", label: t("nav.webhooks"), icon: Link2 },
      ],
    },
    {
      label: t("nav.insights"),
      items: [
        { to: "/admin/analytics", label: t("nav.analytics"), icon: BarChart3 },
        { to: "/admin/audit", label: t("nav.audit"), icon: ScrollText },
      ],
    },
  ]
  const location = useLocation()

  // Which nav entry the current URL belongs to. Same rule the sidebar
  // highlights with, so the two can never disagree about where you
  // are.
  const isActive = (to: string) => (to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(to))

  if (loading) return <LoadingScreen />
  // Out of reach is not signed out: retry, don't send them to login.
  if (!user && unavailable) return <ServiceUnavailableScreen onRetry={refetch} />
  if (!user) return <Navigate to="/login" replace />
  // The admin area belongs to a workspace. On the tenant-less platform
  // host there is nothing here to administer.
  if (user.is_platform) return <Navigate to={user.is_platform_admin ? "/platform" : "/spaces"} replace />
  if (!user.is_admin) return <Navigate to="/portal" replace />

  // Settings sits below the groups rather than in one, so it is built
  // here and rendered on its own further down.
  const settingsItem: NavItem = { to: "/admin/settings", label: t("nav.settings"), icon: Settings }

  // Which section the narrow-screen bar names. The label comes from
  // the nav list rather than being written out again, so a renamed
  // section renames here too. Longest path first: /admin matches
  // everything, so it has to lose to /admin/licenses when both fit.
  const currentPage = [...adminNav.flatMap((e) => ("to" in e ? [e] : e.items)), settingsItem]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => isActive(i.to))

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.to)
    return (
      // Tapping a link inside the drawer navigates and closes it; on
      // a wide screen there is no drawer and the state is inert.
      <Link key={item.to} to={item.to} onClick={() => setNavOpen(false)}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
            active
              ? "bg-muted font-semibold text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.icon className="h-[18px] w-[18px]" />
          {item.label}
        </div>
      </Link>
    )
  }

  // The sidebar's contents are built once and mounted twice: as the
  // permanent column on a wide screen, and inside the drawer on a
  // narrow one. Two copies of this markup would drift apart the first
  // time a nav entry was added to one of them.
  const sidebar = (
    <>
      {/* pr-11 below md leaves room for the drawer's close button,
        which sits at the panel's top right. The permanent sidebar is
        hidden below md, so the wider padding only ever applies inside
        the drawer. */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4 pr-11 md:pr-4">
        <img src={logo_url || "/logo.svg"} alt={site_name} className="h-7 w-7" />
        <span className="truncate text-[15px] font-semibold tracking-tight">{site_name}</span>
        <span className="ml-auto shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Admin
        </span>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {adminNav.map((entry, idx) => {
          if ("to" in entry) return renderNavItem(entry)
          const group = entry as NavGroup
          return (
            <div key={group.label} className={cn(idx > 0 && "mt-4")}>
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">
                {group.label}
              </div>
              {group.items.map(renderNavItem)}
            </div>
          )
        })}
      </nav>
      {/* Settings — fixed at bottom above user menu */}
      <div className="px-2">{renderNavItem(settingsItem)}</div>
      <Separator />
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-sm">{user.name || user.email}</span>
              <ChevronDown className="h-4 w-4 ml-auto opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs text-muted-foreground">{user.email}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/portal">{t("nav.portal")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Attribution required by AGPL v3 Section 7(b) — see NOTICE */}
      <div className="px-4 py-2 border-t text-center">
        <a
          href={attribution_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {attribution_text}
        </a>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — a column of its own from md up, and the contents of
        the drawer below it. 240px of a 390px phone is not a sidebar,
        it is the whole screen. */}
      <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">{sidebar}</aside>

      {/* min-w-0 is what lets a wide table scroll inside this column
        instead of stretching it: a flex child's default min-width is
        its content, so without it the page grows to the width of the
        table and the whole layout scrolls sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 md:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              {/* 44px square: the size a finger needs. The icon inside
                stays 20px, so only the hit area grows. */}
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" label={t("nav.menu")}>
              {sidebar}
            </SheetContent>
          </Sheet>
          {/* The mark carries the brand and the words carry the
            location. Spelling the site name out here as well would
            just repeat what the drawer says two taps away, on the one
            screen with no room to spare. */}
          {/* The link carries the accessible name, so the image inside
            it is decorative and must not announce the same thing
            again. */}
          <Link to="/admin" className="shrink-0" aria-label={site_name}>
            <img src={logo_url || "/logo.svg"} alt="" className="h-6 w-6" />
          </Link>
          <span className="min-w-0 flex-1 truncate font-semibold tracking-tight">
            {currentPage?.label ?? site_name}
          </span>
        </header>

        <header className="hidden h-14 shrink-0 items-center gap-2 border-b bg-card px-6 md:flex">
          <span className="text-[13px] text-subtle-foreground">{site_name}</span>
          <span className="text-border">/</span>
          <span className="text-[13px] font-semibold">{currentPage?.label ?? site_name}</span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        {/* Attribution required by AGPL v3 Section 7(b) — see NOTICE.
          The sidebar carries it on a wide screen, but the sidebar is
          hidden below md and its copy inside the drawer is only on
          screen while the drawer is open. This bar is the narrow
          screen's permanent surface for it: outside <main>, so it
          does not scroll away, and shown only where the sidebar is
          not. */}
        <div className="shrink-0 border-t bg-card px-4 py-1.5 text-center md:hidden">
          <a
            href={attribution_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {attribution_text}
          </a>
        </div>
      </div>
    </div>
  )
}

export function PortalLayout() {
  const { user, loading, unavailable, logout, refetch } = useAuth()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { t } = useI18n()

  const portalNav = [
    { to: "/portal", label: t("nav.licenses"), icon: Key },
    { to: "/portal/account", label: t("nav.settings"), icon: User },
  ]
  const location = useLocation()

  if (loading) return <LoadingScreen />
  // Out of reach is not signed out: retry, don't send them to login.
  if (!user && unavailable) return <ServiceUnavailableScreen onRetry={refetch} />
  if (!user) return <Navigate to="/login" replace />
  // The portal is a workspace's page; the platform host serves the
  // workspace picker instead.
  if (user.is_platform) return <Navigate to={user.is_platform_admin ? "/platform" : "/spaces"} replace />

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/portal" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <img src={logo_url || "/logo.svg"} alt={site_name} className="h-6 w-6" />
            {site_name}
          </Link>
          <div className="flex items-center gap-4">
            {user.is_admin && (
              <Link to="/admin">
                <Button variant="outline" size="sm">
                  Admin Panel
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  {user.name || user.email}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground">{user.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Portal navigation */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {portalNav.map((item) => {
              const active =
                item.to === "/portal" ? location.pathname === "/portal" : location.pathname.startsWith(item.to)
              return (
                <Link key={item.to} to={item.to}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      {/* Attribution required by AGPL v3 Section 7(b) — see NOTICE */}
      <footer className="border-t py-3 text-center">
        <a
          href={attribution_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {attribution_text}
        </a>
      </footer>
    </div>
  )
}

// PlatformLayout is the console that manages workspaces. It exists only
// on PLATFORM_HOST and only for platform admins; the API refuses the
// same routes everywhere else, so the guard here is about sending
// people to a page they can actually use rather than about security.
export function PlatformLayout() {
  const { user, loading, unavailable, logout, refetch } = useAuth()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { t } = useI18n()
  const location = useLocation()

  const nav = [
    { to: "/platform", label: t("platform.navTenants"), icon: Building2 },
    { to: "/spaces", label: t("platform.navSpaces"), icon: Layers },
    { to: "/platform/settings", label: t("platform.navSettings"), icon: Settings },
  ]
  const isActive = (to: string) =>
    to === "/platform" ? location.pathname === "/platform" : location.pathname.startsWith(to)

  if (loading) return <LoadingScreen />
  if (!user && unavailable) return <ServiceUnavailableScreen onRetry={refetch} />
  if (!user) return <Navigate to="/login" replace />
  // Not a platform admin: the console is not theirs. A tenant host
  // serves the workspace UI; the bare platform host serves the space
  // picker for accounts that do belong to workspaces.
  if (!user.is_platform_admin) {
    return <Navigate to={user.is_platform ? "/spaces" : "/portal"} replace />
  }
  if (!user.is_platform) return <Navigate to="/portal" replace />

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/platform" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <img src={logo_url || "/logo.svg"} alt="" className="h-6 w-6" />
            <span className="max-w-40 truncate">{site_name}</span>
          </Link>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            {t("platform.badge")}
          </span>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link key={item.to} to={item.to}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.to)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden max-w-40 truncate sm:inline">{user.name || user.email}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground">{user.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/spaces">{t("platform.navSpaces")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Narrow screens keep the nav, since the drawer would cost
            more than it saves on a console with three destinations. */}
        <div className="mx-auto max-w-6xl overflow-x-auto px-2 md:hidden">
          <nav className="flex gap-1">
            {nav.map((item) => (
              <Link key={item.to} to={item.to}>
                <div
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.to)
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t py-3 text-center">
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

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )
}
