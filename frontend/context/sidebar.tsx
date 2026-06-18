// context/sidebar.tsx

"use client";

import {
  createContext,
  useContext,
  useState,
} from "react";

type SidebarContextType = {
  open: boolean;
  toggle: () => void;
};

const SidebarContext =
  createContext<SidebarContextType | null>(null);

export function SidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <SidebarContext.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error(
      "useSidebar must be used inside SidebarProvider"
    );
  }

  return context;
}