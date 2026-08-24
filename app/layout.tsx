import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pick Six | NFL Pick Em League',
  description: '6-0 or bust.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
