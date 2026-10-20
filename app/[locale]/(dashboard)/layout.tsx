import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PresentationModeProvider } from "@/contexts/PresentationModeContext";
import DashboardShellClient from "@/components/DashboardShellClient";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PresentationModeProvider>
      <DashboardShellClient
        sidebar={<Sidebar />}
        header={<Header />}
        footer={<Footer />}
      >
        {children}
      </DashboardShellClient>
    </PresentationModeProvider>
  );
}
