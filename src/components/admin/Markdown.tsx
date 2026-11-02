/** Oddiy markdown: sarlavhalar, ro'yxatlar, qalin matn (HTML kiritilmaydi). */
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part));
        if (/^#{1,6}\s/.test(line)) return <h3 key={i} className="mt-2 font-display text-base font-bold">{bold(line.replace(/^#+\s/, ""))}</h3>;
        if (/^\s*[-*]\s/.test(line)) return <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:content-['•']">{bold(line.replace(/^\s*[-*]\s/, ""))}</p>;
        if (/^\s*\d+\.\s/.test(line)) return <p key={i} className="pl-1">{bold(line)}</p>;
        return line.trim() ? <p key={i}>{bold(line)}</p> : null;
      })}
    </div>
  );
}
