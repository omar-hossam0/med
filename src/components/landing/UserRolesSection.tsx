import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { USER_ROLES } from "@/data/landing-content";
import { Check } from "lucide-react";

export function UserRolesSection() {
  return (
    <section
      id="roles"
      className="relative scroll-mt-24 overflow-hidden bg-teal-grad py-20 text-white lg:py-24"
    >
      <Decor />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Left: heading + CTA */}
          <div className="lg:col-span-4">
            <Stagger stagger={0.12} amount={0.4} className="flex flex-col items-start gap-5">
              <StaggerItem y={14}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-light" />
                  Built for Every Role
                </span>
              </StaggerItem>
              <StaggerItem y={26}>
                <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                  A Tailored Experience for Every User
                </h2>
              </StaggerItem>
              <StaggerItem y={20}>
                <p className="max-w-md text-white/75 lg:text-[17px]">
                  Medora provides dedicated tools and interfaces for patients,
                  doctors, reception staff, and administrators.
                </p>
              </StaggerItem>
              <StaggerItem y={18}>
                <Button as="a" href="#features" variant="white" size="md" withArrow>
                  Explore User Roles
                </Button>
              </StaggerItem>
            </Stagger>
          </div>

          {/* Right: role cards */}
          <div className="lg:col-span-8">
            <Stagger
              stagger={0.1}
              amount={0.2}
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {USER_ROLES.map((role) => (
                <StaggerItem key={role.key} y={26} className="h-full">
                  <article className="flex h-full flex-col items-center gap-4 rounded-2xl bg-white/[0.07] p-5 text-center backdrop-blur-sm ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.12] hover:ring-white/20">
                    <div className="relative">
                      <div className="relative mx-auto aspect-square w-[104px] overflow-hidden rounded-full ring-4 ring-white/15">
                        <Image
                          src={role.image}
                          alt={role.title}
                          fill
                          sizes="104px"
                          className="object-cover"
                        />
                      </div>
                      <span className="absolute -bottom-2 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-primary-light text-white shadow-tealGlow">
                        <role.Icon size={15} />
                      </span>
                    </div>

                    <h3 className="text-[15px] font-semibold text-white">
                      {role.title}
                    </h3>

                    <ul className="w-full space-y-1.5 text-left text-[12.5px] leading-snug text-white/80">
                      {role.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/15">
                            <Check size={10} />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Decor() {
  return (
    <>
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-primary-light/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <svg
        aria-hidden
        className="pointer-events-none absolute right-10 top-12 h-40 w-40 text-white/15"
        viewBox="0 0 200 200"
      >
        <circle
          cx="100"
          cy="100"
          r="98"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 6"
        />
      </svg>
    </>
  );
}
