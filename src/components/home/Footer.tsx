export default function Footer() {
  return (
    <footer className="stripe-hazard mt-auto h-2 w-full">
      <div className="bg-asphalt px-4 py-6 text-center">
        <p className="font-mono text-xs tracking-widest text-paper/40 uppercase">
          &copy; {new Date().getFullYear()} PravaTayyor — ta&apos;lim maqsadidagi loyiha
        </p>
      </div>
    </footer>
  );
}
