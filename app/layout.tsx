import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RotaPro Enterprise · Rota2Cal",
  description:
    "Verify hospital rotas, prevent calendar duplicates, and sync every revision.",
};
export const viewport: Viewport = {
  themeColor: "#08131d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))`,
          }}
        />
      </body>
    </html>
  );
}
