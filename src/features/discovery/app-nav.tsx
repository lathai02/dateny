import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthControl } from "@/features/auth/auth-control";
import { modeData, type Mode } from "./config";
export function AppNav({ mode }: { mode: Mode }) {
  return (
    <header className="app-nav">
      <Link className="app-logo" href="/" aria-label="Về trang chọn chế độ">
        <span className="logo-mark">D</span>
        <span className="logo-word">Dateny</span>
      </Link>
      <div className="nav-actions">
        <AuthControl />
        <Link className="mode-pill" href="/" aria-label="Đổi kiểu đi chơi">
          <ArrowLeft size={17} aria-hidden="true" />
          <span>{modeData[mode].label}</span>
        </Link>
      </div>
    </header>
  );
}
