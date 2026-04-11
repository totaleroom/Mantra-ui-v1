"use client"

import { useState, useEffect } from "react"
import { Smartphone, Monitor, Shield, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Home, ArrowLeftRight, CreditCard, User, Bell, QrCode } from "lucide-react"
import { OnboardingScreen } from "@/components/finance/onboarding-screen"
import { HomeScreen } from "@/components/finance/home-screen"
import { TransactionsScreen } from "@/components/finance/transactions-screen"
import { CardsScreen } from "@/components/finance/cards-screen"
import { ProfileScreen } from "@/components/finance/profile-screen"
import { DesktopHome, DesktopTransactions, DesktopCards, DesktopProfile, DesktopOnboarding } from "@/components/finance/desktop-views"

type Screen = "onboarding" | "home" | "transactions" | "cards" | "profile"
type ViewMode = "mobile" | "desktop"

const SCREEN_ORDER: Screen[] = ["onboarding", "home", "transactions", "cards", "profile"]

export function FinanceApp() {
  const [viewMode, setViewMode] = useState<ViewMode>("mobile")
  const [activeScreen, setActiveScreen] = useState<Screen>("onboarding")
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [onboardingSlide, setOnboardingSlide] = useState(0)

  const navigate = (to: Screen) => {
    if (transitioning || to === activeScreen) return
    const fromIdx = SCREEN_ORDER.indexOf(activeScreen)
    const toIdx = SCREEN_ORDER.indexOf(to)
    setDirection(toIdx >= fromIdx ? 1 : -1)
    setPrevScreen(activeScreen)
    setActiveScreen(to)
    setTransitioning(true)
  }

  useEffect(() => {
    if (!transitioning) return
    const t = setTimeout(() => {
      setPrevScreen(null)
      setTransitioning(false)
    }, 320)
    return () => clearTimeout(t)
  }, [transitioning])

  const handleNavChange = (tab: string) => {
    if (tab === "qr") return
    navigate(tab as Screen)
  }

  const outStyle: React.CSSProperties = transitioning
    ? { transform: direction === 1 ? "translateX(-100%)" : "translateX(100%)", transition: "transform 320ms cubic-bezier(0.4,0,0.2,1)" }
    : {}

  const inStyle: React.CSSProperties = transitioning
    ? { transform: "translateX(0)", transition: "transform 320ms cubic-bezier(0.4,0,0.2,1)" }
    : { transform: "translateX(0)" }

  const inInitialStyle: React.CSSProperties = {
    transform: direction === 1 ? "translateX(100%)" : "translateX(-100%)",
    transition: "none",
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-[#4a8fa8] via-[#3d7a8a] to-[#2d6070] overflow-x-hidden">
      {/* Background texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "28px 28px" }}
      />

      {/* Top Toolbar */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-5xl px-6 py-5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center">
            <span className="text-forest font-black text-xs">FF</span>
          </div>
          <span className="text-white font-bold text-sm tracking-wide">FinFlow</span>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-black/25 backdrop-blur-sm rounded-2xl p-1 gap-1">
          <button
            onClick={() => setViewMode("mobile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              viewMode === "mobile"
                ? "bg-white text-forest shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
          >
            <Smartphone size={15} />
            Mobile
          </button>
          <button
            onClick={() => setViewMode("desktop")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              viewMode === "desktop"
                ? "bg-white text-forest shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
          >
            <Monitor size={15} />
            Desktop
          </button>
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
          <span className="text-white/60 text-xs font-medium">Interactive Demo</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative z-10 w-full flex items-center justify-center px-4 pb-10">
        {viewMode === "mobile" ? (
          <MobileFrame
            activeScreen={activeScreen}
            prevScreen={prevScreen}
            transitioning={transitioning}
            direction={direction}
            onboardingSlide={onboardingSlide}
            outStyle={outStyle}
            inStyle={inStyle}
            inInitialStyle={inInitialStyle}
            handleNavChange={handleNavChange}
            setOnboardingSlide={setOnboardingSlide}
            navigate={navigate}
          />
        ) : (
          <DesktopFrame
            activeScreen={activeScreen}
            prevScreen={prevScreen}
            transitioning={transitioning}
            direction={direction}
            onboardingSlide={onboardingSlide}
            outStyle={outStyle}
            inStyle={inStyle}
            inInitialStyle={inInitialStyle}
            handleNavChange={handleNavChange}
            setOnboardingSlide={setOnboardingSlide}
            navigate={navigate}
          />
        )}
      </div>
    </div>
  )
}

// ─── Mobile Phone Frame ───────────────────────────────────────────────────────

interface FrameProps {
  activeScreen: Screen
  prevScreen: Screen | null
  transitioning: boolean
  direction: 1 | -1
  onboardingSlide: number
  outStyle: React.CSSProperties
  inStyle: React.CSSProperties
  inInitialStyle: React.CSSProperties
  handleNavChange: (tab: string) => void
  setOnboardingSlide: (n: number) => void
  navigate: (to: Screen) => void
}

function MobileFrame(props: FrameProps) {
  const { activeScreen, prevScreen, transitioning, outStyle, inStyle, inInitialStyle, handleNavChange, onboardingSlide, setOnboardingSlide, navigate } = props

  return (
    <div className="relative" style={{ width: 300, height: 620 }}>
      {/* Side buttons */}
      <div className="absolute right-[-4px] top-24 w-[3px] h-14 bg-white/20 rounded-full" />
      <div className="absolute left-[-4px] top-16 w-[3px] h-7 bg-white/20 rounded-full" />
      <div className="absolute left-[-4px] top-28 w-[3px] h-10 bg-white/20 rounded-full" />
      <div className="absolute left-[-4px] top-44 w-[3px] h-10 bg-white/20 rounded-full" />

      {/* Shell */}
      <div className="absolute inset-0 rounded-[46px] bg-[#0a0a0a]"
        style={{ boxShadow: "0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset" }}>
        {/* Bezel */}
        <div className="absolute inset-[3px] rounded-[44px] bg-white overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50" />

          {/* Screen */}
          <div className="absolute inset-0 overflow-hidden rounded-[42px] bg-cream">
            {prevScreen && transitioning && (
              <div className="absolute inset-0 z-10" style={outStyle}>
                <ScreenRenderer screen={prevScreen} activeTab={prevScreen} onNavChange={handleNavChange}
                  onboardingSlide={onboardingSlide} onSlideChange={setOnboardingSlide} onComplete={() => navigate("home")} />
              </div>
            )}
            <ActiveScreenLayer key={activeScreen} screen={activeScreen} activeTab={activeScreen}
              onNavChange={handleNavChange} onboardingSlide={onboardingSlide} onSlideChange={setOnboardingSlide}
              onComplete={() => navigate("home")} transitioning={transitioning} inInitialStyle={inInitialStyle} inStyle={inStyle} />
          </div>
          {/* Home pill */}
          <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-28 h-[4px] bg-black/15 rounded-full z-50" />
        </div>
      </div>
    </div>
  )
}

// ─── Desktop Browser Frame ────────────────────────────────────────────────────

function DesktopFrame(props: FrameProps) {
  const { activeScreen, prevScreen, transitioning, outStyle, inStyle, inInitialStyle, handleNavChange, onboardingSlide, setOnboardingSlide, navigate } = props

  const screenTitle: Record<Screen, string> = {
    onboarding: "Welcome — FinFlow",
    home: "Dashboard — FinFlow",
    transactions: "Transactions — FinFlow",
    cards: "My Cards — FinFlow",
    profile: "Profile — FinFlow",
  }

  return (
    <div className="w-full max-w-5xl">
      {/* Browser chrome */}
      <div className="rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset", background: "#1c1c1e" }}>

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8" style={{ background: "#2a2a2c" }}>
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          {/* Nav arrows */}
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
          {/* URL bar */}
          <div className="flex-1 flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 min-w-0">
            <Shield size={12} className="text-[#28c840] flex-shrink-0" />
            <span className="text-white/50 text-xs truncate flex-1">app.finflow.io/{activeScreen === "onboarding" ? "" : activeScreen}</span>
          </div>
          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <RefreshCw size={13} />
            </button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <Search size={13} />
            </button>
          </div>
          {/* Tab strip */}
          <div className="flex-shrink-0 flex items-center bg-black/20 rounded-lg px-3 py-1.5 gap-1.5 max-w-[200px] min-w-0">
            <div className="w-3.5 h-3.5 rounded-sm bg-lime flex-shrink-0 flex items-center justify-center">
              <span className="text-forest font-black" style={{ fontSize: "7px" }}>FF</span>
            </div>
            <span className="text-white/80 text-xs truncate min-w-0">{screenTitle[activeScreen]}</span>
          </div>
        </div>

        {/* App content area */}
        {activeScreen === "onboarding" ? (
          // Onboarding takes full width on desktop
          <div className="relative overflow-hidden rounded-b-2xl" style={{ height: 640, background: "var(--cream)" }}>
            {prevScreen && transitioning && (
              <div className="absolute inset-0 z-10" style={outStyle}>
                <DesktopOnboarding currentSlide={onboardingSlide} onSlideChange={setOnboardingSlide} onComplete={() => navigate("home")} />
              </div>
            )}
            <ActiveDesktopOnboardingLayer key={activeScreen} onboardingSlide={onboardingSlide}
              onSlideChange={setOnboardingSlide} onComplete={() => navigate("home")}
              transitioning={transitioning} inInitialStyle={inInitialStyle} inStyle={inStyle} />
          </div>
        ) : (
          // Main app layout: sidebar + content
          <div className="flex rounded-b-2xl overflow-hidden" style={{ height: 640 }}>
            {/* Sidebar */}
            <DesktopSidebar activeScreen={activeScreen} onNavigate={(s) => navigate(s)} />

            {/* Main content */}
            <div className="flex-1 relative overflow-hidden" style={{ background: "var(--cream)" }}>
              {prevScreen && transitioning && prevScreen !== "onboarding" && (
                <div className="absolute inset-0 z-10" style={outStyle}>
                  <DesktopScreenContent screen={prevScreen} onNavChange={handleNavChange} navigate={navigate} />
                </div>
              )}
              <ActiveDesktopLayer
                key={activeScreen}
                screen={activeScreen}
                onNavChange={handleNavChange}
                navigate={navigate}
                transitioning={transitioning}
                inInitialStyle={inInitialStyle}
                inStyle={inStyle}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

interface DesktopSidebarProps {
  activeScreen: Screen
  onNavigate: (s: Screen) => void
}

const navItems = [
  { id: "home" as Screen, icon: Home, label: "Home" },
  { id: "transactions" as Screen, icon: ArrowLeftRight, label: "Transactions" },
  { id: "cards" as Screen, icon: CreditCard, label: "Cards" },
  { id: "profile" as Screen, icon: User, label: "Profile" },
]

function DesktopSidebar({ activeScreen, onNavigate }: DesktopSidebarProps) {
  return (
    <div className="flex flex-col w-56 border-r flex-shrink-0" style={{ background: "#fff", borderColor: "var(--border)" }}>
      {/* Logo area */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center flex-shrink-0">
          <span className="font-black text-forest text-xs">FF</span>
        </div>
        <span className="font-extrabold text-forest text-base">FinFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = activeScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                active
                  ? "bg-forest text-white"
                  : "text-muted-foreground hover:bg-cream hover:text-forest"
              }`}
            >
              <Icon size={17} />
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-lime" />}
            </button>
          )
        })}
      </nav>

      {/* Bottom card */}
      <div className="px-3 pb-4 space-y-2">
        <div className="rounded-2xl p-3" style={{ background: "var(--cream)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full overflow-hidden ring-2" style={{ ringColor: "var(--lime)" }}>
              <img src="/images/onboarding-hero.jpg" alt="Alex" className="w-full h-full object-cover object-top" />
            </div>
            <div>
              <p className="text-xs font-bold text-forest leading-none">Alex Piter</p>
              <p className="text-[10px] text-muted-foreground">Premium</p>
            </div>
            <button className="ml-auto relative">
              <Bell size={15} className="text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Balance</span>
            <span className="text-xs font-extrabold text-forest">$45,000.00</span>
          </div>
        </div>

        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-lime text-forest font-bold text-sm">
          <QrCode size={15} />
          Scan QR
        </button>
      </div>
    </div>
  )
}

// ─── Desktop Screen Content ───────────────────────────────────────────────────

function DesktopScreenContent({ screen, onNavChange, navigate }: { screen: Screen; onNavChange: (t: string) => void; navigate: (s: Screen) => void }) {
  if (screen === "onboarding") return null
  return <DesktopScreenView screen={screen} onNavChange={onNavChange} navigate={navigate} />
}

function DesktopScreenView({ screen, onNavChange, navigate }: { screen: Screen; onNavChange: (t: string) => void; navigate: (s: Screen) => void }) {
  switch (screen) {
    case "home": return <DesktopHome onNavChange={onNavChange} />
    case "transactions": return <DesktopTransactions />
    case "cards": return <DesktopCards />
    case "profile": return <DesktopProfile />
    default: return null
  }
}

interface ActiveDesktopLayerProps {
  screen: Screen
  onNavChange: (tab: string) => void
  navigate: (s: Screen) => void
  transitioning: boolean
  inInitialStyle: React.CSSProperties
  inStyle: React.CSSProperties
}

function ActiveDesktopLayer({ screen, onNavChange, navigate, transitioning, inInitialStyle, inStyle }: ActiveDesktopLayerProps) {
  const [applied, setApplied] = useState(false)
  useEffect(() => {
    if (transitioning) {
      const raf = requestAnimationFrame(() => setApplied(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setApplied(true)
    }
  }, [transitioning])

  const style: React.CSSProperties = transitioning ? (applied ? inStyle : inInitialStyle) : {}

  return (
    <div className="absolute inset-0 z-20" style={style}>
      <DesktopScreenView screen={screen} onNavChange={onNavChange} navigate={navigate} />
    </div>
  )
}

// Desktop onboarding layers
function ActiveDesktopOnboardingLayer({ onboardingSlide, onSlideChange, onComplete, transitioning, inInitialStyle, inStyle }: {
  onboardingSlide: number; onSlideChange: (n: number) => void; onComplete: () => void;
  transitioning: boolean; inInitialStyle: React.CSSProperties; inStyle: React.CSSProperties
}) {
  const [applied, setApplied] = useState(false)
  useEffect(() => {
    if (transitioning) {
      const raf = requestAnimationFrame(() => setApplied(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setApplied(true)
    }
  }, [transitioning])
  const style: React.CSSProperties = transitioning ? (applied ? inStyle : inInitialStyle) : {}
  return (
    <div className="absolute inset-0 z-20" style={style}>
      <DesktopOnboarding currentSlide={onboardingSlide} onSlideChange={onSlideChange} onComplete={onComplete} />
    </div>
  )
}

// ─── Shared Mobile Screen Layer ───────────────────────────────────────────────

interface ActiveScreenLayerProps {
  screen: Screen
  activeTab: string
  onNavChange: (tab: string) => void
  onboardingSlide: number
  onSlideChange: (n: number) => void
  onComplete: () => void
  transitioning: boolean
  inInitialStyle: React.CSSProperties
  inStyle: React.CSSProperties
}

function ActiveScreenLayer({ screen, activeTab, onNavChange, onboardingSlide, onSlideChange, onComplete, transitioning, inInitialStyle, inStyle }: ActiveScreenLayerProps) {
  const [applied, setApplied] = useState(false)
  useEffect(() => {
    if (transitioning) {
      const raf = requestAnimationFrame(() => setApplied(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setApplied(true)
    }
  }, [transitioning])
  const style: React.CSSProperties = transitioning ? (applied ? inStyle : inInitialStyle) : {}
  return (
    <div className="absolute inset-0 z-20" style={style}>
      <ScreenRenderer screen={screen} activeTab={activeTab} onNavChange={onNavChange}
        onboardingSlide={onboardingSlide} onSlideChange={onSlideChange} onComplete={onComplete} />
    </div>
  )
}

// ─── Screen Renderer ──────────────────────────────────────────────────────────

interface ScreenRendererProps {
  screen: Screen
  activeTab: string
  onNavChange: (tab: string) => void
  onboardingSlide: number
  onSlideChange: (n: number) => void
  onComplete: () => void
  hideNavBar?: boolean
}

function ScreenRenderer({ screen, activeTab, onNavChange, onboardingSlide, onSlideChange, onComplete, hideNavBar }: ScreenRendererProps) {
  switch (screen) {
    case "onboarding":
      return <OnboardingScreen currentSlide={onboardingSlide} onSlideChange={onSlideChange} onComplete={onComplete} />
    case "home":
      return <HomeScreen onNavChange={onNavChange} activeTab={activeTab} hideNavBar={hideNavBar} />
    case "transactions":
      return <TransactionsScreen onNavChange={onNavChange} activeTab={activeTab} onBack={() => onNavChange("home")} hideNavBar={hideNavBar} />
    case "cards":
      return <CardsScreen onNavChange={onNavChange} activeTab={activeTab} hideNavBar={hideNavBar} />
    case "profile":
      return <ProfileScreen onNavChange={onNavChange} activeTab={activeTab} hideNavBar={hideNavBar} />
    default:
      return null
  }
}
