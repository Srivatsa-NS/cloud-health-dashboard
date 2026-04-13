import { createContext, useContext, useState, useRef } from "react"
import axios from "axios"

const InsightsContext = createContext(null)

export function InsightsProvider({ children }) {
    const [insights, setInsights] = useState([])
    const [loading, setLoading] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const pageRef = useRef({ service: null, data: [], refresh: null })

    const registerPage = (service, data, refresh) => {
        pageRef.current = { service, data, refresh }
    }

    const fetchInsights = async () => {
        const { service, data } = pageRef.current
        if (!service || !data || data.length === 0) return
        setInsights([])
        setLoading(true)
        setDrawerOpen(true)
        try {
            const res = await axios.post("/api/insights", { service, data })
            setInsights(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const actionComplete = () => {
        if (pageRef.current.refresh) pageRef.current.refresh()
    }

    const closeDrawer = () => {
        setDrawerOpen(false)
        setInsights([])
    }

    return (
        <InsightsContext.Provider value={{ registerPage, fetchInsights, loading, insights, drawerOpen, closeDrawer, actionComplete }}>
            {children}
        </InsightsContext.Provider>
    )
}

export const useInsights = () => useContext(InsightsContext)
