import type { Metadata } from "next";
import "../globals.css";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: "Akreditasyon Bilgi Yönetim Sistemi",
  description: "Akreditasyon ve Kalite Güvence Sistemi",
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html
      lang={locale}
      dir={dir}
      className="h-full antialiased font-sans"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <div className="flex-1 flex flex-col">
              {children}
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
