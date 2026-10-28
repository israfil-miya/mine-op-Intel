import { Factory, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  isFetching: boolean;
  isExporting: boolean;
  onRefresh: () => void;
  onExport: () => void;
  canExport: boolean;
}

export function Header({ isFetching, isExporting, onRefresh, onExport, canExport }: HeaderProps) {
  return (
    <header className="border-b border-border bg-[rgba(148,163,184,0.02)] backdrop-blur-[12px] sticky top-0 z-40 transition-colors">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-950 via-[#1a1c24] to-[#0e1117] text-white shadow-md ring-1 ring-indigo-500/30">
            <Factory className="h-5 w-5 text-[#818cf8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#f8fafc]">
                WEYLAND-YUTANI
              </span>
            </div>
            <p className="text-[10px] tracking-widest text-muted-foreground font-mono uppercase">
              Operations Intelligence & Anomaly Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            title="Force refresh data from live backend"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#6366f1]" : ""}`}
            />
            <span className="hidden sm:inline">Refresh Feed</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onExport}
            disabled={!canExport || isExporting}
            className="h-8 gap-1.5 text-xs font-medium bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-xs cursor-pointer"
          >
            <Download className={`h-3.5 w-3.5 ${isExporting ? "animate-bounce" : ""}`} />
            <span>{isExporting ? "Generating PDF..." : "Export Report"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
