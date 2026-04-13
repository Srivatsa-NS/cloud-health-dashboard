import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useInsights } from "@/context/InsightsContext"

const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/ec2", label: "EC2" },
    { path: "/ecs", label: "ECS" },
    { path: "/alarms", label: "Alarms" },
    { path: "/security", label: "Security" },
    { path: "/s3", label: "S3" },
    { path: "/logs", label: "CloudWatch" },
]

function SunIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
    )
}

function MoonIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    )
}

function SparkleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
    )
}

export default function Navbar({ theme, toggleTheme }) {
    const location = useLocation()
    const [menuOpen, setMenuOpen] = useState(false)
    const { fetchInsights, loading: insightsLoading } = useInsights()

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-14 items-center justify-between">

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMenuOpen(false)}>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                            <span className="text-primary-foreground text-xs font-bold">CP</span>
                        </div>
                        <span className="text-base font-semibold tracking-tight">CloudPulse</span>
                    </Link>

                    {/* Desktop nav links */}
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const active = item.path === "/"
                                ? location.pathname === "/"
                                : location.pathname.startsWith(item.path)
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                        active
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </div>

                    {/* Right side: AI insights + theme toggle + hamburger */}
                    <div className="flex items-center gap-2">
                        {/* AI Insights button — hidden on Dashboard */}
                        {location.pathname !== "/" && (
                            <button
                                onClick={fetchInsights}
                                disabled={insightsLoading}
                                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                <SparkleIcon />
                                {insightsLoading ? "Analyzing..." : "AI Insights"}
                            </button>
                        )}
                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Toggle theme"
                        >
                            <span key={theme} className="theme-icon-enter">
                                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                            </span>
                        </button>

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMenuOpen((prev) => !prev)}
                            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 rounded-md hover:bg-muted transition-colors"
                            aria-label="Toggle menu"
                        >
                            <span className={`block h-0.5 w-5 bg-foreground rounded transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
                            <span className={`block h-0.5 w-5 bg-foreground rounded transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
                            <span className={`block h-0.5 w-5 bg-foreground rounded transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile dropdown */}
            {menuOpen && (
                <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
                    {navItems.map((item) => {
                        const active = item.path === "/"
                                ? location.pathname === "/"
                                : location.pathname.startsWith(item.path)
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMenuOpen(false)}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    active
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                    {location.pathname !== "/" && (
                        <button
                            onClick={() => { fetchInsights(); setMenuOpen(false) }}
                            disabled={insightsLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            <SparkleIcon />
                            {insightsLoading ? "Analyzing..." : "AI Insights"}
                        </button>
                    )}
                </div>
            )}
        </nav>
    )
}