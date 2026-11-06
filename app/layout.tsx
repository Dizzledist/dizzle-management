import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Dizzle Management · Profit calculator', description: 'A clearer picture of every order.' };
export default function Layout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
