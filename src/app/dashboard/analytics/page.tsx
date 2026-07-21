import { ComingSoon } from "@/components/dashboard/coming-soon"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      description="Biểu đồ chi tiêu, xu hướng theo tháng, và breakdown theo vendor — đang hoàn thiện từ chart trên Invoices."
      icon={BarChart3}
      status="beta"
    />
  )
}
