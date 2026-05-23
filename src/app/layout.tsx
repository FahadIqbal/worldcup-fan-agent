import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WorldCup Fan Command Center",
  description: "AI-powered travel & logistics agent for FIFA World Cup 2026 fans",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚽</text></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#060b14" }}>
        {children}
      </body>
    </html>
  );
}
