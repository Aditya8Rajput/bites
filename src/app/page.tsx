import {
  BadgeCheck,
  Camera,
  GraduationCap,
  HeartHandshake,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles,
  Video,
  VideoOff,
} from "lucide-react";

const queueStats = [
  { label: "Verified campuses", value: "42" },
  { label: "Avg. wait", value: "90s" },
  { label: "Calls recorded", value: "0" },
];

const guardrails = [
  {
    icon: GraduationCap,
    title: "College email only",
    text: "Access starts with a verified .edu inbox before anyone enters the queue.",
  },
  {
    icon: Video,
    title: "Video first",
    text: "No text chat, no group rooms, just one-to-one live introductions.",
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "WebRTC calls are peer-to-peer and never recorded or stored by Bites.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#151515]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-8 px-5 py-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10">
        <div className="flex min-h-[calc(100vh-2.5rem)] flex-col justify-between gap-8 rounded-[8px] border border-black/10 bg-[#fffaf1] p-5 shadow-[0_24px_80px_rgba(33,26,17,0.10)] sm:p-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-[8px] bg-[#141414] text-white">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xl font-black tracking-normal">Bites</p>
                <p className="text-sm font-medium text-[#6b6259]">
                  College-only live dating
                </p>
              </div>
            </div>
            <span className="rounded-[8px] border border-[#b44437]/25 bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#9e3328]">
              .edu only
            </span>
          </header>

          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-[8px] bg-[#e4f2ea] px-3 py-2 text-sm font-bold text-[#17613d]">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Verified campus network
            </p>
            <h1 className="text-5xl font-black leading-[1.02] tracking-normal text-[#141414] sm:text-6xl">
              Meet someone from campus, face to face.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-[#5f574f]">
              Bites matches verified college students into quick private video
              calls, with no text chat, no group calls, and no recordings.
            </p>
          </div>

          <form className="grid gap-3 rounded-[8px] border border-black/10 bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="college-email">
              College email
            </label>
            <input
              id="college-email"
              type="email"
              placeholder="you@college.edu"
              className="min-h-14 rounded-[6px] border border-black/10 bg-[#fbfaf7] px-4 text-base font-semibold outline-none transition focus:border-[#1b6f9f] focus:bg-white focus:ring-4 focus:ring-[#1b6f9f]/15"
            />
            <button
              type="submit"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[6px] bg-[#141414] px-5 text-base font-bold text-white transition hover:bg-[#2d2d2d] focus:outline-none focus:ring-4 focus:ring-[#141414]/20"
            >
              <Video className="size-5" aria-hidden="true" />
              Join the queue
            </button>
          </form>

          <div className="grid grid-cols-3 gap-3">
            {queueStats.map((stat) => (
              <div
                className="rounded-[8px] border border-black/10 bg-white p-4"
                key={stat.label}
              >
                <p className="text-2xl font-black text-[#141414]">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#6b6259]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-2.5rem)] flex-col gap-4">
          <section className="flex flex-1 flex-col overflow-hidden rounded-[8px] border border-black/10 bg-[#161616] text-white shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full bg-[#54d17a]" />
                <p className="text-sm font-bold">Live campus queue</p>
              </div>
              <p className="text-sm font-semibold text-white/60">1:30 match</p>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <div className="relative min-h-[280px] overflow-hidden rounded-[8px] bg-[#284b63]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.20),transparent_28%),linear-gradient(140deg,#365f7b,#20323d_58%,#111)]" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[6px] bg-black/35 px-3 py-2 text-sm font-bold backdrop-blur">
                  <BadgeCheck className="size-4 text-[#80e2a4]" />
                  Verified
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="mb-4 aspect-[4/3] rounded-[8px] border border-white/15 bg-white/10 backdrop-blur-sm" />
                  <p className="text-xl font-black">Maya</p>
                  <p className="text-sm font-semibold text-white/70">
                    Senior - Biology
                  </p>
                </div>
              </div>

              <div className="relative min-h-[280px] overflow-hidden rounded-[8px] bg-[#684a7b]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,0.18),transparent_26%),linear-gradient(140deg,#7f5f8e,#463554_56%,#151218)]" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[6px] bg-black/35 px-3 py-2 text-sm font-bold backdrop-blur">
                  <HeartHandshake className="size-4 text-[#ffd36c]" />
                  1:1 only
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="mb-4 aspect-[4/3] rounded-[8px] border border-white/15 bg-white/10 backdrop-blur-sm" />
                  <p className="text-xl font-black">Jordan</p>
                  <p className="text-sm font-semibold text-white/70">
                    Junior - Design
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
              <button
                className="flex size-12 items-center justify-center rounded-[8px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Toggle camera"
                title="Toggle camera"
              >
                <Camera className="size-5" aria-hidden="true" />
              </button>
              <button
                className="flex size-12 items-center justify-center rounded-[8px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Toggle microphone"
                title="Toggle microphone"
              >
                <Mic className="size-5" aria-hidden="true" />
              </button>
              <button
                className="flex size-12 items-center justify-center rounded-[8px] bg-[#d74a3a] text-white transition hover:bg-[#bb3b2d]"
                aria-label="Leave call"
                title="Leave call"
              >
                <VideoOff className="size-5" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            {guardrails.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  className="rounded-[8px] border border-black/10 bg-white p-5"
                  key={item.title}
                >
                  <Icon className="size-6 text-[#1b6f9f]" aria-hidden="true" />
                  <h2 className="mt-4 text-lg font-black">{item.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#625a52]">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </section>
        </div>
      </section>
    </main>
  );
}
