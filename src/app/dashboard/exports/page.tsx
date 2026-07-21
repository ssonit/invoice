import { ComingSoon } from "@/components/dashboard/coming-soon"
import { Download } from "lucide-react"

export default function ExportsPage() {
  return (
    <ComingSoon
      title="Exports"
      description="Xuất CSV/Excel và đồng bộ sổ sách. Tab đã sẵn — pipeline export sẽ nối vào đây."
      icon={Download}
      status="soon"
    />
  )
}
