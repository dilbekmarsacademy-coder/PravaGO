import LoginForm from "./LoginForm";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <noscript>
        <p className="max-w-sm text-center text-sm text-danger">
          Admin panel uchun brauzerda JavaScript yoqilgan bo&apos;lishi kerak. Brauzerni yangilang yoki JavaScript&apos;ni yoqing.
        </p>
      </noscript>
    </main>
  );
}
