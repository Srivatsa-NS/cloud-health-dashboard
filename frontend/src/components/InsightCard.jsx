import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import axios from "axios"

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
        <Card className="overflow-visible">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Badge variant={severityBadge[insight.severity]}>
                        {insight.severity.toUpperCase()}
                    </Badge>
                    <span className="font-semibold text-sm">{insight.title}</span>
                </div>
                {insight.action_type !== "none" && (
                    <CardAction>
                        <Button
                            size="sm"
                            onClick={handleFixIt}
                            disabled={loading || result?.success}
                            variant={result?.success ? "secondary" : "default"}
                        >
                            {loading ? "Running..." : result?.success ? "Done ✓" : "Fix It"}
                        </Button>
                    </CardAction>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{insight.description}</p>
                <p className="text-sm text-muted-foreground italic">Suggested: {insight.action}</p>
                {result && (
                    <p className={`text-sm mt-1 ${result.success ? "text-green-500" : "text-destructive"}`}>
                        {result.message}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}