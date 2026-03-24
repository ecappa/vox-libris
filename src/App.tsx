import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import tableData from "./app/dashboard/data.json"

export function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <SectionCards />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4 w-full">
            <ChartAreaInteractive />
            <DataTable data={tableData} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
