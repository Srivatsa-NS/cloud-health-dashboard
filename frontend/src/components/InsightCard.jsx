import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import axios from "axios"

const severityColors = {
    critical: "bg-red-500/10 border-red-500/30 text-red-400",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
}

const severityBadge = {
    critical: "destructive",
    warning: "secondary",
    info: "default",
}

export default function InsightCard({ insight, onActionComplete }) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)

    const handleFixIt = async () => {
        setLoading(true)
        try {
            const response = await axios.post("/api/action", {
                action_type: insight.action_type,
                action_params: insight.action_params,
            })
            setResult({ success: true, message: response.data.message })
            if (onActionComplete) onActionComplete()
        } catch (err) {
            setResult({ success: false, message: err.response?.data?.message || "Action failed" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={`rounded-lg border p-4 ${severityColors[insight.severity]}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant={severityBadge[insight.severity]}>
                            {insight.severity.toUpperCase()}
                        </Badge>
                        <span className="font-semibold text-white">{insight.title}</span>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">{insight.description}</p>
                    <p className="text-sm text-gray-400 italic">Suggested: {insight.action}</p>
                </div>
                {insight.action_type !== "none" && (
                    <button
                        onClick={handleFixIt}
                        disabled={loading || result?.success}
                        className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-md transition-colors"
                    >
                        {loading ? "Running..." : result?.success ? "Done ✓" : "Fix It"}
                    </button>
                )}
            </div>
            {result && (
                <p className={`mt-2 text-sm ${result.success ? "text-green-400" : "text-red-400"}`}>
                    {result.message}
                </p>
            )}
        </div>
    )
}