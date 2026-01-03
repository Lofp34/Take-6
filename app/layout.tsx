import "./globals.css";

export const metadata = {
  title: "6 qui prend ! — Score + Stats",
  description: "Compteur de score et statistiques Take-6",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
