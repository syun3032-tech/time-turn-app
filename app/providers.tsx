"use client";

import { CacheProvider } from "@chakra-ui/next-js";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  // Wrap with CacheProvider to avoid emotion hydration mismatch in Next.js App Router.
  return (
    <CacheProvider>
      <ChakraProvider value={defaultSystem}>
        <AuthProvider>{children}</AuthProvider>
      </ChakraProvider>
    </CacheProvider>
  );
}
