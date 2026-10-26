import { Container } from "@/components/ui/Container";
import { Stagger, StaggerItem } from "@/components/motion";
import { STATS } from "@/data/landing-content";
import { cn } from "@/lib/cn";

export function PlatformStats() {
  return (
    <section
      id="stats"
      aria-label="Platform statistics"
      className="relative z-10 -mt-8 lg:-mt-12"
    >
      <Container>
        <Stagger
          stagger={0.09}
          amount={0.3}
          className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
        >
          <ul className="grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x">
            {STATS.map((s, i) => (
              <StaggerItem
                as="li"
                key={s.label}
                y={18}
                className={cn(
                  "flex items-center gap-4 px-6 py-6 lg:px-7 lg:py-7",
                  i % 2 === 0 && "border-r border-line lg:border-r-0",
                  i >= 2 && "border-t border-line lg:border-t-0",
                )}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-dark">
                  <s.Icon size={22} />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-2xl font-bold text-navy lg:text-[28px]">
                    {s.value}
                  </span>
                  <span className="text-[13px] font-medium text-ink-secondary lg:text-sm">
                    {s.label}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </ul>
        </Stagger>
      </Container>
    </section>
  );
}
