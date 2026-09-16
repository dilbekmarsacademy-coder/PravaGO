import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HiddenVideoPlayer from "./HiddenVideoPlayer";

const SAMPLE_VIDEO_ID = "phsjXvkA51s";

interface HeroVideoSectionProps {
  videoEnded: boolean;
  onVideoEnded: () => void;
  onContinue: () => void;
}

export default function HeroVideoSection({
  videoEnded,
  onVideoEnded,
  onContinue,
}: HeroVideoSectionProps) {
  return (
    <section className="w-full bg-background">
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <Badge variant="secondary" className="mb-6">
          Rasmiy tayyorgarlik dasturi
        </Badge>

        <h1 className="font-display text-4xl leading-[1.05] text-foreground sm:text-6xl">
          Haydovchilik nazariy imtihoniga{" "}
          <span className="text-primary">ishonch bilan</span> tayyorlaning
        </h1>

        <p className="mt-6 max-w-lg text-lg text-muted-foreground">
          Video darslar, kalit so&apos;zlar va haqiqiy test formatidagi
          topshiriqlar — respublika miqyosidagi imtihonga 6 kunda
          tayyorgarlik.
        </p>

        <div className="mt-12">
          <HiddenVideoPlayer
            videoId={SAMPLE_VIDEO_ID}
            onEnded={onVideoEnded}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              {videoEnded
                ? "Video tomosha qilindi"
                : "Davom etish uchun videoni oxirigacha tomosha qiling"}
            </span>
            <Button onClick={onContinue} disabled={!videoEnded}>
              Davom etish
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
