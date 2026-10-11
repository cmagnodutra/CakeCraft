import { messages } from '@/content/messages';

export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
      <h1 className="font-serif text-5xl tracking-tight">{messages.brand.name}</h1>
    </section>
  );
}
