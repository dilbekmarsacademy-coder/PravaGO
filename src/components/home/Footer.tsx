import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="mt-auto bg-background px-5 py-8 text-center sm:px-8">
      <Separator className="mb-8" />
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        &copy; {new Date().getFullYear()} PravaTayyor — ta&apos;lim maqsadidagi loyiha
      </p>
    </footer>
  );
}
