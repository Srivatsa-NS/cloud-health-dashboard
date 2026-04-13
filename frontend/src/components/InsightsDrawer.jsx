import { useInsights } from "@/context/InsightsContext"
import InsightCard from "@/components/InsightCard"

export default function InsightsDrawer() {
    const { drawerOpen, closeDrawer, insights, loading, actionComplete } = useInsights()

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={closeDrawer}
            />

            {/* Drawer */}
            <div className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-background border-l border-border flex flex-col transition-transform duration-300 ease-in-out ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>

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
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {loading && (
                        <>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
                            ))}
                        </>
                    )}
                    {!loading && insights.length === 0 && (
                        <p className="text-muted-foreground text-sm">No insights yet. Insights will appear here after analysis.</p>
                    )}
                    {!loading && insights.map((insight, index) => (
                        <InsightCard key={index} insight={insight} onActionComplete={actionComplete} />
                    ))}
                </div>
            </div>
        </>
    )
}
