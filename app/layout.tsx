import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pick Six | NFL Pick Em League',
  description: '6-0 or bust.',
  icons: {
    icon: '/pick-six-logo.png',
    shortcut: '/pick-six-logo.png',
    apple: '/pick-six-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
