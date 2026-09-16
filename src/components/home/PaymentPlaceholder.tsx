import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Section from "./Section";

export default function PaymentPlaceholder() {
  return (
    <Section
      index="06"
      title="To'lov"
      subtitle="Ro'yxatdan o'tish muvaffaqiyatli yakunlandi"
      tone="soft"
    >
      <Card className="border border-dashed border-border ring-0">
        <CardContent className="text-center">
          <Badge variant="secondary" className="mb-5">
            Demo rejim
          </Badge>

          <p className="text-lg text-foreground">
            To&apos;lov tizimi tez orada ulanadi
          </p>
          <p className="mt-1 font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Click · Payme · Uzum Bank
          </p>

          <Button disabled className="mt-8 w-full sm:w-auto">
            To&apos;lovni amalga oshirish
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}
