import { useEffect, useState, useRef, useCallback } from "react"
import { useInsights } from "@/context/InsightsContext"
import InsightCard from "@/components/InsightCard"

const MIN_WIDTH = 320
const MAX_WIDTH = 900
const DEFAULT_WIDTH = 384

export default function InsightsDrawer() {
    const { drawerOpen, closeDrawer, insights, loading, actionComplete } = useInsights()
    const [width, setWidth] = useState(DEFAULT_WIDTH)
    const dragging = useRef(false)

    useEffect(() => {
        document.body.style.overflow = drawerOpen ? "hidden" : ""
        return () => { document.body.style.overflow = "" }
    }, [drawerOpen])

    // Reset width when drawer closes
    useEffect(() => {
        if (!drawerOpen) setWidth(DEFAULT_WIDTH)
    }, [drawerOpen])

    const onMouseDown = useCallback((e) => {
        // Only on md+ (>=768px)
        if (window.innerWidth < 768) return
        dragging.current = true
        document.body.style.cursor = "ew-resize"
        document.body.style.userSelect = "none"
    }, [])

    const onMouseMove = useCallback((e) => {
        if (!dragging.current) return
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX))
        setWidth(newWidth)
    }, [])

    const onMouseUp = useCallback(() => {
        dragging.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
    }, [])

    useEffect(() => {
        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
        return () => {
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
        }
    }, [onMouseMove, onMouseUp])

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={closeDrawer}
            />

            {/* Drawer */}
            <div
                className={`fixed top-0 right-0 z-50 h-screen bg-background border-l border-border flex flex-col transition-transform duration-300 ease-in-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
                style={{ width: window.innerWidth >= 768 ? `${width}px` : "100%" }}
            >
                {/* Drag handle — md+ only */}
                <div
                    onMouseDown={onMouseDown}
                    className="hidden md:flex absolute left-0 top-0 h-full w-1.5 cursor-ew-resize group z-10 items-center justify-center"
                    title="Drag to resize"
                >
                    <div className="h-10 w-1 rounded-full bg-border group-hover:bg-primary transition-colors duration-150" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">AI Insights</span>
                        {loading && (
                            <span className="text-xs text-muted-foreground animate-pulse">Analyzing...</span>
                        )}
                    </div>
                    <button
                        onClick={closeDrawer}
                        className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    {loading && (
                        <>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
                            ))}
                        </>
                    )}
                    {!loading && (() => {
                        const filtered = insights.filter((i) => i.severity !== "info")
                        if (filtered.length === 0) return (
                            <p className="text-muted-foreground text-sm">
                                {insights.length > 0
                                    ? "No risks or warnings found. Everything looks good."
                                    : "No insights yet. Insights will appear here after analysis."}
                            </p>
                        )
                        return filtered.map((insight, index) => (
                            <InsightCard key={index} insight={insight} onActionComplete={actionComplete} />
                        ))
                    })()}
                </div>
            </div>
        </>
    )
}
